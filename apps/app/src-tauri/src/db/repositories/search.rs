use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ValueRef};
use rusqlite::{params, Row};

use crate::db::{Access, DatabaseError};
use crate::search::contract::{
	ConversationKind, MessageHit, MessageSearchError, MessageSearchQuery, SnippetPart,
};

pub const MAX_QUERY_CHARS: usize = 120;
pub const MAX_HITS: u32 = 50;

const SNIPPET_TOKENS: i64 = 24;
const MATCH_OPENS: &str = "\u{2}";
const MATCH_CLOSES: &str = "\u{3}";
const ELLIPSIS: &str = "…";

const SEARCH_MESSAGES: &str = "SELECT message_id, seq, conversation_id, kind, title,
		author_bot_id, created_at, space_id, snippet
	FROM (
		SELECT message_search.message_id AS message_id, messages.seq AS seq,
			messages.conversation_id AS conversation_id, conversations.kind AS kind,
			conversations.title AS title, messages.author_bot_id AS author_bot_id,
			messages.created_at AS created_at,
			COALESCE(conversations.space_id, (
				SELECT bots.space_id FROM conversation_participants
					JOIN bots ON bots.id = conversation_participants.bot_id
					WHERE conversation_participants.conversation_id = conversations.id
					ORDER BY conversation_participants.joined_at ASC,
						conversation_participants.bot_id ASC
					LIMIT 1)) AS space_id,
			snippet(message_search, 0, ?2, ?3, ?4, ?5) AS snippet,
			bm25(message_search) AS relevance
		FROM message_search
		JOIN messages ON messages.id = message_search.message_id
		JOIN conversations ON conversations.id = messages.conversation_id
		WHERE message_search MATCH ?1
	)
	WHERE ?6 OR space_id = ?7
	ORDER BY relevance ASC, created_at DESC
	LIMIT ?8";

impl FromSql for ConversationKind {
	fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
		ConversationKind::parse(value.as_str()?).ok_or(FromSqlError::InvalidType)
	}
}

pub struct SearchRepository {
	access: Access,
}

impl SearchRepository {
	pub(in crate::db) fn new(access: Access) -> Self {
		Self { access }
	}

	pub async fn messages(
		&self,
		query: MessageSearchQuery,
	) -> Result<Vec<MessageHit>, MessageSearchError> {
		let Some(expression) = matched_words(&query.text) else {
			return Ok(Vec::new());
		};
		Ok(self
			.access
			.call(move |connection| {
				let mut statement = connection.prepare_cached(SEARCH_MESSAGES)?;
				let hits = statement.query_map(
					params![
						expression,
						MATCH_OPENS,
						MATCH_CLOSES,
						ELLIPSIS,
						SNIPPET_TOKENS,
						query.all_spaces,
						query.space_id,
						MAX_HITS
					],
					read_hit,
				)?;
				hits.collect::<rusqlite::Result<Vec<_>>>().map_err(DatabaseError::from)
			})
			.await?)
	}
}

fn matched_words(text: &str) -> Option<String> {
	let separated: String = text
		.chars()
		.take(MAX_QUERY_CHARS)
		.map(|held| if held.is_alphanumeric() { held } else { ' ' })
		.collect();
	let words: Vec<&str> = separated.split_whitespace().collect();
	let (last, earlier) = words.split_last()?;
	let mut expression = String::new();
	for word in earlier {
		expression.push_str(&format!("\"{word}\" "));
	}
	expression.push_str(&format!("\"{last}\"*"));
	Some(expression)
}

fn read_hit(row: &Row<'_>) -> rusqlite::Result<MessageHit> {
	Ok(MessageHit {
		message_id: row.get(0)?,
		seq: row.get(1)?,
		conversation_id: row.get(2)?,
		conversation_kind: row.get(3)?,
		conversation_title: row.get(4)?,
		author_bot_id: row.get(5)?,
		created_at: row.get(6)?,
		space_id: row.get(7)?,
		snippet: snippet_parts(&row.get::<_, String>(8)?),
	})
}

fn snippet_parts(snippet: &str) -> Vec<SnippetPart> {
	let mut parts = Vec::new();
	let mut rest = snippet;
	while let Some(opening) = rest.find(MATCH_OPENS) {
		push_part(&mut parts, &rest[..opening], false);
		let after = &rest[opening + MATCH_OPENS.len()..];
		let Some(closing) = after.find(MATCH_CLOSES) else {
			rest = after;
			break;
		};
		push_part(&mut parts, &after[..closing], true);
		rest = &after[closing + MATCH_CLOSES.len()..];
	}
	push_part(&mut parts, rest, false);
	parts
}

fn push_part(parts: &mut Vec<SnippetPart>, text: &str, matched: bool) {
	if text.is_empty() {
		return;
	}
	parts.push(SnippetPart { text: text.to_owned(), matched });
}
