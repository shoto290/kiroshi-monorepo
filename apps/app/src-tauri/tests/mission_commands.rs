use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;

use kiroshi_app::commands::invoke_handler;
use kiroshi_app::db;
use kiroshi_app::missions::commands::CHANGED_EVENT;
use kiroshi_app::missions::contract::{MissionDraft, Ticket};
use serde_json::{json, Value};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, WebviewWindow, WebviewWindowBuilder};

const BOT: &str = "default";

struct Home {
	dir: PathBuf,
	app: App<MockRuntime>,
}

impl Home {
	fn new() -> Self {
		static CLAIMED: AtomicUsize = AtomicUsize::new(0);
		let mut context = mock_context(noop_assets());
		context.config_mut().identifier = format!(
			"com.kiroshi.mission-commands-{}-{}",
			std::process::id(),
			CLAIMED.fetch_add(1, Ordering::Relaxed)
		);
		let app =
			mock_builder().invoke_handler(invoke_handler()).build(context).expect("app builds");
		app.manage(db::bootstrap(app.handle()));
		let dir = app.path().app_data_dir().expect("data dir");
		Self { dir, app }
	}
}

impl Drop for Home {
	fn drop(&mut self) {
		let _ = std::fs::remove_dir_all(&self.dir);
	}
}

fn window(app: &App<MockRuntime>) -> WebviewWindow<MockRuntime> {
	WebviewWindowBuilder::new(app, "main", Default::default()).build().expect("window builds")
}

fn call(window: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
	tauri::test::get_ipc_response(
		window,
		InvokeRequest {
			cmd: cmd.into(),
			callback: tauri::ipc::CallbackFn(0),
			error: tauri::ipc::CallbackFn(1),
			url: "tauri://localhost".parse().expect("url"),
			body: body.into(),
			headers: Default::default(),
			invoke_key: INVOKE_KEY.to_string(),
		},
	)
	.map(|response| response.deserialize::<Value>().expect("the answer is JSON"))
	.map_err(|error| serde_json::to_value(error).expect("the error is JSON"))
}

fn a_mission(home: &Home, window: &WebviewWindow<MockRuntime>) -> String {
	let chat = call(window, "conversation_main_chat", json!({ "botId": BOT })).expect("the chat");
	let draft = MissionDraft {
		origin_conversation_id: chat["id"].as_str().expect("the chat holds an id").to_owned(),
		bot_id: BOT.to_owned(),
		objective: "Fix the crash".to_owned(),
		ticket: Ticket {
			platform: "github".to_owned(),
			external_id: "42".to_owned(),
			url: "https://kiroshi.test/tickets/42".to_owned(),
			title: "Crash on open".to_owned(),
		},
		tools: vec![],
		source: "bot".to_owned(),
		workspace_path: None,
	};
	let state = home.app.state::<db::DatabaseState>();
	let database = state.as_ref().expect("the database opens");
	tauri::async_runtime::block_on(database.missions().open(draft, "a-key".to_owned()))
		.expect("the mission opens")
		.id
}

fn changes_of(home: &Home) -> mpsc::Receiver<Value> {
	let (sender, received) = mpsc::channel();
	home.app.listen(CHANGED_EVENT, move |event| {
		let change = serde_json::from_str(event.payload()).expect("the payload is JSON");
		sender.send(change).expect("the test still listens");
	});
	received
}

#[test]
fn reopening_a_closed_mission_brings_it_back_to_working_and_tells_the_front() {
	let home = Home::new();
	let window = window(&home.app);
	let mission_id = a_mission(&home, &window);
	let closed = call(
		&window,
		"mission_close",
		json!({
			"missionId": mission_id,
			"closing": { "source": "person", "outcome": "done", "summary": "Settled by hand" },
		}),
	)
	.expect("the mission closes");
	let changes = changes_of(&home);

	let reopened =
		call(&window, "mission_reopen", json!({ "missionId": mission_id })).expect("it reopens");

	assert_eq!(reopened["state"], json!("working"));
	assert_eq!(reopened["closedAt"], Value::Null);
	assert!(
		reopened["stateSeq"].as_i64() > closed["stateSeq"].as_i64(),
		"the reopen did not move the state seq: {reopened}"
	);
	assert_eq!(
		changes.try_iter().collect::<Vec<_>>(),
		vec![json!({
			"missionId": mission_id,
			"state": "working",
			"stateSeq": reopened["stateSeq"],
			"isAgentRunning": false,
			"lastActivityAt": null,
		})],
		"the front was not told the mission reopened"
	);
	let detail = call(&window, "mission_detail", json!({ "missionId": mission_id }))
		.expect("the mission reads");
	let last = detail["events"].as_array().and_then(|events| events.last()).cloned();
	assert_eq!(
		last.map(|event| (event["kind"].clone(), event["source"].clone())),
		Some((json!("reopened"), json!("person"))),
	);
}

#[test]
fn reopening_a_mission_still_open_or_unknown_is_refused() {
	let home = Home::new();
	let window = window(&home.app);
	let mission_id = a_mission(&home, &window);

	let still_open = call(&window, "mission_reopen", json!({ "missionId": mission_id }));
	let unknown = call(&window, "mission_reopen", json!({ "missionId": "nobody" }));

	assert_eq!(still_open, Err(json!({ "kind": "missionStillOpen", "id": mission_id })));
	assert_eq!(unknown, Err(json!({ "kind": "unknownMission", "id": "nobody" })));
}
