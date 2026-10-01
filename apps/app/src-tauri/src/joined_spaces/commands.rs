use serde::Serialize;
use tauri::{AppHandle, Runtime, State};

use super::contract::{JoinedSpace, JoinedSpaceConnection, JoinedSpaceError};
use super::link;
use crate::db;
use crate::events;

pub const CHANGED_EVENT: &str = "joined-space://changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinedSpaceChanged {
	pub id: String,
}

fn ready(state: &db::DatabaseState) -> Result<&db::Database, JoinedSpaceError> {
	state.as_ref().map_err(|failure| JoinedSpaceError::Unavailable { failure: failure.into() })
}

fn announce_change<R: Runtime>(app: &AppHandle<R>, id: String) -> Result<(), JoinedSpaceError> {
	events::emit(app, CHANGED_EVENT, JoinedSpaceChanged { id })
		.map_err(|error| JoinedSpaceError::Undeliverable { detail: error.to_string() })
}

#[tauri::command]
#[specta::specta]
pub async fn joined_spaces_list(
	state: State<'_, db::DatabaseState>,
) -> Result<Vec<JoinedSpace>, JoinedSpaceError> {
	let stored = ready(&state)?.joined_spaces().list().await?;
	Ok(stored.into_iter().map(JoinedSpace::from).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn joined_space_add<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	link: String,
	name: Option<String>,
) -> Result<JoinedSpace, JoinedSpaceError> {
	let candidate = link::joined_space(&link, uuid::Uuid::new_v4().to_string(), name)?;
	let joined = ready(&state)?.joined_spaces().join(candidate).await?;
	announce_change(&app, joined.id.clone())?;
	Ok(joined.into())
}

#[tauri::command]
#[specta::specta]
pub async fn joined_space_connect(
	state: State<'_, db::DatabaseState>,
	id: String,
) -> Result<JoinedSpaceConnection, JoinedSpaceError> {
	let found = ready(&state)?.joined_spaces().find(id.clone()).await?;
	found.map(JoinedSpaceConnection::from).ok_or(JoinedSpaceError::UnknownJoinedSpace { id })
}

#[tauri::command]
#[specta::specta]
pub async fn joined_space_remove<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	id: String,
) -> Result<(), JoinedSpaceError> {
	if !ready(&state)?.joined_spaces().remove(id.clone()).await? {
		return Err(JoinedSpaceError::UnknownJoinedSpace { id });
	}
	announce_change(&app, id)
}

#[cfg(test)]
mod tests {
	use std::path::Path;
	use std::sync::mpsc::{channel, Receiver};

	use serde_json::{json, Value};
	use tauri::test::{mock_app, MockRuntime};
	use tauri::{App, Listener, Manager};

	use super::*;
	use crate::db::connection::temp_dir;
	use crate::joined_spaces::contract::LinkPart;

	const TOKEN: &str = "the-secret-token";

	fn link(host: &str, space: Option<&str>) -> String {
		let space = space.map_or(String::new(), |space| format!("&space={space}"));
		format!("http://127.0.0.1:1420/#host={host}&token={TOKEN}{space}")
	}

	fn app_over(dir: &Path) -> App<MockRuntime> {
		let app = mock_app();
		app.manage::<db::DatabaseState>(Ok(db::open(dir)));
		app
	}

	fn heard(app: &App<MockRuntime>) -> Receiver<String> {
		let (told, hearing) = channel();
		app.listen_any(CHANGED_EVENT, move |event| {
			told.send(event.payload().to_owned()).expect("the test listens");
		});
		hearing
	}

	async fn add(app: &App<MockRuntime>, link: String) -> Result<JoinedSpace, JoinedSpaceError> {
		joined_space_add(app.handle().clone(), app.state(), link, None).await
	}

	async fn list(app: &App<MockRuntime>) -> Vec<JoinedSpace> {
		joined_spaces_list(app.state()).await.expect("the list")
	}

	#[tokio::test]
	async fn an_added_joined_space_is_listed_after_the_database_is_reopened() {
		let dir = temp_dir();
		let added = {
			let app = app_over(&dir);
			add(&app, link("http://127.0.0.1:45367", Some("remote-1"))).await.expect("the add")
		};

		let app = app_over(&dir);

		assert_eq!(added.host_url, "http://127.0.0.1:45367");
		assert_eq!(added.remote_space_id.as_deref(), Some("remote-1"));
		assert_eq!(added.name, "127.0.0.1:45367");
		assert_eq!(list(&app).await, vec![added]);
	}

	#[tokio::test]
	async fn a_joined_space_added_twice_replaces_the_first_and_keeps_its_id() {
		let dir = temp_dir();
		let app = app_over(&dir);
		let first = add(&app, link("http://h.test", None)).await.expect("the first add");

		let second = joined_space_add(
			app.handle().clone(),
			app.state(),
			"x#host=http://h.test&token=fresh".to_owned(),
			Some("Renamed".to_owned()),
		)
		.await
		.expect("the second add");

		assert_eq!(second, JoinedSpace { name: "Renamed".to_owned(), ..first.clone() });
		assert_eq!(list(&app).await, vec![second]);
		let connection = joined_space_connect(app.state(), first.id).await.expect("the connection");
		assert_eq!(connection.token, "fresh");
	}

	#[tokio::test]
	async fn a_refused_joined_space_link_names_its_part_and_persists_nothing() {
		let dir = temp_dir();
		let app = app_over(&dir);
		let hearing = heard(&app);

		for (link, part) in [
			("http://x/", LinkPart::Fragment),
			("http://x/#host=notaurl", LinkPart::Host),
			("http://x/#host=http://h.test&token=", LinkPart::Token),
		] {
			let refusal = add(&app, link.to_owned()).await.expect_err("the refusal");
			assert!(
				matches!(refusal, JoinedSpaceError::RefusedLink { part: refused, .. } if refused == part)
			);
		}

		assert!(list(&app).await.is_empty());
		assert!(hearing.try_recv().is_err());
	}

	#[tokio::test]
	async fn joined_space_list_add_and_event_carry_no_token_but_connect_does() {
		let dir = temp_dir();
		let app = app_over(&dir);
		let hearing = heard(&app);

		let added = add(&app, link("http://h.test", None)).await.expect("the add");

		let answered = serde_json::to_string(&added).expect("serialized");
		let listed = serde_json::to_string(&list(&app).await).expect("serialized");
		let payload = hearing.recv().expect("the change was heard");
		for output in [&answered, &listed, &payload] {
			assert!(!output.contains(TOKEN));
			assert!(!output.contains("token"));
		}
		assert_eq!(
			serde_json::from_str::<Value>(&payload).expect("json"),
			json!({ "id": added.id })
		);
		let connection =
			joined_space_connect(app.state(), added.id.clone()).await.expect("the connection");
		assert_eq!(connection.token, TOKEN);
		assert_eq!(connection.host_url, added.host_url);
	}

	#[tokio::test]
	async fn a_removed_joined_space_is_announced_and_an_unknown_one_is_not_found() {
		let dir = temp_dir();
		let app = app_over(&dir);
		let added = add(&app, link("http://h.test", None)).await.expect("the add");
		let hearing = heard(&app);

		joined_space_remove(app.handle().clone(), app.state(), added.id.clone())
			.await
			.expect("the removal");

		assert!(list(&app).await.is_empty());
		let payload = hearing.recv().expect("the removal was heard");
		assert_eq!(
			serde_json::from_str::<Value>(&payload).expect("json"),
			json!({ "id": added.id })
		);
		assert_eq!(
			joined_space_remove(app.handle().clone(), app.state(), added.id.clone()).await,
			Err(JoinedSpaceError::UnknownJoinedSpace { id: added.id.clone() })
		);
		assert_eq!(
			joined_space_connect(app.state(), added.id.clone()).await.map(|found| found.id),
			Err(JoinedSpaceError::UnknownJoinedSpace { id: added.id })
		);
	}
}
