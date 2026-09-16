use tauri::State;

use super::contract::{Application, ApplicationInstall, ApplicationsError, ApplicationCallError};
use super::{catalogue, registry};
use crate::conversations::commands::ready;
use crate::db;

#[tauri::command]
pub async fn application_catalogue() -> Result<Vec<Application>, ApplicationsError> {
	catalogue::curated()
}

#[tauri::command]
pub async fn application_search(query: String) -> Result<Vec<Application>, ApplicationsError> {
	registry::search(registry::REGISTRY, &query).await
}

#[tauri::command]
pub async fn application_installs(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
) -> Result<Vec<ApplicationInstall>, ApplicationCallError> {
	Ok(ready(&state)?.application_installs().of_conversation(conversation_id).await?)
}
