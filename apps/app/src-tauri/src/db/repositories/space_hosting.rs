use rusqlite::{params, Connection, OptionalExtension};

use super::spaces::SpaceError;
use crate::db::{Access, DatabaseError};

const SELECT_REGISTRATION: &str = "SELECT spaces.name, space_hosting.instance_id
	FROM spaces LEFT JOIN space_hosting ON space_hosting.space_id = spaces.id
	WHERE spaces.id = ?1";

const UPSERT_INSTANCE: &str = "INSERT INTO space_hosting (space_id, instance_id, is_hosted)
	VALUES (?1, ?2, 1)
	ON CONFLICT (space_id) DO UPDATE SET instance_id = excluded.instance_id, is_hosted = 1";

const UPDATE_HOSTED: &str = "UPDATE space_hosting SET is_hosted = ?2 WHERE space_id = ?1";

const SELECT_HOSTED: &str =
	"SELECT space_id FROM space_hosting WHERE is_hosted = 1 ORDER BY space_id ASC";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Registration {
	pub name: String,
	pub instance_id: Option<String>,
}

pub struct SpaceHostingRepository {
	access: Access,
}

impl SpaceHostingRepository {
	pub(in crate::db) fn new(access: Access) -> Self {
		Self { access }
	}

	pub async fn registration(&self, space_id: String) -> Result<Registration, SpaceError> {
		self.access.call(move |connection| Ok(registration_of(connection, &space_id))).await?
	}

	pub async fn registered(
		&self,
		space_id: String,
		instance_id: String,
	) -> Result<(), DatabaseError> {
		self.access
			.call_mut(move |connection| {
				connection.execute(UPSERT_INSTANCE, params![space_id, instance_id])?;
				Ok(())
			})
			.await
	}

	pub async fn set_hosted(&self, space_id: String, is_hosted: bool) -> Result<(), DatabaseError> {
		self.access
			.call_mut(move |connection| {
				connection.execute(UPDATE_HOSTED, params![space_id, is_hosted])?;
				Ok(())
			})
			.await
	}

	pub async fn hosted_space_ids(&self) -> Result<Vec<String>, DatabaseError> {
		self.access
			.call(|connection| {
				let mut statement = connection.prepare_cached(SELECT_HOSTED)?;
				let ids = statement.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;
				Ok(ids)
			})
			.await
	}
}

fn registration_of(connection: &Connection, space_id: &str) -> Result<Registration, SpaceError> {
	connection
		.query_row(SELECT_REGISTRATION, [space_id], |row| {
			Ok(Registration { name: row.get(0)?, instance_id: row.get(1)? })
		})
		.optional()?
		.ok_or_else(|| SpaceError::UnknownSpace { id: space_id.to_owned() })
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::db::connection::temp_dir;
	use crate::db::open;

	const PERSONAL: &str = "personal";

	#[tokio::test]
	async fn a_space_never_hosted_reads_its_name_and_no_instance() {
		let database = open(&temp_dir());

		let read = database.space_hosting().registration(PERSONAL.to_owned()).await;

		assert_eq!(
			read.expect("the registration reads"),
			Registration { name: "Personal".to_owned(), instance_id: None }
		);
	}

	#[tokio::test]
	async fn an_unknown_space_is_named_as_unknown() {
		let database = open(&temp_dir());

		let read = database.space_hosting().registration("missing".to_owned()).await;

		assert!(matches!(read, Err(SpaceError::UnknownSpace { id }) if id == "missing"));
	}

	#[tokio::test]
	async fn a_registered_instance_is_hosted_until_the_flag_is_cleared_and_kept_after() {
		let database = open(&temp_dir());
		let hosting = database.space_hosting();

		hosting.registered(PERSONAL.to_owned(), "i1".to_owned()).await.expect("stored");
		let hosted = hosting.hosted_space_ids().await.expect("listed");
		hosting.set_hosted(PERSONAL.to_owned(), false).await.expect("cleared");
		let cleared = hosting.hosted_space_ids().await.expect("listed");
		hosting.registered(PERSONAL.to_owned(), "i2".to_owned()).await.expect("replaced");

		assert_eq!(hosted, vec![PERSONAL.to_owned()]);
		assert!(cleared.is_empty());
		assert_eq!(
			hosting.registration(PERSONAL.to_owned()).await.expect("read").instance_id.as_deref(),
			Some("i2")
		);
		assert_eq!(hosting.hosted_space_ids().await.expect("listed"), vec![PERSONAL.to_owned()]);
	}
}
