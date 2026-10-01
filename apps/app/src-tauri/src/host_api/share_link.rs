use std::sync::{Mutex, MutexGuard, PoisonError};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::db;
use crate::events;
use crate::joined_spaces::link;
use crate::spaces::contract::SpaceError;

pub const HOST_PRESENCE_EVENT: &str = "host://presence";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ShareLink {
	Up { link: String },
	#[default]
	Down,
}

impl ShareLink {
	fn is_up(&self) -> bool {
		matches!(self, ShareLink::Up { .. })
	}
}

#[derive(Debug, Clone, Copy, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HostPresence {
	pub is_up: bool,
}

#[derive(Default)]
pub struct HeldShareLink(Mutex<ShareLink>);

impl HeldShareLink {
	fn kept(&self) -> MutexGuard<'_, ShareLink> {
		self.0.lock().unwrap_or_else(PoisonError::into_inner)
	}
}

fn ready(state: &db::DatabaseState) -> Result<&db::Database, SpaceError> {
	state.as_ref().map_err(|failure| SpaceError::Unavailable { failure: failure.into() })
}

#[tauri::command]
#[specta::specta]
pub async fn host_share_link<R: Runtime>(
	app: AppHandle<R>,
	state: State<'_, db::DatabaseState>,
	space_id: String,
) -> Result<ShareLink, SpaceError> {
	let ShareLink::Up { link: held_link } = held(&app).kept().clone() else {
		return Ok(ShareLink::Down);
	};
	let spaces = ready(&state)?.spaces().list().await?;
	let space = spaces
		.into_iter()
		.find(|space| space.id == space_id)
		.ok_or(SpaceError::UnknownSpace { id: space_id })?;
	Ok(ShareLink::Up { link: held_link + &link::space_parts(&space.id, &space.name) })
}

pub fn shared<R: Runtime>(app: &AppHandle<R>, link: String) {
	answered(app, ShareLink::Up { link });
}

pub fn withdrawn<R: Runtime>(app: &AppHandle<R>) {
	answered(app, ShareLink::Down);
}

fn answered<R: Runtime>(app: &AppHandle<R>, answer: ShareLink) {
	let held = held(app);
	let mut kept = held.kept();
	let presence = HostPresence { is_up: answer.is_up() };
	let was_up = kept.is_up();
	*kept = answer;
	if was_up == presence.is_up {
		return;
	}
	if let Err(failure) = events::emit(app, HOST_PRESENCE_EVENT, presence) {
		eprintln!("the host presence was not announced: {failure}");
	}
}

fn held<R: Runtime>(app: &AppHandle<R>) -> State<'_, HeldShareLink> {
	if app.try_state::<HeldShareLink>().is_none() {
		app.manage(HeldShareLink::default());
	}
	app.state::<HeldShareLink>()
}

#[cfg(test)]
mod tests {
	use std::sync::mpsc;
	use std::time::Duration;

	use tauri::test::{mock_app, MockRuntime};
	use tauri::{App, Listener};

	use super::*;
	use crate::conversations::contract::StorageFailure;
	use crate::db::connection::temp_dir;
	use crate::db::DatabaseError;
	use crate::joined_spaces::commands::joined_space_add;

	const LINK: &str = "http://127.0.0.1:1420/#host=http://127.0.0.1:45367&token=secret";

	fn a_host() -> App<MockRuntime> {
		let app = mock_app();
		app.manage::<db::DatabaseState>(Ok(db::open(&temp_dir())));
		app
	}

	async fn a_space(app: &App<MockRuntime>, name: &str) -> String {
		let state = app.state::<db::DatabaseState>();
		let database = ready(&state).expect("the database opens");
		database.spaces().create(name.to_owned()).await.expect("the space lands").id
	}

	async fn share_link_of(
		app: &App<MockRuntime>,
		space_id: &str,
	) -> Result<ShareLink, SpaceError> {
		host_share_link(app.handle().clone(), app.state(), space_id.to_owned()).await
	}

	fn announcements(app: &App<MockRuntime>) -> mpsc::Receiver<String> {
		let (heard, hearing) = mpsc::channel();
		app.listen(HOST_PRESENCE_EVENT, move |event| {
			heard.send(event.payload().to_owned()).expect("the test still listens");
		});
		hearing
	}

	fn heard(hearing: &mpsc::Receiver<String>) -> Vec<String> {
		std::iter::from_fn(|| hearing.recv_timeout(Duration::from_millis(200)).ok()).collect()
	}

	#[tokio::test]
	async fn no_link_is_answered_for_any_space_before_the_host_shares_one() {
		let app = a_host();

		assert_eq!(share_link_of(&app, "personal").await, Ok(ShareLink::Down));
		assert_eq!(share_link_of(&app, "nowhere").await, Ok(ShareLink::Down));
	}

	#[tokio::test]
	async fn the_shared_link_names_the_space_until_it_is_withdrawn() {
		let app = a_host();

		shared(app.handle(), LINK.to_owned());
		let up = share_link_of(&app, "personal").await;
		withdrawn(app.handle());
		let down = share_link_of(&app, "personal").await;

		let link = format!("{LINK}&space=personal&name=Personal");
		assert_eq!(up, Ok(ShareLink::Up { link }));
		assert_eq!(down, Ok(ShareLink::Down));
	}

	#[tokio::test]
	async fn the_space_name_is_percent_encoded_in_the_link() {
		let app = a_host();
		let id = a_space(&app, "Studio & Co =#%+é").await;
		shared(app.handle(), LINK.to_owned());

		let answer = share_link_of(&app, &id).await;

		let link = format!("{LINK}&space={id}&name=Studio%20%26%20Co%20%3D%23%25%2B%C3%A9");
		assert_eq!(answer, Ok(ShareLink::Up { link }));
	}

	#[tokio::test]
	async fn the_space_name_round_trips_through_a_joined_space() {
		let app = a_host();
		let id = a_space(&app, "Studio & Co").await;
		shared(app.handle(), LINK.to_owned());

		let Ok(ShareLink::Up { link }) = share_link_of(&app, &id).await else {
			panic!("the link is shared");
		};
		let joined =
			joined_space_add(app.handle().clone(), app.state(), link, None).await.expect("the add");

		assert_eq!(joined.name, "Studio & Co");
		assert_eq!(joined.remote_space_id, Some(id));
	}

	#[tokio::test]
	async fn an_unknown_space_is_refused_by_its_id_and_answers_no_link() {
		let app = a_host();
		shared(app.handle(), LINK.to_owned());

		let answer = share_link_of(&app, "nowhere").await;

		assert_eq!(answer, Err(SpaceError::UnknownSpace { id: "nowhere".to_owned() }));
	}

	#[tokio::test]
	async fn an_unavailable_database_is_answered_as_a_storage_failure() {
		let app = mock_app();
		app.manage::<db::DatabaseState>(Err(DatabaseError::AppDataDir));
		shared(app.handle(), LINK.to_owned());

		let answer = share_link_of(&app, "personal").await;

		let failure = StorageFailure::from(&DatabaseError::AppDataDir);
		assert_eq!(answer, Err(SpaceError::Unavailable { failure }));
	}

	#[test]
	fn the_presence_is_announced_once_per_change_and_never_carries_the_link() {
		let app = mock_app();
		let hearing = announcements(&app);

		withdrawn(app.handle());
		shared(app.handle(), LINK.to_owned());
		shared(app.handle(), LINK.to_owned());
		withdrawn(app.handle());
		withdrawn(app.handle());

		assert_eq!(heard(&hearing), vec![r#"{"isUp":true}"#, r#"{"isUp":false}"#]);
	}

	#[test]
	fn the_answer_names_its_kind_and_only_up_carries_the_link() {
		let up = serde_json::to_value(ShareLink::Up { link: LINK.to_owned() }).expect("serializes");
		let down = serde_json::to_value(ShareLink::Down).expect("serializes");

		assert_eq!(up, serde_json::json!({ "kind": "up", "link": LINK }));
		assert_eq!(down, serde_json::json!({ "kind": "down" }));
	}
}
