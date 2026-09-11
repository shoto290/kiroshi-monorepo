use std::path::PathBuf;

use tauri::{AppHandle, Runtime};

use super::contract::{is_reserved, EnvEntry, EnvError, EnvScope};
use super::store;

pub fn writable_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, EnvError> {
	store::root(app).ok_or_else(|| EnvError::Unwritable {
		detail: "the application data directory is unavailable".to_owned(),
	})
}

#[tauri::command]
pub async fn env_set<R: Runtime>(
	app: AppHandle<R>,
	scope: EnvScope,
	name: String,
	value: String,
) -> Result<(), EnvError> {
	set_by_the_person(&writable_root(&app)?, &scope, &name, &value)
}

fn set_by_the_person(
	root: &std::path::Path,
	scope: &EnvScope,
	name: &str,
	value: &str,
) -> Result<(), EnvError> {
	if is_reserved(name) {
		return Err(EnvError::InvalidName { name: name.to_owned() });
	}
	store::set(root, scope, name, value)
}

#[tauri::command]
pub async fn env_delete<R: Runtime>(
	app: AppHandle<R>,
	scope: EnvScope,
	name: String,
) -> Result<(), EnvError> {
	store::delete(&writable_root(&app)?, &scope, &name)
}

#[tauri::command]
pub async fn env_list<R: Runtime>(
	app: AppHandle<R>,
	scope: EnvScope,
) -> Result<Vec<EnvEntry>, EnvError> {
	store::list(&writable_root(&app)?, &scope)
}

#[cfg(test)]
mod tests {
	use std::fs;

	use super::*;
	use crate::agent::protocol::OauthCredentials;
	use crate::environment::contract::{
		EnvOwner, OAUTH_ACCESS_TOKEN, OAUTH_REFRESH_TOKEN, RESERVED_NAMES,
	};
	use crate::mcp_oauth::credentials;

	fn a_root(name: &str) -> PathBuf {
		let root = std::env::temp_dir().join(format!("kiroshi-env-set-{name}"));
		let _ = fs::remove_dir_all(&root);
		root
	}

	fn a_bot() -> EnvOwner {
		EnvOwner::Bot { id: "b1".to_owned(), space_id: "s1".to_owned() }
	}

	fn a_server() -> EnvScope {
		EnvScope::Server { name: "granola".to_owned(), owner: a_bot() }
	}

	fn a_grant() -> OauthCredentials {
		OauthCredentials {
			access_token: "granted".to_owned(),
			refresh_token: Some("renewable".to_owned()),
			expires_at: Some(1_700_000_000_000),
			client_id: "registered".to_owned(),
			client_secret: Some("confidential".to_owned()),
		}
	}

	#[test]
	fn a_reserved_name_is_refused_at_server_scope_and_the_grant_stands() {
		let root = a_root("server");
		let scope = a_server();
		credentials::store(&root, &scope, &a_grant()).expect("the grant is written");
		let before = store::values(&root, &scope).expect("the scope is readable");

		for name in RESERVED_NAMES {
			assert_eq!(
				set_by_the_person(&root, &scope, name, "typed"),
				Err(EnvError::InvalidName { name: name.to_owned() })
			);
		}

		assert_eq!(store::values(&root, &scope).expect("the scope is readable"), before);
	}

	#[test]
	fn a_reserved_name_is_refused_at_bot_scope_and_the_held_value_stands() {
		let root = a_root("bot");
		let scope = EnvScope::from(&a_bot());
		store::set(&root, &scope, OAUTH_ACCESS_TOKEN, "held").expect("the value is written");

		assert_eq!(
			set_by_the_person(&root, &scope, OAUTH_ACCESS_TOKEN, "typed"),
			Err(EnvError::InvalidName { name: OAUTH_ACCESS_TOKEN.to_owned() })
		);
		assert_eq!(
			set_by_the_person(&root, &scope, OAUTH_REFRESH_TOKEN, "typed"),
			Err(EnvError::InvalidName { name: OAUTH_REFRESH_TOKEN.to_owned() })
		);

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("held"));
		assert_eq!(kept.get(OAUTH_REFRESH_TOKEN), None);
	}

	#[test]
	fn a_name_the_person_may_write_still_lands() {
		let root = a_root("allowed");
		let scope = a_server();

		set_by_the_person(&root, &scope, "GRANOLA_REGION", "eu").expect("the name is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert_eq!(kept.get("GRANOLA_REGION").map(String::as_str), Some("eu"));
	}

	#[test]
	fn a_grant_still_writes_the_five_names_the_person_is_refused() {
		let root = a_root("grant-after-refusal");
		let scope = a_server();
		assert!(set_by_the_person(&root, &scope, OAUTH_ACCESS_TOKEN, "typed").is_err());

		credentials::store(&root, &scope, &a_grant()).expect("the grant is written");

		let kept = store::values(&root, &scope).expect("the scope is readable");
		assert!(RESERVED_NAMES.iter().all(|name| kept.contains_key(*name)));
		assert_eq!(kept.get(OAUTH_ACCESS_TOKEN).map(String::as_str), Some("granted"));
	}
}
