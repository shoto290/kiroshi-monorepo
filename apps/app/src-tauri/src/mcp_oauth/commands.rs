use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_opener::OpenerExt;

use super::contract::{Disconnected, OauthError};
use super::credentials;
use crate::agent::commands::AgentState;
use crate::agent::protocol::{OauthCredentials, RevocationRequest};
use crate::agent::sidecar::Opening;
use crate::environment::commands::writable_root;
use crate::environment::contract::{
	EnvOwner, EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET,
	OAUTH_REFRESH_TOKEN,
};
use crate::environment::store;

const NOTHING_STORED: &str = "no access token was stored for that server";

const OPENABLE_SCHEMES: [&str; 2] = ["http://", "https://"];

fn is_openable(url: &str) -> bool {
	let lowered = url.to_ascii_lowercase();
	OPENABLE_SCHEMES.iter().any(|scheme| lowered.starts_with(scheme))
}

#[derive(Default)]
pub struct McpOauthState {
	running: AtomicBool,
}

impl McpOauthState {
	fn begin(&self) -> Result<Running<'_>, OauthError> {
		self.running
			.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
			.map(|_| Running { state: self })
			.map_err(|_| OauthError::AlreadyRunning)
	}

	fn is_running(&self) -> bool {
		self.running.load(Ordering::SeqCst)
	}
}

struct Running<'a> {
	state: &'a McpOauthState,
}

impl Drop for Running<'_> {
	fn drop(&mut self) {
		self.state.running.store(false, Ordering::SeqCst);
	}
}

async fn granted<R: Runtime>(
	app: &AppHandle<R>,
	url: &str,
) -> Result<OauthCredentials, OauthError> {
	let sidecar = app.state::<AgentState>().sidecar().await?;
	let mut flow = sidecar.begin_oauth(url)?;
	let settled = match flow.opened().await? {
		Opening::Settled(settled) => settled,
		Opening::Authorization(authorization) => {
			if !is_openable(&authorization) {
				return Err(OauthError::RefusedUrl { url: authorization });
			}
			if app.opener().open_url(authorization.clone(), None::<&str>).is_err() {
				return Err(OauthError::BrowserRefused { url: authorization });
			}
			flow.settled().await?
		}
	};
	match (settled.credentials, settled.error) {
		(Some(credentials), _) => Ok(credentials),
		(None, Some(failure)) => Err(OauthError::from(failure)),
		(None, None) => Err(OauthError::Failed {
			detail: "the authorization flow settled with neither a grant nor a reason".to_owned(),
		}),
	}
}

#[tauri::command]
pub async fn mcp_oauth_connect<R: Runtime>(
	app: AppHandle<R>,
	owner: EnvOwner,
	name: String,
	url: String,
) -> Result<(), OauthError> {
	let state = app.state::<McpOauthState>();
	let _running = state.begin()?;
	let root = writable_root(&app)?;
	let scope = EnvScope::Server { name, owner };
	let credentials = granted(&app, &url).await?;
	Ok(credentials::store(&root, &scope, &credentials)?)
}

#[tauri::command]
pub async fn mcp_oauth_cancel<R: Runtime>(app: AppHandle<R>) -> Result<(), OauthError> {
	if !app.state::<McpOauthState>().is_running() {
		return Ok(());
	}
	Ok(app.state::<AgentState>().sidecar().await?.cancel_oauth()?)
}

#[tauri::command]
pub async fn mcp_oauth_disconnect<R: Runtime>(
	app: AppHandle<R>,
	owner: EnvOwner,
	name: String,
	url: String,
) -> Result<Disconnected, OauthError> {
	let state = app.state::<McpOauthState>();
	let _running = state.begin()?;
	let root = writable_root(&app)?;
	let scope = EnvScope::Server { name, owner };
	let held = store::values(&root, &scope)?;
	let revocation = revoked(&app, &url, &held).await;
	credentials::forget(&root, &scope)?;
	Ok(revocation)
}

async fn revoked<R: Runtime>(app: &AppHandle<R>, url: &str, held: &Values) -> Disconnected {
	let Some(token) = held.get(OAUTH_ACCESS_TOKEN) else {
		return Disconnected { revoked: false, detail: Some(NOTHING_STORED.to_owned()) };
	};
	let request = RevocationRequest {
		url: url.to_owned(),
		token: token.clone(),
		refresh_token: held.get(OAUTH_REFRESH_TOKEN).cloned(),
		client_id: held.get(OAUTH_CLIENT_ID).cloned(),
		client_secret: held.get(OAUTH_CLIENT_SECRET).cloned(),
	};
	match app.state::<AgentState>().sidecar().await {
		Ok(sidecar) => match sidecar.revoke_oauth(&request).await {
			Ok(answer) => Disconnected { revoked: answer.revoked, detail: answer.detail },
			Err(error) => Disconnected { revoked: false, detail: Some(format!("{error:?}")) },
		},
		Err(error) => Disconnected { revoked: false, detail: Some(format!("{error:?}")) },
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_second_flow_is_refused_while_one_is_running() {
		let state = McpOauthState::default();
		let running = state.begin().expect("the first flow claims the state");

		assert_eq!(state.begin().err(), Some(OauthError::AlreadyRunning));
		assert!(state.is_running());

		drop(running);

		assert!(!state.is_running());
		state.begin().expect("a flow that settled leaves the state free");
	}

	#[test]
	fn a_state_holding_no_flow_reads_as_holding_none() {
		assert!(!McpOauthState::default().is_running());
	}

	#[test]
	fn a_disconnect_claims_the_same_state_a_connect_does() {
		let state = McpOauthState::default();
		let connecting = state.begin().expect("the connect claims the state");

		assert_eq!(state.begin().err(), Some(OauthError::AlreadyRunning));

		drop(connecting);
		let disconnecting = state.begin().expect("the disconnect claims it in turn");

		assert_eq!(state.begin().err(), Some(OauthError::AlreadyRunning));
		drop(disconnecting);
	}

	#[test]
	fn only_an_http_url_is_ever_handed_to_a_browser() {
		assert!(is_openable("https://authority.test/authorize?state=1"));
		assert!(is_openable("http://127.0.0.1:8080/authorize"));
		assert!(is_openable("HTTPS://authority.test/authorize"));
		assert!(!is_openable("javascript:alert(1)"));
		assert!(!is_openable("file:///etc/passwd"));
		assert!(!is_openable("data:text/html,<script>1</script>"));
		assert!(!is_openable("authorize"));
	}
}
