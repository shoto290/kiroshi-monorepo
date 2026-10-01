use std::fmt;
use std::sync::LazyLock;

use rusqlite::types::Type;
use rusqlite::{Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};

use super::settings::Settings;
use crate::db::{Access, DatabaseError};

const JOINED_SPACES_KEY: &str = "app.joined_spaces";

const UNREADABLE_LIST: &str = "the joined spaces setting does not read as a list of records";

static SETTINGS: LazyLock<Settings> = LazyLock::new(|| Settings::new("app_settings", None));

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinedSpace {
	pub id: String,
	pub host_url: String,
	pub token: String,
	pub remote_space_id: Option<String>,
	pub name: String,
}

impl JoinedSpace {
	fn reaches_the_same_space_as(&self, other: &JoinedSpace) -> bool {
		self.host_url == other.host_url && self.remote_space_id == other.remote_space_id
	}
}

impl fmt::Debug for JoinedSpace {
	fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
		formatter
			.debug_struct("JoinedSpace")
			.field("id", &self.id)
			.field("host_url", &self.host_url)
			.field("token", &"[redacted]")
			.field("remote_space_id", &self.remote_space_id)
			.field("name", &self.name)
			.finish()
	}
}

pub struct JoinedSpacesRepository {
	access: Access,
}

impl JoinedSpacesRepository {
	pub(in crate::db) fn new(access: Access) -> Self {
		Self { access }
	}

	pub async fn list(&self) -> Result<Vec<JoinedSpace>, DatabaseError> {
		self.access.call(stored_in).await
	}

	pub async fn find(&self, id: String) -> Result<Option<JoinedSpace>, DatabaseError> {
		self.access
			.call(move |connection| {
				Ok(stored_in(connection)?.into_iter().find(|joined| joined.id == id))
			})
			.await
	}

	pub async fn join(&self, candidate: JoinedSpace) -> Result<JoinedSpace, DatabaseError> {
		self.access
			.call_mut(move |connection| {
				let transaction =
					connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
				let mut stored = stored_in(&transaction)?;
				let joined =
					match stored.iter_mut().find(|held| held.reaches_the_same_space_as(&candidate))
					{
						Some(held) => {
							held.token = candidate.token;
							held.name = candidate.name;
							held.clone()
						}
						None => {
							stored.push(candidate.clone());
							candidate
						}
					};
				write_in(&transaction, &stored)?;
				transaction.commit()?;
				Ok(joined)
			})
			.await
	}

	pub async fn remove(&self, id: String) -> Result<bool, DatabaseError> {
		self.access
			.call_mut(move |connection| {
				let transaction =
					connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
				let mut stored = stored_in(&transaction)?;
				let held = stored.len();
				stored.retain(|joined| joined.id != id);
				if stored.len() == held {
					return Ok(false);
				}
				write_in(&transaction, &stored)?;
				transaction.commit()?;
				Ok(true)
			})
			.await
	}
}

fn stored_in(connection: &Connection) -> Result<Vec<JoinedSpace>, DatabaseError> {
	let Some(stored) = SETTINGS.read(connection, None, JOINED_SPACES_KEY)? else {
		return Ok(Vec::new());
	};
	serde_json::from_str(&stored).map_err(|_| unreadable_list())
}

fn write_in(connection: &Connection, joined: &[JoinedSpace]) -> Result<(), DatabaseError> {
	let stored = serde_json::to_string(joined)
		.map_err(|error| rusqlite::Error::ToSqlConversionFailure(error.into()))?;
	SETTINGS.write(connection, None, JOINED_SPACES_KEY, &stored)
}

fn unreadable_list() -> DatabaseError {
	rusqlite::Error::FromSqlConversionFailure(0, Type::Text, UNREADABLE_LIST.into()).into()
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::db::connection::temp_dir;
	use crate::db::{open, Database};

	fn a_joined_space(id: &str, host_url: &str, remote_space_id: Option<&str>) -> JoinedSpace {
		JoinedSpace {
			id: id.to_owned(),
			host_url: host_url.to_owned(),
			token: format!("token-of-{id}"),
			remote_space_id: remote_space_id.map(str::to_owned),
			name: format!("name-of-{id}"),
		}
	}

	async fn write_raw(database: &Database, value: &'static str) {
		database
			.call(move |connection| SETTINGS.write(connection, None, JOINED_SPACES_KEY, value))
			.await
			.expect("the raw write");
	}

	#[tokio::test]
	async fn joined_spaces_nobody_has_added_read_as_an_empty_list() {
		let dir = temp_dir();
		let database = open(&dir);

		assert!(database.joined_spaces().list().await.expect("the list").is_empty());
	}

	#[tokio::test]
	async fn joined_spaces_are_listed_in_insertion_order_after_the_file_is_reopened() {
		let dir = temp_dir();
		{
			let database = open(&dir);
			for joined in [
				a_joined_space("b", "http://b.test", None),
				a_joined_space("a", "http://a.test", Some("space-a")),
			] {
				database.joined_spaces().join(joined).await.expect("the join");
			}
		}

		let database = open(&dir);

		assert_eq!(
			database.joined_spaces().list().await.expect("the list"),
			vec![
				a_joined_space("b", "http://b.test", None),
				a_joined_space("a", "http://a.test", Some("space-a")),
			]
		);
	}

	#[tokio::test]
	async fn a_joined_space_reaching_a_stored_one_replaces_its_token_and_name_and_keeps_its_id() {
		let dir = temp_dir();
		let database = open(&dir);
		let repository = database.joined_spaces();
		repository.join(a_joined_space("first", "http://a.test", Some("s"))).await.expect("first");
		repository.join(a_joined_space("other", "http://a.test", None)).await.expect("other");

		let joined = repository
			.join(JoinedSpace {
				token: "fresh-token".to_owned(),
				name: "Fresh".to_owned(),
				..a_joined_space("second", "http://a.test", Some("s"))
			})
			.await
			.expect("the second join");

		let replaced = JoinedSpace {
			token: "fresh-token".to_owned(),
			name: "Fresh".to_owned(),
			..a_joined_space("first", "http://a.test", Some("s"))
		};
		assert_eq!(joined, replaced);
		assert_eq!(
			repository.list().await.expect("the list"),
			vec![replaced, a_joined_space("other", "http://a.test", None)]
		);
	}

	#[tokio::test]
	async fn a_removed_joined_space_leaves_the_others_and_an_unknown_id_removes_nothing() {
		let dir = temp_dir();
		let database = open(&dir);
		let repository = database.joined_spaces();
		repository.join(a_joined_space("a", "http://a.test", None)).await.expect("a");
		repository.join(a_joined_space("b", "http://b.test", None)).await.expect("b");

		assert!(repository.remove("a".to_owned()).await.expect("the removal"));
		assert!(!repository.remove("a".to_owned()).await.expect("the second removal"));
		assert_eq!(
			repository.list().await.expect("the list"),
			vec![a_joined_space("b", "http://b.test", None)]
		);
	}

	#[tokio::test]
	async fn a_joined_space_is_found_by_its_id_with_its_token() {
		let dir = temp_dir();
		let database = open(&dir);
		let repository = database.joined_spaces();
		repository.join(a_joined_space("a", "http://a.test", None)).await.expect("a");

		assert_eq!(
			repository.find("a".to_owned()).await.expect("the find"),
			Some(a_joined_space("a", "http://a.test", None))
		);
		assert_eq!(repository.find("z".to_owned()).await.expect("the find"), None);
	}

	#[tokio::test]
	async fn an_unreadable_joined_spaces_setting_fails_the_read_without_echoing_it() {
		let dir = temp_dir();
		let database = open(&dir);
		write_raw(&database, r#"[{"token":"leaked-secret"}]"#).await;

		let failure = database.joined_spaces().list().await.expect_err("the read fails");

		assert!(!format!("{failure:?}").contains("leaked-secret"));
		assert!(database
			.joined_spaces()
			.join(a_joined_space("a", "http://a.test", None))
			.await
			.is_err());
	}

	#[test]
	fn the_debug_output_of_a_joined_space_carries_no_token() {
		let printed = format!("{:?}", a_joined_space("a", "http://a.test", None));

		assert!(!printed.contains("token-of-a"));
		assert!(printed.contains("http://a.test"));
	}
}
