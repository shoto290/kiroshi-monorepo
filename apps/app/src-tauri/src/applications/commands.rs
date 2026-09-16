use tauri::State;

use super::catalogue;
use super::contract::{
	Application, ApplicationInstall, ApplicationSearch, ApplicationsError, ApplicationCallError,
};
use super::search::{search, Registries};
use crate::conversations::commands::ready;
use crate::db;

#[tauri::command]
pub async fn application_catalogue() -> Result<Vec<Application>, ApplicationsError> {
	catalogue::curated()
}

#[tauri::command]
pub async fn application_search(query: String) -> Result<ApplicationSearch, ApplicationsError> {
	search(&Registries::default(), &query).await
}

#[tauri::command]
pub async fn application_installs(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
) -> Result<Vec<ApplicationInstall>, ApplicationCallError> {
	Ok(ready(&state)?.application_installs().of_conversation(conversation_id).await?)
}
