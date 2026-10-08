use tauri::{AppHandle, Runtime};

use super::contract::{Invitation, InvitationError};
use crate::joined_spaces::contract::JoinedSpace;

#[tauri::command]
#[specta::specta]
pub async fn invitations_list<R: Runtime>(
	app: AppHandle<R>,
) -> Result<Vec<Invitation>, InvitationError> {
	super::read(&app).await
}

#[tauri::command]
#[specta::specta]
pub async fn invitation_accept<R: Runtime>(
	app: AppHandle<R>,
	instance_id: String,
) -> Result<JoinedSpace, InvitationError> {
	super::accept(&app, instance_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn invitation_decline<R: Runtime>(
	app: AppHandle<R>,
	instance_id: String,
) -> Result<(), InvitationError> {
	super::decline(&app, instance_id).await
}
