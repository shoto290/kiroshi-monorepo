use std::sync::{Mutex, MutexGuard, PoisonError};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::events;

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

#[tauri::command]
#[specta::specta]
pub fn host_share_link<R: Runtime>(app: AppHandle<R>) -> ShareLink {
	held(&app).kept().clone()
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

	const LINK: &str = "http://127.0.0.1:1420/#host=http://127.0.0.1:45367&token=secret";

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

	#[test]
	fn no_link_is_answered_before_the_host_shares_one() {
		let app = mock_app();

		assert_eq!(host_share_link(app.handle().clone()), ShareLink::Down);
	}

	#[test]
	fn the_shared_link_is_answered_until_it_is_withdrawn() {
		let app = mock_app();

		shared(app.handle(), LINK.to_owned());
		let up = host_share_link(app.handle().clone());
		withdrawn(app.handle());
		let down = host_share_link(app.handle().clone());

		assert_eq!(up, ShareLink::Up { link: LINK.to_owned() });
		assert_eq!(down, ShareLink::Down);
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
