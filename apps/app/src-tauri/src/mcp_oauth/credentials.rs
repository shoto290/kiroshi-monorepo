use std::path::Path;

use crate::agent::protocol::OauthCredentials;
use crate::environment::contract::{EnvError, EnvScope};
use crate::environment::store;

pub const ACCESS_TOKEN: &str = "KIROSHI_OAUTH_ACCESS_TOKEN";
pub const REFRESH_TOKEN: &str = "KIROSHI_OAUTH_REFRESH_TOKEN";
pub const EXPIRES_AT: &str = "KIROSHI_OAUTH_EXPIRES_AT";
pub const CLIENT_ID: &str = "KIROSHI_OAUTH_CLIENT_ID";
pub const CLIENT_SECRET: &str = "KIROSHI_OAUTH_CLIENT_SECRET";

pub const RESERVED: [&str; 5] = [ACCESS_TOKEN, REFRESH_TOKEN, EXPIRES_AT, CLIENT_ID, CLIENT_SECRET];

fn assignments(held: &OauthCredentials) -> Vec<(&'static str, String)> {
	let mut written =
		vec![(ACCESS_TOKEN, held.access_token.clone()), (CLIENT_ID, held.client_id.clone())];
	if let Some(refresh_token) = &held.refresh_token {
		written.push((REFRESH_TOKEN, refresh_token.clone()));
	}
	if let Some(expires_at) = held.expires_at {
		written.push((EXPIRES_AT, expires_at.to_string()));
	}
	if let Some(client_secret) = &held.client_secret {
		written.push((CLIENT_SECRET, client_secret.clone()));
	}
	written
}

pub fn store(root: &Path, scope: &EnvScope, held: &OauthCredentials) -> Result<(), EnvError> {
	for (name, value) in assignments(held) {
		if let Err(refused) = store::set(root, scope, name, &value) {
			return Err(rolled_back(root, scope, refused));
		}
	}
	Ok(())
}

pub fn forget(root: &Path, scope: &EnvScope) -> Result<(), EnvError> {
	let mut refused = None;
	for name in RESERVED {
		if let Err(error) = store::delete(root, scope, name) {
			refused = refused.or(Some(error));
		}
	}
	refused.map_or(Ok(()), Err)
}

fn rolled_back(root: &Path, scope: &EnvScope, refused: EnvError) -> EnvError {
	match forget(root, scope) {
		Ok(()) => refused,
		Err(also) => EnvError::Unwritable {
			detail: format!("{refused:?}, and the partial write could not be undone: {also:?}"),
		},
	}
}

#[cfg(test)]
mod tests {
	use std::fs;
	use std::path::PathBuf;

	use super::*;
	use crate::environment::contract::EnvOwner;

	fn a_root(name: &str) -> PathBuf {
		let root = std::env::temp_dir().join(format!("kiroshi-mcp-oauth-{name}"));
		let _ = fs::remove_dir_all(&root);
		root
	}

	fn a_server() -> EnvScope {
		EnvScope::Server {
			name: "granola".to_owned(),
			owner: EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() },
		}
	}

	fn a_full_grant() -> OauthCredentials {
		OauthCredentials {
			access_token: "granted".to_owned(),
			refresh_token: Some("renewable".to_owned()),
			expires_at: Some(1_700_000_000_000),
			client_id: "registered".to_owned(),
			client_secret: Some("confidential".to_owned()),
		}
	}

	#[test]
	fn the_five_reserved_names_land_at_server_scope() {
		let root = a_root("five-names");
		let scope = a_server();

		store(&root, &scope, &a_full_grant()).expect("the grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get(ACCESS_TOKEN).map(String::as_str), Some("granted"));
		assert_eq!(kept.get(REFRESH_TOKEN).map(String::as_str), Some("renewable"));
		assert_eq!(kept.get(EXPIRES_AT).map(String::as_str), Some("1700000000000"));
		assert_eq!(kept.get(CLIENT_ID).map(String::as_str), Some("registered"));
		assert_eq!(kept.get(CLIENT_SECRET).map(String::as_str), Some("confidential"));
		assert_eq!(kept.len(), RESERVED.len());
	}

	#[test]
	fn a_grant_naming_no_expiry_writes_no_expiry() {
		let root = a_root("no-expiry");
		let scope = a_server();

		store(
			&root,
			&scope,
			&OauthCredentials {
				access_token: "granted".to_owned(),
				refresh_token: None,
				expires_at: None,
				client_id: "registered".to_owned(),
				client_secret: None,
			},
		)
		.expect("the grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(
			kept.keys().map(String::as_str).collect::<Vec<_>>(),
			vec![ACCESS_TOKEN, CLIENT_ID]
		);
	}

	#[test]
	fn forgetting_takes_every_reserved_name_away_and_leaves_the_rest() {
		let root = a_root("forget");
		let scope = a_server();
		store::set(&root, &scope, "GRANOLA_REGION", "eu").expect("the name is written");
		store(&root, &scope, &a_full_grant()).expect("the grant is written");

		forget(&root, &scope).expect("the reserved names are deleted");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get("GRANOLA_REGION").map(String::as_str), Some("eu"));
		assert!(RESERVED.iter().all(|name| !kept.contains_key(*name)));
	}

	#[test]
	fn forgetting_a_scope_that_never_held_a_grant_is_no_error() {
		let root = a_root("forget-empty");

		forget(&root, &a_server()).expect("nothing to delete is not a failure");
	}
}
