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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinedSpace {
	pub id: String,
	#[serde(flatten)]
	pub reach: JoinedReach,
	pub remote_space_id: Option<String>,
	pub name: String,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JoinedReach {
	#[serde(rename_all = "camelCase")]
	Relay { instance_id: String },
	#[serde(rename_all = "camelCase")]
	Link { host_url: String, token: String },
}

impl JoinedSpace {
	fn reaches_the_same_space_as(&self, other: &JoinedSpace) -> bool {
		match (&self.reach, &other.reach) {
			(JoinedReach::Relay { instance_id }, JoinedReach::Relay { instance_id: other_id }) => {
				instance_id == other_id
			}
			(JoinedReach::Link { host_url, .. }, JoinedReach::Link { host_url: other_url, .. }) => {
				host_url == other_url && self.remote_space_id == other.remote_space_id
			}
			_ => false,
		}
	}
}

impl fmt::Debug for JoinedReach {
	fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
		match self {
			JoinedReach::Relay { instance_id } => {
				formatter.debug_struct("Relay").field("instance_id", instance_id).finish()
			}
			JoinedReach::Link { host_url, .. } => formatter
				.debug_struct("Link")
				.field("host_url", host_url)
				.field("token", &"[redacted]")
				.finish(),
		}
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
							held.reach = candidate.reach;
							held.name = candidate.name;
							held.remote_space_id =
								candidate.remote_space_id.or(held.remote_space_id.take());
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

	pub async fn learned(
		&self,
		id: String,
		remote_space_id: String,
	) -> Result<bool, DatabaseError> {
		self.access
			.call_mut(move |connection| {
				let transaction =
					connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
				let mut stored = stored_in(&transaction)?;
				let Some(held) = stored.iter_mut().find(|joined| joined.id == id) else {
					return Ok(false);
				};
				held.remote_space_id = Some(remote_space_id);
				write_in(&transaction, &stored)?;
				transaction.commit()?;
				Ok(true)
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
			reach: JoinedReach::Link {
				host_url: host_url.to_owned(),
				token: format!("token-of-{id}"),
			},
			remote_space_id: remote_space_id.map(str::to_owned),
			name: format!("name-of-{id}"),
		}
	}

	fn a_relay_space(id: &str, instance_id: &str) -> JoinedSpace {
		JoinedSpace {
			id: id.to_owned(),
			reach: JoinedReach::Relay { instance_id: instance_id.to_owned() },
			remote_space_id: None,
			name: format!("name-of-{id}"),
		}
	}

	fn with_token(joined: JoinedSpace, token: &str) -> JoinedSpace {
		let JoinedReach::Link { host_url, .. } = joined.reach else {
			panic!("a link entry");
		};
		JoinedSpace { reach: JoinedReach::Link { host_url, token: token.to_owned() }, ..joined }
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
				name: "Fresh".to_owned(),
				..with_token(a_joined_space("second", "http://a.test", Some("s")), "fresh-token")
			})
			.await
			.expect("the second join");

		let replaced = JoinedSpace {
			name: "Fresh".to_owned(),
			..with_token(a_joined_space("first", "http://a.test", Some("s")), "fresh-token")
		};
		assert_eq!(joined, replaced);
		assert_eq!(
			repository.list().await.expect("the list"),
			vec![replaced, a_joined_space("other", "http://a.test", None)]
		);
	}

	#[tokio::test]
	async fn an_entry_written_before_relay_entries_reads_as_a_link_entry() {
		let dir = temp_dir();
		let database = open(&dir);
		write_raw(
			&database,
			r#"[{"id":"a","hostUrl":"http://a.test","token":"token-of-a","remoteSpaceId":null,"name":"name-of-a"}]"#,
		)
		.await;

		assert_eq!(
			database.joined_spaces().list().await.expect("the list"),
			vec![a_joined_space("a", "http://a.test", None)]
		);
	}

	#[tokio::test]
	async fn a_relay_entry_is_stored_with_its_instance_and_rejoined_under_the_same_id() {
		let dir = temp_dir();
		let database = open(&dir);
		let repository = database.joined_spaces();
		repository.join(a_relay_space("first", "instance-1")).await.expect("the first join");
		assert!(repository
			.learned("first".to_owned(), "shared".to_owned())
			.await
			.expect("the learned space"));

		let rejoined = repository
			.join(JoinedSpace {
				name: "Renamed".to_owned(),
				..a_relay_space("second", "instance-1")
			})
			.await
			.expect("the second join");

		let expected = JoinedSpace {
			name: "Renamed".to_owned(),
			remote_space_id: Some("shared".to_owned()),
			..a_relay_space("first", "instance-1")
		};
		assert_eq!(rejoined, expected);
		assert_eq!(repository.list().await.expect("the list"), vec![expected]);
		assert!(!repository.learned("z".to_owned(), "s".to_owned()).await.expect("no entry"));
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
