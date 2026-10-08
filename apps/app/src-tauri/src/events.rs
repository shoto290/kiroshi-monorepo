use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::sync::broadcast;

pub const BUFFERED_FRAMES: usize = 1024;

pub type Frame = Arc<str>;

pub struct Relay(broadcast::Sender<Frame>);

impl Default for Relay {
	fn default() -> Self {
		Self(broadcast::channel(BUFFERED_FRAMES).0)
	}
}

pub fn emit<R: Runtime, S: Serialize + Clone>(
	app: &AppHandle<R>,
	event: &str,
	payload: S,
) -> tauri::Result<()> {
	publish(&relay(app), event, &payload);
	app.emit(event, payload)
}

pub fn subscribed<R: Runtime>(app: &AppHandle<R>) -> broadcast::Receiver<Frame> {
	relay(app).0.subscribe()
}

fn relay<R: Runtime>(app: &AppHandle<R>) -> State<'_, Relay> {
	if app.try_state::<Relay>().is_none() {
		app.manage(Relay::default());
	}
	app.state::<Relay>()
}

fn publish<S: Serialize>(relay: &Relay, event: &str, payload: &S) {
	if relay.0.receiver_count() == 0 {
		return;
	}
	match framed(event, payload) {
		Ok(frame) => {
			if relay.0.send(frame).is_err() {
				eprintln!("the event {event} found no host api client left to reach");
			}
		}
		Err(failure) => {
			eprintln!("the event {event} did not serialize for the host api: {failure}")
		}
	}
}

fn framed<S: Serialize>(event: &str, payload: &S) -> serde_json::Result<Frame> {
	let event = serde_json::to_string(event)?;
	let payload = serde_json::to_string(payload)?;
	Ok(format!(r#"{{"event":{event},"payload":{payload}}}"#).into())
}

#[cfg(test)]
pub(crate) mod tests {
	use std::fs;
	use std::path::{Path, PathBuf};

	use serde::ser::Error;
	use serde::Serializer;
	use tauri::test::{mock_app, MockRuntime};
	use tauri::{App, Listener};

	use super::*;

	const FAN_OUT: &str = "src/events.rs";

	#[derive(Clone)]
	struct Unserializable;

	impl Serialize for Unserializable {
		fn serialize<S: Serializer>(&self, _: S) -> Result<S::Ok, S::Error> {
			Err(S::Error::custom("refused"))
		}
	}

	pub(crate) fn rust_files(dir: &Path) -> Vec<PathBuf> {
		fs::read_dir(dir)
			.expect("the source dir reads")
			.map(|entry| entry.expect("an entry").path())
			.flat_map(|path| match path.is_dir() {
				true => rust_files(&path),
				false => vec![path],
			})
			.filter(|path| path.extension().is_some_and(|extension| extension == "rs"))
			.collect()
	}

	fn reaches_the_emitter(source: &str) -> bool {
		let names_it =
			source.split(|c: char| !c.is_alphanumeric() && c != '_').any(|word| word == "Emitter");
		let compact: String = source.split_whitespace().collect();
		names_it || compact.contains("usetauri::*")
	}

	#[test]
	fn only_the_fan_out_reaches_the_emitter() {
		let root = Path::new(env!("CARGO_MANIFEST_DIR"));
		let importers: Vec<PathBuf> = rust_files(&root.join("src"))
			.into_iter()
			.filter(|path| reaches_the_emitter(&fs::read_to_string(path).expect("the file reads")))
			.map(|path| path.strip_prefix(root).expect("under the root").to_owned())
			.collect();

		assert_eq!(importers, vec![PathBuf::from(FAN_OUT)]);
	}

	#[test]
	fn a_multi_line_import_is_seen() {
		assert!(reaches_the_emitter("use tauri::{\n\tAppHandle,\n\tEmitter,\n};"));
		assert!(!reaches_the_emitter("use tauri::{AppHandle, EventEmitter};"));
	}

	#[test]
	fn a_path_call_or_a_glob_is_seen() {
		assert!(reaches_the_emitter("tauri::Emitter::emit(&app, \"x\", 1);"));
		assert!(reaches_the_emitter("use tauri::*;"));
		assert!(reaches_the_emitter("pub use tauri :: * ;"));
		assert!(!reaches_the_emitter("use tauri::{AppHandle, Manager};"));
	}

	#[test]
	fn a_frame_carries_the_name_and_the_payload() {
		let frame = framed("mission://changed", &serde_json::json!({ "a": 1 })).expect("a frame");
		assert_eq!(&*frame, r#"{"event":"mission://changed","payload":{"a":1}}"#);
	}

	#[test]
	fn an_unserializable_payload_reaches_no_client_and_is_still_handed_to_the_window() {
		let app: App<MockRuntime> = mock_app();
		let mut heard = subscribed(app.handle());

		assert!(emit(app.handle(), "user://first-run-done", Unserializable).is_err());
		assert!(heard.try_recv().is_err());
	}

	#[test]
	fn without_a_client_the_window_still_hears() {
		let app: App<MockRuntime> = mock_app();
		let (told, hearing) = std::sync::mpsc::channel();
		app.listen_any("user://first-run-done", move |event| {
			told.send(event.payload().to_owned()).expect("the test listens");
		});

		emit(app.handle(), "user://first-run-done", 7).expect("emitted");

		assert_eq!(hearing.recv().expect("the window heard"), "7");
	}
}
