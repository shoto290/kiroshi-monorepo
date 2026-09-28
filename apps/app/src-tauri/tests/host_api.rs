use std::io::ErrorKind;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use kiroshi_app::commands::invoke_handler;
use kiroshi_app::db;
use kiroshi_app::events::{self, BUFFERED_FRAMES};
use kiroshi_app::host_api::events::SEND_PATIENCE;
use kiroshi_app::host_api::invoke::MAX_BODY_BYTES;
use kiroshi_app::routines::webhook::{self, Webhook};
use serde_json::{json, Value};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, Listener, Manager, WebviewWindow, WebviewWindowBuilder};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpSocket, TcpStream};
use tokio::time::timeout;

const SPACE: &str = "personal";

const PATIENCE: Duration = Duration::from_secs(20);

const TEXT: u8 = 0x1;

const BINARY: u8 = 0x2;

const CLOSE: u8 = 0x8;

const TRY_AGAIN_LATER: u16 = 1013;

const CHANGED: &str = "mission://changed";

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

	fn emit(&self, event: &str, payload: Value) {
		events::emit(self.app.handle(), event, payload).expect("the window took the event");
	}

	async fn emit_bulk(&self, count: usize) {
		let handle = self.app.handle().clone();
		let bulk = "x".repeat(8 * 1024);
		let emitting = tokio::task::spawn_blocking(move || {
			for order in 0..count {
				events::emit(&handle, CHANGED, json!({ "order": order, "bulk": bulk }))
					.expect("the window took the event");
			}
		});
		timeout(PATIENCE, emitting).await.expect("the emitter never blocked").expect("emitted");
	}

	fn heard_by_the_window(&self, event: &str) -> mpsc::Receiver<String> {
		let (told, hearing) = mpsc::channel();
		self.app.listen_any(event, move |heard| {
			told.send(heard.payload().to_owned()).expect("the test listens");
		});
		hearing
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

	async fn upgraded(&self, target: &str, header: &str) -> (u16, Client) {
		self.upgraded_over(
			TcpStream::connect(self.address()).await.expect("the listener answers"),
			target,
			header,
		)
		.await
	}

	async fn upgraded_over(
		&self,
		mut stream: TcpStream,
		target: &str,
		header: &str,
	) -> (u16, Client) {
		let request = format!(
			"GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n{header}\r\n"
		);
		stream.write_all(request.as_bytes()).await.expect("the upgrade lands");
		let mut head = Vec::new();
		while !head.ends_with(b"\r\n\r\n") {
			head.push(stream.read_u8().await.expect("the answer reads"));
		}
		let head = String::from_utf8_lossy(&head).into_owned();
		let status = head.split_whitespace().nth(1).expect("the answer carries a status");
		(status.parse().expect("the status is a number"), Client(stream))
	}

	async fn slow_listening(&self, token: &str) -> Client {
		let socket = TcpSocket::new_v4().expect("a socket");
		socket.set_recv_buffer_size(4096).expect("a small buffer");
		let stream =
			socket.connect(self.address().parse().expect("an address")).await.expect("connects");
		let (status, client) =
			self.upgraded_over(stream, &format!("/api/events?token={token}"), "").await;
		assert_eq!(status, 101);
		client
	}

	async fn listening(&self, token: &str) -> Client {
		let (status, client) = self.upgraded(&format!("/api/events?token={token}"), "").await;
		assert_eq!(status, 101);
		client
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

struct Client(TcpStream);

impl Client {
	async fn frame(&mut self) -> (u8, Vec<u8>) {
		timeout(PATIENCE, self.read_frame()).await.expect("a frame arrives in time")
	}

	async fn read_frame(&mut self) -> (u8, Vec<u8>) {
		let opcode = self.0.read_u8().await.expect("a frame head") & 0x0f;
		let length = match self.0.read_u8().await.expect("a frame length") & 0x7f {
			126 => u64::from(self.0.read_u16().await.expect("a 16 bit length")),
			127 => self.0.read_u64().await.expect("a 64 bit length"),
			short => u64::from(short),
		};
		let mut data = vec![0; usize::try_from(length).expect("a frame that fits")];
		self.0.read_exact(&mut data).await.expect("the frame data");
		(opcode, data)
	}

	async fn text(&mut self) -> String {
		let (opcode, data) = self.frame().await;
		assert_eq!(opcode, TEXT);
		String::from_utf8(data).expect("the frame is UTF-8")
	}

	async fn ended(&mut self) {
		let mut rest = Vec::new();
		timeout(PATIENCE, self.0.read_to_end(&mut rest))
			.await
			.expect("the host closes the connection in time")
			.expect("the connection ends cleanly");
	}

	async fn closed_by_the_host(&mut self) {
		let mut rest = Vec::new();
		let ending = timeout(PATIENCE, self.0.read_to_end(&mut rest))
			.await
			.expect("the host closes the connection in time");
		if let Err(failure) = ending {
			assert_eq!(failure.kind(), ErrorKind::ConnectionReset);
		}
	}

	async fn heard_until(mut self, last: String) {
		while self.text().await != last {}
	}

	async fn send(&mut self, opcode: u8, data: &[u8]) {
		let unmasking_key = [0; 4];
		let mut frame =
			vec![0x80 | opcode, 0x80 | u8::try_from(data.len()).expect("a short frame")];
		frame.extend_from_slice(&unmasking_key);
		frame.extend_from_slice(data);
		self.0.write_all(&frame).await.expect("the frame lands");
	}
}

fn relayed(event: &str, window_payload: &str) -> String {
	format!(r#"{{"event":"{event}","payload":{window_payload}}}"#)
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

#[tokio::test(flavor = "multi_thread")]
async fn an_upgrade_is_admitted_with_the_token_as_query_or_bearer() {
	let host = Host::new();
	let server = host.started();
	let token = host.token();

	assert_eq!(server.upgraded(&format!("/api/events?token={token}"), "").await.0, 101);
	assert_eq!(server.upgraded(&format!("/api/events?a=b&token={token}"), "").await.0, 101);
	assert_eq!(
		server.upgraded("/api/events", &format!("Authorization: Bearer {token}\r\n")).await.0,
		101
	);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_upgrade_without_the_token_is_refused() {
	let host = Host::new();
	let server = host.started();
	let wrong = format!("{}x", host.token());

	assert_eq!(server.upgraded("/api/events", "").await.0, 401);
	assert_eq!(server.upgraded("/api/events?token=", "").await.0, 401);
	assert_eq!(server.upgraded(&format!("/api/events?token={wrong}"), "").await.0, 401);
	assert_eq!(
		server.upgraded("/api/events", &format!("Authorization: Bearer {wrong}\r\n")).await.0,
		401
	);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_upgrade_from_a_foreign_host_answers_the_invoke_refusal() {
	let host = Host::new();
	let server = host.started();
	let token = host.token();
	let upgrade = format!(
		"GET /api/events?token={token} HTTP/1.1\r\nHost: attacker.example\r\nConnection: Upgrade, close\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
	);
	let invoke = format!(
		"POST /api/invoke/conversation_list HTTP/1.1\r\nHost: attacker.example\r\nConnection: close\r\nAuthorization: Bearer {token}\r\nContent-Length: 0\r\n\r\n"
	);

	let refused = server.sent(upgrade.into_bytes()).await;

	assert_eq!(refused.0, 404);
	assert_eq!(refused, server.sent(invoke.into_bytes()).await);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_client_hears_the_payload_the_window_receives() {
	let host = Host::new();
	let server = host.started();
	let mut client = server.listening(&host.token()).await;
	let window = host.heard_by_the_window(CHANGED);
	let payload = json!({ "missionId": "m1", "state": "running", "note": "é\n\"quoted\"", "at": 1.5, "none": null });

	host.emit(CHANGED, payload);

	let window_payload = window.recv_timeout(PATIENCE).expect("the window heard");
	assert_eq!(client.text().await, relayed(CHANGED, &window_payload));
}

#[tokio::test(flavor = "multi_thread")]
async fn every_client_hears_every_event_in_emit_order() {
	let host = Host::new();
	let server = host.started();
	let token = host.token();
	let mut first = server.listening(&token).await;
	let mut second = server.listening(&token).await;

	for order in 0..50 {
		host.emit(CHANGED, json!(order));
	}

	for order in 0..50 {
		assert_eq!(first.text().await, relayed(CHANGED, &order.to_string()));
		assert_eq!(second.text().await, relayed(CHANGED, &order.to_string()));
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn a_client_that_leaves_is_dropped_and_the_others_keep_hearing() {
	let host = Host::new();
	let server = host.started();
	let token = host.token();
	let leaving = server.listening(&token).await;
	let mut staying = server.listening(&token).await;
	let window = host.heard_by_the_window(CHANGED);
	drop(leaving);

	for order in 0..20 {
		host.emit(CHANGED, json!(order));
	}

	for order in 0..20 {
		assert_eq!(staying.text().await, relayed(CHANGED, &order.to_string()));
		assert_eq!(window.recv_timeout(PATIENCE).expect("the window heard"), order.to_string());
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn every_frame_a_client_sends_but_close_is_ignored() {
	let host = Host::new();
	let server = host.started();
	let mut client = server.listening(&host.token()).await;

	client.send(TEXT, b"hello").await;
	client.send(BINARY, b"\x00\x01").await;
	host.emit(CHANGED, json!("after"));

	assert_eq!(client.text().await, relayed(CHANGED, r#""after""#));

	client.send(CLOSE, &[]).await;
	host.emit(CHANGED, json!("closed"));
	client.ended().await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_client_that_falls_behind_is_closed_without_blocking_the_emitter() {
	let host = Host::new();
	let server = host.started();
	let mut client = server.slow_listening(&host.token()).await;

	host.emit_bulk(BUFFERED_FRAMES + 512).await;

	let closing = loop {
		let (opcode, data) = client.frame().await;
		if opcode == CLOSE {
			break data;
		}
	};
	assert_eq!(u16::from_be_bytes([closing[0], closing[1]]), TRY_AGAIN_LATER);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_client_that_stops_reading_is_dropped_while_the_others_keep_hearing() {
	let host = Host::new();
	let server = host.started();
	let token = host.token();
	let mut stalled = server.slow_listening(&token).await;
	let reading = server.listening(&token).await;
	let later = relayed(CHANGED, r#""later""#);
	let hearing = tokio::spawn(reading.heard_until(later));

	host.emit_bulk(BUFFERED_FRAMES - 24).await;
	tokio::time::sleep(SEND_PATIENCE + Duration::from_secs(1)).await;
	host.emit(CHANGED, json!("later"));

	timeout(PATIENCE, hearing).await.expect("the reading client heard in time").expect("heard");
	stalled.closed_by_the_host().await;
}
