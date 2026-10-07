use tauri::{AppHandle, Runtime, State};

use super::contract::HostingState;
use super::Hosting;
use crate::spaces::contract::SpaceError;

#[tauri::command]
#[specta::specta]
pub async fn hosting_start<R: Runtime>(
	app: AppHandle<R>,
	space_id: String,
) -> Result<HostingState, SpaceError> {
	super::start(&app, space_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn hosting_stop<R: Runtime>(
	app: AppHandle<R>,
	space_id: String,
) -> Result<HostingState, SpaceError> {
	super::stop(&app, space_id).await
}

#[tauri::command]
#[specta::specta]
pub fn hosting_state(hosting: State<'_, Hosting>, space_id: String) -> HostingState {
	hosting.current(&space_id)
}
