use serde::{Deserialize, Serialize};

use crate::conversations::contract::StorageFailure;
use crate::db::DatabaseError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConversationKind {
	Main,
	Topic,
	Mission,
}

impl ConversationKind {
	pub fn parse(text: &str) -> Option<Self> {
		match text {
			"main" => Some(ConversationKind::Main),
			"topic" => Some(ConversationKind::Topic),
			"mission" => Some(ConversationKind::Mission),
			_ => None,
		}
	}
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchQuery {
	pub text: String,
	pub space_id: String,
	pub all_spaces: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetPart {
	pub text: String,
	pub matched: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageHit {
	pub message_id: String,
	pub seq: i64,
	pub conversation_id: String,
	pub conversation_kind: ConversationKind,
	pub conversation_title: String,
	pub author_bot_id: Option<String>,
	pub created_at: i64,
	pub space_id: Option<String>,
	pub snippet: Vec<SnippetPart>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MessageSearchError {
	#[serde(rename_all = "camelCase")]
	Unavailable { failure: StorageFailure },
	#[serde(rename_all = "camelCase")]
	Storage { failure: StorageFailure },
}

impl From<DatabaseError> for MessageSearchError {
	fn from(error: DatabaseError) -> Self {
		MessageSearchError::Storage { failure: (&error).into() }
	}
}
