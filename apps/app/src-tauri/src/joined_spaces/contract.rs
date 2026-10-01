use std::fmt;

use serde::{Deserialize, Serialize};

use crate::conversations::contract::StorageFailure;
use crate::db::repositories::joined_spaces;
use crate::db::DatabaseError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct JoinedSpace {
	pub id: String,
	pub host_url: String,
	pub remote_space_id: Option<String>,
	pub name: String,
}

impl From<joined_spaces::JoinedSpace> for JoinedSpace {
	fn from(joined: joined_spaces::JoinedSpace) -> Self {
		Self {
			id: joined.id,
			host_url: joined.host_url,
			remote_space_id: joined.remote_space_id,
			name: joined.name,
		}
	}
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct JoinedSpaceConnection {
	pub id: String,
	pub host_url: String,
	pub token: String,
	pub remote_space_id: Option<String>,
	pub name: String,
}

impl From<joined_spaces::JoinedSpace> for JoinedSpaceConnection {
	fn from(joined: joined_spaces::JoinedSpace) -> Self {
		Self {
			id: joined.id,
			host_url: joined.host_url,
			token: joined.token,
			remote_space_id: joined.remote_space_id,
			name: joined.name,
		}
	}
}

impl fmt::Debug for JoinedSpaceConnection {
	fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
		formatter
			.debug_struct("JoinedSpaceConnection")
			.field("id", &self.id)
			.field("host_url", &self.host_url)
			.field("token", &"[redacted]")
			.field("remote_space_id", &self.remote_space_id)
			.field("name", &self.name)
			.finish()
	}
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum LinkPart {
	Fragment,
	Host,
	Token,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JoinedSpaceError {
	#[serde(rename_all = "camelCase")]
	Unavailable { failure: StorageFailure },
	#[serde(rename_all = "camelCase")]
	Storage { failure: StorageFailure },
	#[serde(rename_all = "camelCase")]
	RefusedLink { part: LinkPart, message: String },
	#[serde(rename_all = "camelCase")]
	UnknownJoinedSpace { id: String },
	#[serde(rename_all = "camelCase")]
	Undeliverable { detail: String },
}

impl From<DatabaseError> for JoinedSpaceError {
	fn from(error: DatabaseError) -> Self {
		JoinedSpaceError::Storage { failure: (&error).into() }
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn the_debug_output_of_a_joined_space_connection_carries_no_token() {
		let connection = JoinedSpaceConnection {
			id: "a".to_owned(),
			host_url: "http://a.test".to_owned(),
			token: "the-secret-token".to_owned(),
			remote_space_id: None,
			name: "a.test".to_owned(),
		};

		let printed = format!("{connection:?}");

		assert!(!printed.contains("the-secret-token"));
		assert!(printed.contains("http://a.test"));
	}
}
