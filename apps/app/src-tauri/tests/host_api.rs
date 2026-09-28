use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use kiroshi_app::commands::invoke_handler;
use kiroshi_app::db;
use kiroshi_app::host_api::invoke::MAX_BODY_BYTES;
use kiroshi_app::routines::webhook::{self, Webhook};
use serde_json::{json, Value};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, Manager, WebviewWindow, WebviewWindowBuilder};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

const SPACE: &str = "personal";

struct Host {
	app: App<MockRuntime>,
	dir: PathBuf,
}

impl Host {
	fn new() -> Self {
		static CLAIMED: AtomicUsize = AtomicUsize::new(0);
		let mut context = mock_context(noop_assets());
		context.config_mut().identifier = format!(
			"com.kiroshi.host-api-{}-{}",
			std::process::id(),
			CLAIMED.fetch_add(1, Ordering::Relaxed)
		);
		let app =
			mock_builder().invoke_handler(invoke_handler()).build(context).expect("app builds");
		let dir = app.path().app_data_dir().expect("data dir");
		app.manage(db::bootstrap(app.handle()));
		Self { app, dir }
	}

	fn window(&self) -> WebviewWindow<MockRuntime> {
		WebviewWindowBuilder::new(&self.app, "main", Default::default())
			.build()
			.expect("window builds")
	}

	fn started(&self) -> Server {
		Server(webhook::start(self.app.handle().clone()))
	}

	fn token_path(&self) -> PathBuf {
		self.dir.join("host").join("token")
	}

	fn token(&self) -> String {
		std::fs::read_to_string(self.token_path()).expect("the token is on disk")
	}
}

impl Drop for Host {
	fn drop(&mut self) {
		let _ = std::fs::remove_dir_all(&self.dir);
	}
}

struct Server(Webhook);

impl Server {
	fn address(&self) -> String {
		let url = self.0.url().expect("the server bound an address");
		url.trim_start_matches("http://")
			.split('/')
			.next()
			.expect("the url names a host")
			.to_owned()
	}

	async fn invoke(&self, command: &str, token: Option<&str>, body: &str) -> (u16, String) {
		let mut request = format!(
			"POST /api/invoke/{command} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nContent-Length: {}\r\n",
			body.len()
		);
		if let Some(token) = token {
			request.push_str(&format!("Authorization: Bearer {token}\r\n"));
		}
		request.push_str("\r\n");
		request.push_str(body);
		self.sent(request.into_bytes()).await
	}

	async fn sent(&self, request: Vec<u8>) -> (u16, String) {
		let mut stream = TcpStream::connect(self.address()).await.expect("the listener answers");
		stream.write_all(&request).await.expect("the request lands");
		let mut answer = Vec::new();
		stream.read_to_end(&mut answer).await.expect("the answer reads");
		let answer = String::from_utf8_lossy(&answer).into_owned();
		let (head, body) = answer.split_once("\r\n\r\n").expect("the answer carries a body");
		let status = head.split_whitespace().nth(1).expect("the answer carries a status");
		(status.parse().expect("the status is a number"), body.to_owned())
	}
}

impl Drop for Server {
	fn drop(&mut self) {
		self.0.stop();
	}
}

fn direct(window: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
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

fn parsed(body: &str) -> Value {
	serde_json::from_str(body).expect("the body is JSON")
}

fn listed() -> String {
	json!({ "spaceId": SPACE }).to_string()
}

#[tokio::test(flavor = "multi_thread")]
async fn a_call_without_authorization_is_refused() {
	let host = Host::new();
	let _window = host.window();
	let server = host.started();

	assert_eq!(server.invoke("conversation_list", None, &listed()).await.0, 401);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_call_with_a_wrong_token_is_refused() {
	let host = Host::new();
	let _window = host.window();
	let server = host.started();
	let wrong = format!("{}x", host.token());

	assert_eq!(server.invoke("conversation_list", Some(&wrong), &listed()).await.0, 401);
	assert_eq!(server.invoke("conversation_list", Some(""), &listed()).await.0, 401);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_unregistered_command_answers_not_found() {
	let host = Host::new();
	let _window = host.window();
	let server = host.started();
	let token = host.token();

	assert_eq!(server.invoke("no_such_command", Some(&token), "{}").await.0, 404);
	assert_eq!(server.invoke("plugin:dialog|open", Some(&token), "{}").await.0, 404);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_oversized_body_is_refused_before_any_command_runs() {
	let host = Host::new();
	let _window = host.window();
	let server = host.started();
	let request = format!(
		"POST /api/invoke/conversation_create HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nAuthorization: Bearer {}\r\nContent-Length: {}\r\n\r\n",
		host.token(),
		MAX_BODY_BYTES + 1
	);

	assert_eq!(server.sent(request.into_bytes()).await.0, 413);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_foreign_host_is_refused() {
	let host = Host::new();
	let _window = host.window();
	let server = host.started();
	let body = listed();
	let request = format!(
		"POST /api/invoke/conversation_list HTTP/1.1\r\nHost: attacker.example\r\nConnection: close\r\nAuthorization: Bearer {}\r\nContent-Length: {}\r\n\r\n{body}",
		host.token(),
		body.len()
	);

	assert_eq!(server.sent(request.into_bytes()).await.0, 404);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_read_answers_the_json_the_front_receives() {
	let host = Host::new();
	let window = host.window();
	let server = host.started();
	direct(&window, "conversation_main_chat", json!({ "botId": "default" })).expect("a chat");

	let (status, body) = server.invoke("conversation_list", Some(&host.token()), &listed()).await;

	assert_eq!(status, 200);
	assert_eq!(
		parsed(&body),
		direct(&window, "conversation_list", json!({ "spaceId": SPACE })).expect("the rooms")
	);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_write_is_seen_by_the_next_read() {
	let host = Host::new();
	let window = host.window();
	let server = host.started();
	let token = host.token();
	direct(&window, "conversation_main_chat", json!({ "botId": "default" })).expect("a chat");
	let draft =
		json!({ "spaceId": SPACE, "sectionId": null, "title": "Over HTTP", "botIds": ["default"] });

	let (status, created) =
		server.invoke("conversation_create", Some(&token), &draft.to_string()).await;
	assert_eq!(status, 200, "{created}");
	let id = parsed(&created)["id"].as_str().expect("the room holds an id").to_owned();
	let (_, rooms) = server.invoke("conversation_list", Some(&token), &listed()).await;
	assert!(parsed(&rooms).as_array().expect("a list").iter().any(|room| room["id"] == json!(id)));

	let deleted = json!({ "conversationId": id }).to_string();
	assert_eq!(
		server.invoke("conversation_delete", Some(&token), &deleted).await,
		(200, "null".to_owned())
	);
	let (_, rooms) = server.invoke("conversation_list", Some(&token), &listed()).await;
	assert!(!parsed(&rooms).as_array().expect("a list").iter().any(|room| room["id"] == json!(id)));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_rejected_command_answers_the_error_the_front_receives() {
	let host = Host::new();
	let window = host.window();
	let server = host.started();
	let edit =
		json!({ "conversationId": "nowhere", "title": "t", "instructions": "", "sectionId": null });

	let (status, body) =
		server.invoke("conversation_update", Some(&host.token()), &edit.to_string()).await;

	assert_eq!(status, 500);
	assert_eq!(Err(parsed(&body)), direct(&window, "conversation_update", edit));
}

#[tokio::test(flavor = "multi_thread")]
async fn without_the_desktop_window_a_command_answers_desktop_only() {
	let host = Host::new();
	let server = host.started();

	let (status, body) = server.invoke("conversation_list", Some(&host.token()), &listed()).await;

	assert_eq!(status, 503);
	assert!(body.starts_with("desktop-only"));
}

#[tokio::test(flavor = "multi_thread")]
async fn the_token_is_private_and_reused_across_starts() {
	let host = Host::new();
	let _window = host.window();
	let first = host.started();
	let token = host.token();
	drop(first);

	let mode = std::fs::metadata(host.token_path()).expect("the token file").permissions().mode();
	assert_eq!(mode & 0o777, 0o600);
	assert!(token.len() >= 32);

	let second = host.started();
	assert_eq!(host.token(), token);
	assert_eq!(second.invoke("conversation_list", Some(&token), &listed()).await.0, 200);
}
