use std::fs;

use kiroshi_app::agent::commands::terminate_session;
use kiroshi_app::agent::protocol::OauthCredentials;
use kiroshi_app::agent::sidecar::SIDECAR_OVERRIDE_ENV;
use kiroshi_app::agent::AgentState;
use kiroshi_app::environment::contract::{
	EnvOwner, EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET,
	OAUTH_REASON,
};
use kiroshi_app::environment::store;
use kiroshi_app::mcp_oauth::commands::{mcp_oauth_connect, McpOauthState};
use kiroshi_app::mcp_oauth::credentials;
use kiroshi_app::mcp_oauth::reports::ApplicationReports;
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::Manager;

const FAKE_SIDECAR: &str = env!("CARGO_BIN_EXE_fake_sidecar");

const REFUSES_HANDED_CLIENT: &str = "FAKE_AGENT_OAUTH_REFUSES_HANDED_CLIENT";

const URL: &str = "https://mcp.granola.test/mcp";

fn a_refused_grant() -> OauthCredentials {
	OauthCredentials {
		access_token: "held-access".to_owned(),
		refresh_token: Some("held-refresh".to_owned()),
		expires_at: Some(4_000_000_000_000),
		client_id: "registered".to_owned(),
		client_secret: Some("confidential".to_owned()),
	}
}

#[test]
fn a_connect_whose_handed_client_is_refused_registers_a_new_one_and_stores_it() {
	std::env::set_var(SIDECAR_OVERRIDE_ENV, FAKE_SIDECAR);
	std::env::set_var(REFUSES_HANDED_CLIENT, "1");
	let mut context = mock_context(noop_assets());
	context.config_mut().identifier =
		format!("com.kiroshi.application-connect-{}", std::process::id());
	let app = mock_builder()
		.manage(AgentState::default())
		.manage(McpOauthState::default())
		.manage(ApplicationReports::default())
		.build(context)
		.expect("the app builds");
	let data = app.path().app_data_dir().expect("the app data directory is named");
	let _ = fs::remove_dir_all(&data);
	let root = store::root(app.handle()).expect("the store root is named");
	let owner = EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() };
	let scope = EnvScope::Server { name: "granola".to_owned(), owner: owner.clone() };
	credentials::store(&root, &scope, &a_refused_grant()).expect("the grant is written");
	credentials::forget_tokens(&root, &scope).expect("the tokens are deleted");
	credentials::remember_refusal(&root, &scope, "invalid_grant").expect("the reason is written");

	let settled = tauri::async_runtime::block_on(mcp_oauth_connect(
		app.handle().clone(),
		owner,
		"granola".to_owned(),
		URL.to_owned(),
	));
	let kept = store::values(&root, &scope).expect("the scope is readable");
	tauri::async_runtime::block_on(terminate_session(app.state::<AgentState>().inner()));
	std::env::remove_var(REFUSES_HANDED_CLIENT);
	std::env::remove_var(SIDECAR_OVERRIDE_ENV);
	let _ = fs::remove_dir_all(&data);

	assert_eq!(settled, Ok(()));
	assert_eq!(
		kept,
		Values::from([
			(OAUTH_ACCESS_TOKEN.to_owned(), "granted-anew".to_owned()),
			(OAUTH_CLIENT_ID.to_owned(), "registered-anew".to_owned()),
			(OAUTH_CLIENT_SECRET.to_owned(), "confidential-anew".to_owned()),
		])
	);
	assert!(!kept.contains_key(OAUTH_REASON));
}
