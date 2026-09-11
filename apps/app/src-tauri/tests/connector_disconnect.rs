use std::fs;

use kiroshi_app::agent::commands::terminate_session;
use kiroshi_app::agent::protocol::OauthCredentials;
use kiroshi_app::agent::sidecar::SIDECAR_OVERRIDE_ENV;
use kiroshi_app::agent::AgentState;
use kiroshi_app::environment::contract::{EnvOwner, EnvScope, RESERVED_NAMES};
use kiroshi_app::environment::store;
use kiroshi_app::mcp_oauth::commands::{mcp_oauth_disconnect, McpOauthState};
use kiroshi_app::mcp_oauth::contract::Disconnected;
use kiroshi_app::mcp_oauth::credentials;
use kiroshi_app::mcp_oauth::reports::ConnectorReports;
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::Manager;

const FAKE_SIDECAR: &str = env!("CARGO_BIN_EXE_fake_sidecar");

const URL: &str = "https://mcp.granola.test/mcp";

fn a_space_grant() -> OauthCredentials {
	OauthCredentials {
		access_token: "held-at-the-space".to_owned(),
		refresh_token: Some("renewable".to_owned()),
		expires_at: Some(4_000_000_000_000),
		client_id: "registered".to_owned(),
		client_secret: Some("confidential".to_owned()),
	}
}

#[test]
fn a_bot_disconnect_revokes_and_deletes_the_grant_its_space_holds() {
	std::env::set_var(SIDECAR_OVERRIDE_ENV, FAKE_SIDECAR);
	let mut context = mock_context(noop_assets());
	context.config_mut().identifier =
		format!("com.kiroshi.connector-disconnect-{}", std::process::id());
	let app = mock_builder()
		.manage(AgentState::default())
		.manage(McpOauthState::default())
		.manage(ConnectorReports::default())
		.build(context)
		.expect("the app builds");
	let data = app.path().app_data_dir().expect("the app data directory is named");
	let _ = fs::remove_dir_all(&data);
	let root = store::root(app.handle()).expect("the store root is named");
	let space = EnvScope::Server {
		name: "granola".to_owned(),
		owner: EnvOwner::Space { id: "s1".to_owned() },
	};
	credentials::store(&root, &space, &a_space_grant()).expect("the space grant is written");

	let settled = tauri::async_runtime::block_on(mcp_oauth_disconnect(
		app.handle().clone(),
		EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() },
		"granola".to_owned(),
		URL.to_owned(),
	));
	let kept = store::values(&root, &space).expect("the space scope is readable");
	tauri::async_runtime::block_on(terminate_session(app.state::<AgentState>().inner()));
	std::env::remove_var(SIDECAR_OVERRIDE_ENV);
	let _ = fs::remove_dir_all(&data);

	assert_eq!(settled, Ok(Disconnected { revoked: true, detail: None }));
	assert!(RESERVED_NAMES.iter().all(|name| !kept.contains_key(*name)));
}
