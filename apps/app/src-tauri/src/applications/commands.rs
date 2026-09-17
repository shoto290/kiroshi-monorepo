use std::sync::Arc;

use tauri::State;

use super::catalogue;
use super::contract::{
	Application, ApplicationInstall, ApplicationSearch, ApplicationsError, ApplicationCallError,
	InstallRefusal,
};
use super::directory::Directory;
use super::registry::REGISTRY;
use super::runnable::{refusal, Runners};
use super::search::{named, search};
use crate::conversations::commands::ready;
use crate::db;

#[tauri::command]
pub async fn application_catalogue() -> Result<Vec<Application>, ApplicationsError> {
	catalogue::curated()
}

#[tauri::command]
pub async fn application_search(
	directory: State<'_, Arc<Directory>>,
	query: String,
) -> Result<ApplicationSearch, ApplicationsError> {
	search(REGISTRY, &directory, &query).await
}

#[tauri::command]
pub async fn application_named(
	directory: State<'_, Arc<Directory>>,
	name: String,
) -> Result<Option<Application>, ApplicationsError> {
	named(REGISTRY, &directory, &name).await
}

#[tauri::command]
pub async fn application_runnable(config: serde_json::Value) -> Option<InstallRefusal> {
	refusal(&Runners::default(), &config).await
}

#[tauri::command]
pub async fn application_installs(
	state: State<'_, db::DatabaseState>,
	conversation_id: String,
) -> Result<Vec<ApplicationInstall>, ApplicationCallError> {
	Ok(ready(&state)?.application_installs().of_conversation(conversation_id).await?)
}
