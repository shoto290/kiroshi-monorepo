use std::sync::{Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_opener::OpenerExt;

use super::contract::{Disconnected, OauthError};
use super::credentials;
use super::reports::{ConnectorReports, Standing};
use super::status::{status, ConnectorRow, Evidence};
use crate::agent::commands::AgentState;
use crate::agent::protocol::{OauthCredentials, RevocationRequest};
use crate::agent::sidecar::Opening;
use crate::agent::translate::now_ms;
use crate::bundles::{self, McpServer};
use crate::environment::commands::writable_root;
use crate::environment::contract::{
	EnvError, EnvOwner, EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET,
	OAUTH_REFRESH_TOKEN,
};
use crate::environment::store;

const NOTHING_STORED: &str = "no access token was stored for that server";

const NO_BUNDLES: &str = "the bundle directory is unavailable";

const OPENABLE_SCHEMES: [&str; 2] = ["http://", "https://"];

fn is_openable(url: &str) -> bool {
	let lowered = url.to_ascii_lowercase();
	OPENABLE_SCHEMES.iter().any(|scheme| lowered.starts_with(scheme))
}

enum Flow {
	Authorizing(EnvScope),
	Revoking,
}

#[derive(Default)]
pub struct McpOauthState {
	running: Mutex<Option<Flow>>,
}

impl McpOauthState {
	fn begin(&self, flow: Flow) -> Result<Running<'_>, OauthError> {
		let mut running = self.held();
		if running.is_some() {
			return Err(OauthError::AlreadyRunning);
		}
		*running = Some(flow);
		Ok(Running { state: self })
	}

	fn held(&self) -> MutexGuard<'_, Option<Flow>> {
		self.running.lock().unwrap_or_else(PoisonError::into_inner)
	}

	fn is_running(&self) -> bool {
		self.held().is_some()
	}

	fn is_authorizing(&self, scope: &EnvScope) -> bool {
		matches!(self.held().as_ref(), Some(Flow::Authorizing(held)) if held == scope)
	}
}

struct Running<'a> {
	state: &'a McpOauthState,
}

impl Drop for Running<'_> {
	fn drop(&mut self) {
		*self.state.held() = None;
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
	let scope = EnvScope::Server { name, owner };
	let _running = state.begin(Flow::Authorizing(scope.clone()))?;
	let root = writable_root(&app)?;
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
	let _running = state.begin(Flow::Revoking)?;
	let root = writable_root(&app)?;
	let scope = EnvScope::Server { name, owner };
	let held = store::values(&root, &scope)?;
	let revocation = revoked(&app, &url, &held).await;
	credentials::forget(&root, &scope)?;
	Ok(revocation)
}

#[tauri::command]
pub async fn mcp_connector_status<R: Runtime>(
	app: AppHandle<R>,
	owner: EnvOwner,
) -> Result<Vec<ConnectorRow>, EnvError> {
	let root = writable_root(&app)?;
	let served = store::resolve(&root, &owner)?;
	let flows = app.state::<McpOauthState>();
	let reports = app.state::<ConnectorReports>();
	let now = now_ms();
	let row = |server: McpServer| {
		let scope = EnvScope::Server { name: server.name.clone(), owner: owner.clone() };
		let evidence = Evidence {
			is_authorizing: flows.is_authorizing(&scope),
			reported: last_reported(&reports, &owner, &server.name),
			held: served.per_server.get(&server.name).cloned().unwrap_or_default(),
			declares_url: server.url().is_some(),
		};
		ConnectorRow { status: status(evidence, now), name: server.name }
	};
	Ok(declared_servers(&app, &owner)?.into_iter().map(row).collect())
}

fn last_reported(reports: &ConnectorReports, owner: &EnvOwner, name: &str) -> Option<Standing> {
	match owner {
		EnvOwner::Bot { id, .. } => reports.last(id, name),
		EnvOwner::Space { .. } => None,
	}
}

fn declared_servers<R: Runtime>(
	app: &AppHandle<R>,
	owner: &EnvOwner,
) -> Result<Vec<McpServer>, EnvError> {
	match owner {
		EnvOwner::Bot { id, .. } => bundles::root(app)
			.map(|root| bundles::mcp_servers(&root, id))
			.ok_or_else(|| EnvError::Unreadable { detail: NO_BUNDLES.to_owned() }),
		EnvOwner::Space { id } => Ok(bundles::space::laid_down(app, id)
			.map_or_else(Vec::new, |bundle| bundles::mcp_servers_at(&bundle))),
	}
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

	fn a_server(name: &str) -> EnvScope {
		EnvScope::Server {
			name: name.to_owned(),
			owner: EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() },
		}
	}

	#[test]
	fn a_second_flow_is_refused_while_one_is_running() {
		let state = McpOauthState::default();
		let running =
			state.begin(Flow::Authorizing(a_server("granola"))).expect("the first flow claims");

		assert_eq!(state.begin(Flow::Revoking).err(), Some(OauthError::AlreadyRunning));
		assert!(state.is_running());

		drop(running);

		assert!(!state.is_running());
		state.begin(Flow::Revoking).expect("a flow that settled leaves the state free");
	}

	#[test]
	fn a_running_authorization_reads_as_connecting_for_its_server_and_no_other() {
		let state = McpOauthState::default();
		let running = state.begin(Flow::Authorizing(a_server("granola"))).expect("the flow claims");

		assert!(state.is_authorizing(&a_server("granola")));
		assert!(!state.is_authorizing(&a_server("notion")));
		assert!(!state.is_authorizing(&EnvScope::Server {
			name: "granola".to_owned(),
			owner: EnvOwner::Space { id: "s1".to_owned() },
		}));

		drop(running);

		assert!(!state.is_authorizing(&a_server("granola")));
	}

	#[test]
	fn a_disconnect_reads_as_connecting_for_no_server() {
		let state = McpOauthState::default();
		let _revoking = state.begin(Flow::Revoking).expect("the disconnect claims");

		assert!(!state.is_authorizing(&a_server("granola")));
	}

	#[test]
	fn a_state_holding_no_flow_reads_as_holding_none() {
		assert!(!McpOauthState::default().is_running());
	}

	#[test]
	fn a_disconnect_claims_the_same_state_a_connect_does() {
		let state = McpOauthState::default();
		let connecting =
			state.begin(Flow::Authorizing(a_server("granola"))).expect("the connect claims");

		assert_eq!(state.begin(Flow::Revoking).err(), Some(OauthError::AlreadyRunning));

		drop(connecting);
		let disconnecting = state.begin(Flow::Revoking).expect("the disconnect claims in turn");

		assert_eq!(
			state.begin(Flow::Authorizing(a_server("granola"))).err(),
			Some(OauthError::AlreadyRunning)
		);
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
