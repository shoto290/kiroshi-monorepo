use tauri::State;

use super::super::context;
use super::super::contract::{
	MessageReference, NewAssistantMessage, NewTurn, NewUserMessage, PinnedBubble,
	TerminalCompletion, TranscriptPage, TranscriptStoreError, TranscriptWindow,
};
use super::bot::ready;
use crate::db;
use crate::db::repositories::messages::{MessagePageQuery, MessagesAroundQuery};

#[tauri::command]
#[specta::specta]
pub async fn conversation_message_page(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
	before_seq: Option<i64>,
	limit: u32,
) -> Result<TranscriptPage, TranscriptStoreError> {
	let query = MessagePageQuery { conversation_id: conversation_id.clone(), before_seq, limit };
	let page = ready(&state)?.messages().page_messages(query).await?;
	Ok(TranscriptPage::of(conversation_id, page))
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_message_page_around(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
	seq: i64,
	limit: u32,
) -> Result<TranscriptWindow, TranscriptStoreError> {
	let query = MessagesAroundQuery { conversation_id: conversation_id.clone(), seq, limit };
	let Some(around) = ready(&state)?.messages().messages_around(query).await? else {
		return Err(TranscriptStoreError::UnknownMessageSeq { conversation_id, seq });
	};
	Ok(TranscriptWindow::of(conversation_id, around))
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_message_reference(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
	message_id: String,
) -> Result<Option<MessageReference>, TranscriptStoreError> {
	let database = ready(&state)?;
	let Some(stored) = database.messages().message(conversation_id.clone(), message_id).await?
	else {
		return Ok(None);
	};
	let run = context::run_behind(database, &stored).await?;
	Ok(Some(MessageReference::of(conversation_id, stored, run)))
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_pin_message(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
	message_id: String,
	block_index: i64,
	pinned_at: i64,
) -> Result<(), TranscriptStoreError> {
	Ok(ready(&state)?
		.messages()
		.pin_message(conversation_id, message_id, block_index, pinned_at)
		.await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_unpin_message(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
	message_id: String,
	block_index: i64,
) -> Result<(), TranscriptStoreError> {
	Ok(ready(&state)?.messages().unpin_message(conversation_id, message_id, block_index).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_pinned_messages(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
) -> Result<Vec<PinnedBubble>, TranscriptStoreError> {
	let stored = ready(&state)?.messages().pinned_messages(conversation_id.clone()).await?;
	Ok(stored.into_iter().map(|pin| PinnedBubble::of(&conversation_id, pin)).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_start_turn(
	state: State<'_, db::DatabaseState>,
	turn: NewTurn,
) -> Result<i64, TranscriptStoreError> {
	Ok(ready(&state)?.messages().start_turn(turn.into()).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_complete_turn(
	state: State<'_, db::DatabaseState>,
	id: String,
	completed_at: i64,
) -> Result<(), TranscriptStoreError> {
	Ok(ready(&state)?.messages().complete_turn(id, completed_at).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_append_user_message(
	state: State<'_, db::DatabaseState>,
	message: NewUserMessage,
) -> Result<i64, TranscriptStoreError> {
	Ok(ready(&state)?.messages().append_user_message(message.into()).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_open_assistant_message(
	state: State<'_, db::DatabaseState>,
	message: NewAssistantMessage,
) -> Result<i64, TranscriptStoreError> {
	Ok(ready(&state)?.messages().open_assistant_message(message.into()).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_append_text(
	state: State<'_, db::DatabaseState>,
	id: String,
	delta: String,
) -> Result<(), TranscriptStoreError> {
	Ok(ready(&state)?.messages().append_text(id, delta).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_finalize_message(
	state: State<'_, db::DatabaseState>,
	id: String,
	completion: TerminalCompletion,
	settled_text: Option<String>,
) -> Result<(), TranscriptStoreError> {
	Ok(ready(&state)?.messages().finalize_message(id, completion.into(), settled_text).await?)
}
