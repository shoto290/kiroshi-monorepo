use tauri::{AppHandle, Manager, Runtime, State};

use super::super::context;
use super::super::contract::{
	MessageReference, NewAssistantMessage, NewTurn, NewUserMessage, PinnedBubble,
	TerminalCompletion, TranscriptPage, TranscriptStoreError, TranscriptWindow,
};
use super::bot::ready;
use crate::agent::reply_writer::HostWrites;
use crate::agent::AgentState;
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
pub async fn conversation_start_turn<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	turn: NewTurn,
) -> Result<i64, TranscriptStoreError> {
	let messages = ready(&state)?.messages();
	if owned_by_host(&app, |host| host.owns_turn(&turn.id)) {
		return Ok(messages.ensure_turn(turn.into()).await?);
	}
	Ok(messages.start_turn(turn.into()).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_complete_turn<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	id: String,
	completed_at: i64,
) -> Result<(), TranscriptStoreError> {
	let messages = ready(&state)?.messages();
	if owned_by_host(&app, |host| host.owns_turn(&id)) {
		return Ok(());
	}
	Ok(messages.complete_turn(id, completed_at).await?)
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
pub async fn conversation_open_assistant_message<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	message: NewAssistantMessage,
) -> Result<i64, TranscriptStoreError> {
	let messages = ready(&state)?.messages();
	if !owned_by_host(&app, |host| host.owns_message(&message.id)) {
		return Ok(messages.open_assistant_message(message.into()).await?);
	}
	match messages.message(message.conversation_id, message.id.clone()).await? {
		Some(stored) => Ok(stored.seq),
		None => Err(TranscriptStoreError::UnknownMessage { id: message.id }),
	}
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_append_text<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	id: String,
	delta: String,
) -> Result<(), TranscriptStoreError> {
	let messages = ready(&state)?.messages();
	if owned_by_host(&app, |host| host.owns_message(&id)) {
		return Ok(());
	}
	Ok(messages.append_text(id, delta).await?)
}

#[tauri::command]
#[specta::specta]
pub async fn conversation_finalize_message<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	id: String,
	completion: TerminalCompletion,
	settled_text: Option<String>,
) -> Result<(), TranscriptStoreError> {
	let messages = ready(&state)?.messages();
	if owned_by_host(&app, |host| host.owns_message(&id)) {
		return Ok(());
	}
	Ok(messages.finalize_message(id, completion.into(), settled_text).await?)
}

fn owned_by_host<R: Runtime>(app: &AppHandle<R>, owns: impl Fn(&HostWrites) -> bool) -> bool {
	app.try_state::<AgentState>().is_some_and(|agent| owns(agent.host_writes()))
}
