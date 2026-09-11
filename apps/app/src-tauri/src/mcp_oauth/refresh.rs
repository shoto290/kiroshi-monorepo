use std::collections::{BTreeMap, BTreeSet};
use std::future::Future;
use std::path::{Path, PathBuf};

use tokio::sync::Mutex;

use super::credentials::{self, ServedGrant};
use crate::agent::contract::TransportError;
use crate::agent::protocol::{
	Authorized, OauthCredentials, OauthFailure, OauthFailureKind, RefreshRequest,
};
use crate::agent::sidecar::Sidecar;
use crate::agent::translate::now_ms;
use crate::bundles;
use crate::environment::contract::{
	EnvError, EnvOwner, EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET,
	OAUTH_REFRESH_TOKEN,
};
use crate::environment::store;

const REFRESH_AHEAD_MS: i64 = 60_000;

const NO_REASON: &str = "no reason was given";

type ServerUrls = BTreeMap<String, String>;

enum Standing {
	Served,
	Expired,
	Refreshable(RefreshRequest),
}

static REFRESHING: Mutex<()> = Mutex::const_new(());

pub async fn before_open(
	root: &Path,
	owner: &EnvOwner,
	serving: &[PathBuf],
	sidecar: &Sidecar,
) -> BTreeSet<String> {
	let _refreshing = REFRESHING.lock().await;
	let exchange =
		move |request: RefreshRequest| async move { sidecar.refresh_oauth(&request).await };
	awaiting_authorization(root, owner, &server_urls(serving), now_ms(), exchange)
		.await
		.unwrap_or_else(|error| {
			eprintln!("the grants served to this session could not be read: {error:?}");
			BTreeSet::new()
		})
}

fn server_urls(serving: &[PathBuf]) -> ServerUrls {
	serving
		.iter()
		.flat_map(|bundle| bundles::mcp_servers_at(bundle))
		.filter_map(|server| Some((server.name.clone(), server.url()?.to_owned())))
		.collect()
}

async fn awaiting_authorization<F, Exchanged>(
	root: &Path,
	owner: &EnvOwner,
	urls: &ServerUrls,
	now: i64,
	exchange: F,
) -> Result<BTreeSet<String>, EnvError>
where
	F: Fn(RefreshRequest) -> Exchanged,
	Exchanged: Future<Output = Result<Authorized, TransportError>>,
{
	let mut awaiting = BTreeSet::new();
	for (name, ServedGrant { scope, held }) in credentials::served(root, owner)? {
		let Some(url) = urls.get(&name) else {
			continue;
		};
		let awaits = match standing(&held, url, now) {
			Standing::Served => false,
			Standing::Expired => true,
			Standing::Refreshable(request) => {
				let sent = request.refresh_token.clone();
				awaits_after(root, &scope, &sent, exchange(request).await)
			}
		};
		if awaits {
			awaiting.insert(name);
		}
	}
	Ok(awaiting)
}

fn standing(held: &Values, url: &str, now: i64) -> Standing {
	let (Some(_), Some(expires_at)) = (held.get(OAUTH_ACCESS_TOKEN), credentials::expires_at(held))
	else {
		return Standing::Served;
	};
	match held.get(OAUTH_REFRESH_TOKEN) {
		Some(refresh_token) if expires_at <= now + REFRESH_AHEAD_MS => {
			Standing::Refreshable(RefreshRequest {
				url: url.to_owned(),
				refresh_token: refresh_token.clone(),
				client_id: held.get(OAUTH_CLIENT_ID).cloned(),
				client_secret: held.get(OAUTH_CLIENT_SECRET).cloned(),
			})
		}
		None if expires_at <= now => Standing::Expired,
		_ => Standing::Served,
	}
}

fn awaits_after(
	root: &Path,
	scope: &EnvScope,
	sent: &str,
	answer: Result<Authorized, TransportError>,
) -> bool {
	match answer {
		Ok(Authorized { credentials: Some(grant), .. }) => renewal_lost(root, scope, &grant),
		Ok(Authorized {
			error: Some(OauthFailure { kind: OauthFailureKind::Rejected, detail }),
			..
		}) => refused(root, scope, sent, detail),
		Ok(Authorized { error, .. }) => {
			let detail = error.and_then(|failure| failure.detail);
			eprintln!("the grant of {scope:?} was not refreshed: {}", reason(detail));
			false
		}
		Err(error) => {
			eprintln!("the grant of {scope:?} was not refreshed: {error:?}");
			false
		}
	}
}

fn renewal_lost(root: &Path, scope: &EnvScope, grant: &OauthCredentials) -> bool {
	let Err(error) = credentials::store(root, scope, grant) else {
		return false;
	};
	eprintln!("the refreshed grant of {scope:?} could not be stored: {error:?}");
	true
}

fn refused(root: &Path, scope: &EnvScope, sent: &str, detail: Option<String>) -> bool {
	eprintln!("the authorization server refused to refresh {scope:?}: {}", reason(detail));
	match store::values(root, scope) {
		Ok(held) if held.get(OAUTH_REFRESH_TOKEN).map(String::as_str) == Some(sent) => {
			forgotten(root, scope);
			true
		}
		Ok(_) => false,
		Err(error) => {
			eprintln!("the grant of {scope:?} could not be read again, so it stands: {error:?}");
			false
		}
	}
}

fn forgotten(root: &Path, scope: &EnvScope) {
	if let Err(error) = credentials::forget(root, scope) {
		eprintln!("the refused grant of {scope:?} could not be deleted: {error:?}");
	}
}

fn reason(detail: Option<String>) -> String {
	detail.unwrap_or_else(|| NO_REASON.to_owned())
}

#[cfg(test)]
mod tests {
	use std::cell::Cell;
	use std::fs;

	use super::*;
	use crate::environment::contract::{OAUTH_EXPIRES_AT, RESERVED_NAMES};

	const NOW: i64 = 1_800_000_000_000;
	const URL: &str = "https://mcp.granola.test/mcp";

	fn a_root(name: &str) -> PathBuf {
		let root = std::env::temp_dir().join(format!("kiroshi-mcp-refresh-{name}"));
		let _ = fs::remove_dir_all(&root);
		root
	}

	fn a_bot() -> EnvOwner {
		EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() }
	}

	fn granola() -> EnvScope {
		EnvScope::Server { name: "granola".to_owned(), owner: a_bot() }
	}

	fn declared() -> ServerUrls {
		[("granola".to_owned(), URL.to_owned())].into()
	}

	fn a_grant(expires_at: i64, refresh_token: Option<&str>) -> OauthCredentials {
		OauthCredentials {
			access_token: "held-access".to_owned(),
			refresh_token: refresh_token.map(str::to_owned),
			expires_at: Some(expires_at),
			client_id: "registered".to_owned(),
			client_secret: Some("confidential".to_owned()),
		}
	}

	fn held(root: &Path) -> Values {
		store::values(root, &granola()).expect("the scope is readable")
	}

	fn answering(kind: OauthFailureKind) -> Result<Authorized, TransportError> {
		Ok(Authorized {
			credentials: None,
			error: Some(OauthFailure { kind, detail: Some("invalid_grant".to_owned()) }),
		})
	}

	fn renewed() -> OauthCredentials {
		OauthCredentials {
			access_token: "renewed-access".to_owned(),
			refresh_token: Some("renewed-refresh".to_owned()),
			expires_at: Some(NOW + 3_600_000),
			client_id: "registered".to_owned(),
			client_secret: Some("confidential".to_owned()),
		}
	}

	#[tokio::test]
	async fn a_rejected_refresh_deletes_every_reserved_name_and_names_the_server() {
		let root = a_root("rejected");
		store::set(&root, &granola(), "GRANOLA_REGION", "eu").expect("the name is written");
		credentials::store(&root, &granola(), &a_grant(NOW, Some("held-refresh")))
			.expect("the grant is written");

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| async {
			answering(OauthFailureKind::Rejected)
		})
		.await
		.expect("the pass reads the store");

		assert_eq!(awaiting, BTreeSet::from(["granola".to_owned()]));
		let kept = held(&root);
		assert!(RESERVED_NAMES.iter().all(|name| !kept.contains_key(*name)));
		assert_eq!(kept.get("GRANOLA_REGION").map(String::as_str), Some("eu"));
	}

	#[tokio::test]
	async fn a_failed_refresh_leaves_the_five_names_as_they_stand() {
		let root = a_root("failed");
		credentials::store(&root, &granola(), &a_grant(NOW, Some("held-refresh")))
			.expect("the grant is written");
		let before = held(&root);

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| async {
			answering(OauthFailureKind::Failed)
		})
		.await
		.expect("the pass reads the store");

		assert!(awaiting.is_empty());
		assert_eq!(held(&root), before);
		assert_eq!(before.len(), RESERVED_NAMES.len());
	}

	#[tokio::test]
	async fn a_sidecar_that_never_answered_leaves_the_five_names_as_they_stand() {
		let root = a_root("transport");
		credentials::store(&root, &granola(), &a_grant(NOW, Some("held-refresh")))
			.expect("the grant is written");
		let before = held(&root);

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| async {
			Err(TransportError::WriteFailed { detail: "the sidecar is gone".to_owned() })
		})
		.await
		.expect("the pass reads the store");

		assert!(awaiting.is_empty());
		assert_eq!(held(&root), before);
	}

	#[tokio::test]
	async fn a_granted_refresh_writes_over_the_five_names_it_carries() {
		let root = a_root("granted");
		credentials::store(&root, &granola(), &a_grant(NOW + 59_000, Some("held-refresh")))
			.expect("the grant is written");
		let asked = Cell::new(None);

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |request| {
			asked.set(Some(request));
			async { Ok(Authorized { credentials: Some(renewed()), error: None }) }
		})
		.await
		.expect("the pass reads the store");

		assert!(awaiting.is_empty());
		assert_eq!(
			asked.take(),
			Some(RefreshRequest {
				url: URL.to_owned(),
				refresh_token: "held-refresh".to_owned(),
				client_id: Some("registered".to_owned()),
				client_secret: Some("confidential".to_owned()),
			})
		);
		let kept = held(&root);
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("renewed-access"));
		assert_eq!(kept.get(OAUTH_REFRESH_TOKEN).map(String::as_str), Some("renewed-refresh"));
		let renewed_at = (NOW + 3_600_000).to_string();
		assert_eq!(kept.get(OAUTH_EXPIRES_AT), Some(&renewed_at));
	}

	#[tokio::test]
	async fn an_expired_grant_holding_no_refresh_token_is_named_and_kept() {
		let root = a_root("expired");
		credentials::store(&root, &granola(), &a_grant(NOW, None)).expect("the grant is written");
		let before = held(&root);
		let asked = Cell::new(0);

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| {
			asked.set(asked.get() + 1);
			async { answering(OauthFailureKind::Rejected) }
		})
		.await
		.expect("the pass reads the store");

		assert_eq!(awaiting, BTreeSet::from(["granola".to_owned()]));
		assert_eq!(held(&root), before);
		assert_eq!(asked.get(), 0);
	}

	#[tokio::test]
	async fn a_grant_expiring_beyond_the_minute_or_a_server_declaring_no_url_is_left_alone() {
		let root = a_root("left-alone");
		credentials::store(&root, &granola(), &a_grant(NOW + 61_000, Some("held-refresh")))
			.expect("the grant is written");
		let asked = Cell::new(0);
		let exchange = |_| {
			asked.set(asked.get() + 1);
			async { answering(OauthFailureKind::Rejected) }
		};

		let fresh = awaiting_authorization(&root, &a_bot(), &declared(), NOW, &exchange).await;
		let undeclared =
			awaiting_authorization(&root, &a_bot(), &ServerUrls::new(), NOW + 3_600_000, &exchange)
				.await;

		assert_eq!(fresh.expect("the pass reads the store"), BTreeSet::new());
		assert_eq!(undeclared.expect("the pass reads the store"), BTreeSet::new());
		assert_eq!(asked.get(), 0);
		assert_eq!(held(&root).len(), RESERVED_NAMES.len());
	}

	fn granola_of_the_space() -> EnvScope {
		EnvScope::Server {
			name: "granola".to_owned(),
			owner: EnvOwner::Space { id: "s1".to_owned() },
		}
	}

	#[tokio::test]
	async fn a_live_bot_grant_keeps_the_server_in_and_sends_no_refresh_for_the_space() {
		let root = a_root("space-shadowed");
		credentials::store(&root, &granola_of_the_space(), &a_grant(NOW, Some("space-refresh")))
			.expect("the space grant is written");
		credentials::store(&root, &granola(), &a_grant(NOW + 3_600_000, Some("held-refresh")))
			.expect("the bot grant is written");
		let space_before =
			store::values(&root, &granola_of_the_space()).expect("the scope is readable");
		let asked = Cell::new(0);

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| {
			asked.set(asked.get() + 1);
			async { answering(OauthFailureKind::Rejected) }
		})
		.await
		.expect("the pass reads the store");

		assert!(awaiting.is_empty());
		assert_eq!(asked.get(), 0);
		assert_eq!(
			store::values(&root, &granola_of_the_space()).expect("the scope is readable"),
			space_before
		);
	}

	#[tokio::test]
	async fn the_standing_is_read_from_the_served_bot_grant_and_not_the_live_space_one() {
		let root = a_root("bot-served");
		credentials::store(&root, &granola_of_the_space(), &a_grant(NOW + 3_600_000, None))
			.expect("the space grant is written");
		credentials::store(&root, &granola(), &a_grant(NOW, None))
			.expect("the bot grant is written");

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| async {
			answering(OauthFailureKind::Failed)
		})
		.await
		.expect("the pass reads the store");

		assert_eq!(awaiting, BTreeSet::from(["granola".to_owned()]));
	}

	#[tokio::test]
	async fn a_refusal_leaves_a_grant_that_moved_under_the_refresh_as_it_stands() {
		let root = a_root("moved");
		credentials::store(&root, &granola(), &a_grant(NOW, Some("held-refresh")))
			.expect("the grant is written");

		let awaiting = awaiting_authorization(&root, &a_bot(), &declared(), NOW, |_| {
			credentials::store(&root, &granola(), &renewed()).expect("a connect lands meanwhile");
			async { answering(OauthFailureKind::Rejected) }
		})
		.await
		.expect("the pass reads the store");

		assert!(awaiting.is_empty());
		let kept = held(&root);
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("renewed-access"));
		assert_eq!(kept.get(OAUTH_REFRESH_TOKEN).map(String::as_str), Some("renewed-refresh"));
		assert_eq!(kept.len(), RESERVED_NAMES.len());
	}

	#[test]
	fn the_url_of_a_server_is_read_from_the_bundles_serving_the_session() {
		let root = a_root("urls");
		let system = root.join("system");
		let bot = root.join("bot");
		bundles::set_mcp_server_at(&system, "granola", &serde_json::json!({ "url": "https://a" }))
			.expect("the server is declared");
		bundles::set_mcp_server_at(&bot, "granola", &serde_json::json!({ "url": "https://b" }))
			.expect("the server is declared");
		bundles::set_mcp_server_at(&bot, "clock", &serde_json::json!({ "command": "run" }))
			.expect("the server is declared");

		assert_eq!(
			server_urls(&[system, bot]),
			ServerUrls::from([("granola".to_owned(), "https://b".to_owned())])
		);
	}
}
