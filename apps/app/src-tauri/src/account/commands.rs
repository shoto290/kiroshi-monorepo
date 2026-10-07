use tauri::{AppHandle, Runtime, State};

use super::contract::{AccountError, AccountState};
use super::session::{self, AccountSession};

#[tauri::command]
#[specta::specta]
pub fn account_state(session: State<'_, AccountSession>) -> AccountState {
	session.current()
}

#[tauri::command]
#[specta::specta]
pub async fn account_sign_in<R: Runtime>(
	app: AppHandle<R>,
	email: String,
) -> Result<(), AccountError> {
	session::sign_in(&app, email.trim().to_owned()).await
}

#[tauri::command]
#[specta::specta]
pub async fn account_sign_out<R: Runtime>(app: AppHandle<R>) -> Result<(), AccountError> {
	session::sign_out(&app).await
}
