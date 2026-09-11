use std::path::Path;

use crate::agent::protocol::OauthCredentials;
use crate::environment::contract::{
	EnvError, EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET,
	OAUTH_EXPIRES_AT, OAUTH_REFRESH_TOKEN, RESERVED_NAMES,
};
use crate::environment::store;

const AN_UNREADABLE_EXPIRY_HAS_PASSED: i64 = i64::MIN;

pub fn expires_at(held: &Values) -> Option<i64> {
	held.get(OAUTH_EXPIRES_AT).map(|at| at.parse().unwrap_or(AN_UNREADABLE_EXPIRY_HAS_PASSED))
}

fn named(held: &OauthCredentials, name: &str) -> Option<String> {
	match name {
		OAUTH_ACCESS_TOKEN => Some(held.access_token.clone()),
		OAUTH_CLIENT_ID => Some(held.client_id.clone()),
		OAUTH_REFRESH_TOKEN => held.refresh_token.clone(),
		OAUTH_CLIENT_SECRET => held.client_secret.clone(),
		OAUTH_EXPIRES_AT => held.expires_at.map(|at| at.to_string()),
		_ => None,
	}
}

pub fn store(root: &Path, scope: &EnvScope, held: &OauthCredentials) -> Result<(), EnvError> {
	for name in RESERVED_NAMES {
		let written = match named(held, name) {
			Some(value) => store::set(root, scope, name, &value),
			None => store::delete(root, scope, name),
		};
		if let Err(refused) = written {
			return Err(rolled_back(root, scope, refused));
		}
	}
	Ok(())
}

pub fn forget(root: &Path, scope: &EnvScope) -> Result<(), EnvError> {
	let mut refused = None;
	for name in RESERVED_NAMES {
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

	fn a_bare_grant() -> OauthCredentials {
		OauthCredentials {
			access_token: "granted-again".to_owned(),
			refresh_token: None,
			expires_at: None,
			client_id: "registered-again".to_owned(),
			client_secret: None,
		}
	}

	#[test]
	fn the_five_reserved_names_land_at_server_scope() {
		let root = a_root("five-names");
		let scope = a_server();

		store(&root, &scope, &a_full_grant()).expect("the grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("granted"));
		assert_eq!(kept.get(OAUTH_REFRESH_TOKEN).map(String::as_str), Some("renewable"));
		assert_eq!(kept.get(OAUTH_EXPIRES_AT).map(String::as_str), Some("1700000000000"));
		assert_eq!(kept.get(OAUTH_CLIENT_ID).map(String::as_str), Some("registered"));
		assert_eq!(kept.get(OAUTH_CLIENT_SECRET).map(String::as_str), Some("confidential"));
		assert_eq!(kept.len(), RESERVED_NAMES.len());
	}

	#[test]
	fn a_grant_naming_no_expiry_writes_no_expiry() {
		let root = a_root("no-expiry");
		let scope = a_server();

		store(&root, &scope, &a_bare_grant()).expect("the grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(
			kept.keys().map(String::as_str).collect::<Vec<_>>(),
			vec![OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_ID]
		);
	}

	#[test]
	fn a_second_grant_leaves_no_value_of_the_first_behind() {
		let root = a_root("second-grant");
		let scope = a_server();
		store(&root, &scope, &a_full_grant()).expect("the first grant is written");

		store(&root, &scope, &a_bare_grant()).expect("the second grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("granted-again"));
		assert_eq!(kept.get(OAUTH_CLIENT_ID).map(String::as_str), Some("registered-again"));
		assert_eq!(kept.get(OAUTH_REFRESH_TOKEN), None);
		assert_eq!(kept.get(OAUTH_EXPIRES_AT), None);
		assert_eq!(kept.get(OAUTH_CLIENT_SECRET), None);
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
		assert!(RESERVED_NAMES.iter().all(|name| !kept.contains_key(*name)));
	}

	#[test]
	fn forgetting_a_scope_that_never_held_a_grant_is_no_error() {
		let root = a_root("forget-empty");

		forget(&root, &a_server()).expect("nothing to delete is not a failure");
	}

	#[test]
	fn a_listing_of_a_server_scope_names_none_of_the_five() {
		let root = a_root("listing");
		let scope = a_server();
		store::set(&root, &scope, "GRANOLA_REGION", "eu").expect("the name is written");
		store(&root, &scope, &a_full_grant()).expect("the grant is written");

		let listed = store::list(&root, &scope).expect("the scope lists");

		assert_eq!(
			listed.iter().map(|entry| entry.name.as_str()).collect::<Vec<_>>(),
			vec!["GRANOLA_REGION"]
		);
	}
}
