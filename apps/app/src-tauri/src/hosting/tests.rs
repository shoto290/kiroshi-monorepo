use std::collections::HashSet;
use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State as Served};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::Router;
use serde_json::{json, Value};
use tauri::test::{mock_app, MockRuntime};
use tauri::{App, Listener, Manager};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

use super::bridge::LocalApi;
use super::contract::{
	HostingState, Member, MemberStatus, MembersError, CHANGED_EVENT, MEMBERS_CHANGED_EVENT,
};
use super::members::{invite, list, remove, withdraw};
use super::{resumed, signed_out, start, stop, Hosting};
use crate::spaces::commands::space_delete;
use crate::account::session::restore;
use crate::account::session::AccountSession;
use crate::db::connection::temp_dir;
use crate::db::{self, DatabaseState};
use crate::environment::contract::{EnvScope, ACCOUNT_BEARER};
use crate::environment::store;
use crate::events;

const BEARER: &str = "bearer-that-never-leaves";
const LOCAL_TOKEN: &str = "host-token-of-the-loopback";
const PERSONAL: &str = "personal";
const PATIENCE: Duration = Duration::from_secs(5);
const OWNER_EMAIL: &str = "owner@example.com";
const POLL_EVERY: Duration = Duration::from_millis(100);
const LONGER_THAN_THE_FIRST_BACKOFF: Duration = Duration::from_millis(1500);

#[derive(Clone)]
struct Relay {
	refusal: Option<StatusCode>,
	registration_delay: Arc<Mutex<Duration>>,
	is_registration_down: Arc<AtomicBool>,
	registered: Arc<Mutex<Vec<String>>>,
	known: Arc<Mutex<HashSet<String>>>,
	attempts: Arc<AtomicUsize>,
	sockets: mpsc::UnboundedSender<WebSocket>,
	members: Arc<Mutex<Vec<Value>>>,
	member_calls: Arc<Mutex<Vec<String>>>,
	member_answer: Arc<Mutex<Option<(StatusCode, Value)>>>,
}

fn cloud_member(user_id: &str, email: &str, role: &str, state: &str) -> Value {
	json!({ "userId": user_id, "email": email, "name": null, "role": role, "state": state })
}

fn member_call(relay: &Relay, call: String) -> Option<Response> {
	relay.member_calls.lock().expect("the relay").push(call);
	let forced = relay.member_answer.lock().expect("the relay").clone();
	forced.map(|(status, body)| answered_json(status, body))
}

async fn members_listed(Served(relay): Served<Relay>, headers: HeaderMap) -> Response {
	assert_eq!(bearer_of(&headers), BEARER);
	if let Some(forced) = member_call(&relay, "GET".to_owned()) {
		return forced;
	}
	answered_json(StatusCode::OK, Value::Array(relay.members.lock().expect("the relay").clone()))
}

async fn member_invited(
	Served(relay): Served<Relay>,
	headers: HeaderMap,
	body: String,
) -> Response {
	assert_eq!(bearer_of(&headers), BEARER);
	let body: Value = serde_json::from_str(&body).expect("a json body");
	let email = body["email"].as_str().expect("an email").to_owned();
	if let Some(forced) = member_call(&relay, format!("POST {email}")) {
		return forced;
	}
	let invited = cloud_member(&uuid::Uuid::new_v4().to_string(), &email, "member", "pending");
	relay.members.lock().expect("the relay").push(invited.clone());
	answered_json(StatusCode::CREATED, invited)
}

async fn member_removed(
	Served(relay): Served<Relay>,
	Path((_, user_id)): Path<(String, String)>,
	headers: HeaderMap,
) -> Response {
	assert_eq!(bearer_of(&headers), BEARER);
	if let Some(forced) = member_call(&relay, format!("DELETE {user_id}")) {
		return forced;
	}
	let mut members = relay.members.lock().expect("the relay");
	let before = members.len();
	members.retain(|member| member["userId"] != user_id.as_str());
	if members.len() == before {
		return StatusCode::NOT_FOUND.into_response();
	}
	StatusCode::NO_CONTENT.into_response()
}

async fn me() -> Response {
	answered_json(
		StatusCode::OK,
		json!({ "id": "owner", "email": OWNER_EMAIL, "createdAt": "2026-10-01T00:00:00.000Z" }),
	)
}

fn bearer_of(headers: &HeaderMap) -> &str {
	let header = headers.get("authorization").and_then(|value| value.to_str().ok());
	header.unwrap_or_default().trim_start_matches("Bearer ")
}

async fn registration(Served(relay): Served<Relay>, headers: HeaderMap, body: String) -> Response {
	let body: Value = serde_json::from_str(&body).expect("a json body");
	if bearer_of(&headers) != BEARER {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	if relay.is_registration_down.load(Ordering::SeqCst) {
		return StatusCode::SERVICE_UNAVAILABLE.into_response();
	}
	let id = uuid::Uuid::new_v4().to_string();
	relay
		.registered
		.lock()
		.expect("the relay")
		.push(body["name"].as_str().unwrap_or("").to_owned());
	let delay = *relay.registration_delay.lock().expect("the relay");
	tokio::time::sleep(delay).await;
	relay.known.lock().expect("the relay").insert(id.clone());
	answered_json(StatusCode::CREATED, json!({ "id": id, "name": body["name"], "role": "owner" }))
}

async fn host(
	Served(relay): Served<Relay>,
	Path(id): Path<String>,
	headers: HeaderMap,
	upgrade: WebSocketUpgrade,
) -> Response {
	relay.attempts.fetch_add(1, Ordering::SeqCst);
	if bearer_of(&headers) != BEARER {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	if let Some(status) = relay.refusal {
		return status.into_response();
	}
	if !relay.known.lock().expect("the relay").contains(&id) {
		return StatusCode::NOT_FOUND.into_response();
	}
	upgrade.on_upgrade(move |socket| async move {
		relay.sockets.send(socket).expect("the test holds the sockets");
	})
}

async fn invoked(Path(command): Path<String>, headers: HeaderMap, args: String) -> Response {
	let args: Value = serde_json::from_str(&args).expect("json arguments");
	if bearer_of(&headers) != LOCAL_TOKEN {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	answered_json(StatusCode::OK, json!({ "command": command, "args": args }))
}

fn answered_json(status: StatusCode, body: Value) -> Response {
	(status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

async fn served(router: Router) -> String {
	let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("the fake binds");
	let address = listener.local_addr().expect("the fake is named");
	tauri::async_runtime::spawn(async move {
		axum::serve(listener, router).await.expect("the fake serves");
	});
	format!("http://{address}")
}

struct Harness {
	app: App<MockRuntime>,
	relay: Relay,
	sockets: mpsc::UnboundedReceiver<WebSocket>,
	heard: Arc<Mutex<Vec<Value>>>,
	heard_members: Arc<Mutex<Vec<Value>>>,
}

impl Harness {
	async fn new(name: &str, refusal: Option<StatusCode>, bearer: Option<&str>) -> Self {
		Self::polling_members(name, refusal, bearer, super::members::MEMBERS_EVERY).await
	}

	async fn polling_members(
		name: &str,
		refusal: Option<StatusCode>,
		bearer: Option<&str>,
		members_every: Duration,
	) -> Self {
		let (sockets_in, sockets) = mpsc::unbounded_channel();
		let relay = Relay {
			refusal,
			registration_delay: Arc::default(),
			is_registration_down: Arc::default(),
			registered: Arc::default(),
			known: Arc::default(),
			attempts: Arc::default(),
			sockets: sockets_in,
			members: Arc::new(Mutex::new(vec![cloud_member(
				"owner",
				OWNER_EMAIL,
				"owner",
				"joined",
			)])),
			member_calls: Arc::default(),
			member_answer: Arc::default(),
		};
		let cloud = served(
			Router::new()
				.route("/instances", post(registration))
				.route("/instances/{id}/relay/host", get(host))
				.route("/instances/{id}/members", get(members_listed).post(member_invited))
				.route("/instances/{id}/members/{user_id}", delete(member_removed))
				.route("/me", get(me))
				.with_state(relay.clone()),
		)
		.await;
		let local = served(Router::new().route("/api/invoke/{command}", post(invoked))).await;
		let root =
			std::env::temp_dir().join(format!("kiroshi-hosting-{name}-{}", uuid::Uuid::new_v4()));
		if let Some(bearer) = bearer {
			store::set(&root, &EnvScope::Account, ACCOUNT_BEARER, bearer)
				.expect("the bearer is kept");
		}
		let app = mock_app();
		app.manage::<DatabaseState>(Ok(db::open(&temp_dir())));
		app.manage(AccountSession::new(Ok::<PathBuf, _>(root), &cloud));
		app.manage(
			Hosting::new(
				&cloud,
				Some(
					LocalApi::new(local, LOCAL_TOKEN.to_owned()).expect("the local client builds"),
				),
			)
			.polling_members_every(members_every),
		);
		let heard = Arc::new(Mutex::new(Vec::new()));
		let hearing = Arc::clone(&heard);
		app.listen(CHANGED_EVENT, move |event| {
			let payload = serde_json::from_str(event.payload()).expect("a json payload");
			hearing.lock().expect("the events").push(payload);
		});
		let heard_members = Arc::new(Mutex::new(Vec::new()));
		let hearing_members = Arc::clone(&heard_members);
		app.listen(MEMBERS_CHANGED_EVENT, move |event| {
			let payload = serde_json::from_str(event.payload()).expect("a json payload");
			hearing_members.lock().expect("the events").push(payload);
		});
		Self { app, relay, sockets, heard, heard_members }
	}

	async fn signed_in(name: &str) -> Self {
		Self::new(name, None, Some(BEARER)).await
	}

	fn state(&self) -> HostingState {
		self.app.state::<Hosting>().current(PERSONAL)
	}

	async fn reached(&self, expected: HostingState) {
		self.reached_by(PERSONAL, expected).await;
	}

	async fn reached_by(&self, space_id: &str, expected: HostingState) {
		let current = || self.app.state::<Hosting>().current(space_id);
		for _ in 0..500 {
			if current() == expected {
				return;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		panic!("space {space_id} stayed {:?}, never {expected:?}", current());
	}

	async fn failed(&self) -> String {
		for _ in 0..500 {
			if let HostingState::Failed { reason } = self.state() {
				return reason;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		panic!("the space stayed {:?}", self.state());
	}

	async fn started(&self) -> HostingState {
		start(self.app.handle(), PERSONAL.to_owned()).await.expect("the hosting starts")
	}

	async fn stopped(&self) -> HostingState {
		stop(self.app.handle(), PERSONAL.to_owned()).await.expect("the hosting stops")
	}

	async fn member(&mut self) -> WebSocket {
		tokio::time::timeout(PATIENCE, self.sockets.recv())
			.await
			.expect("the host connected in time")
			.expect("the relay is up")
	}

	fn attempts(&self) -> usize {
		self.relay.attempts.load(Ordering::SeqCst)
	}

	fn registered(&self) -> Vec<String> {
		self.relay.registered.lock().expect("the relay").clone()
	}

	async fn stored(&self) -> (Option<String>, Vec<String>) {
		let state = self.app.state::<DatabaseState>();
		let hosting = state.as_ref().expect("the database").space_hosting();
		let registration = hosting.registration(PERSONAL.to_owned()).await.expect("the row");
		(registration.instance_id, hosting.hosted_space_ids().await.expect("the flags"))
	}

	async fn plant(&self, instance_id: &str) {
		let state = self.app.state::<DatabaseState>();
		let hosting = state.as_ref().expect("the database").space_hosting();
		hosting.registered(PERSONAL.to_owned(), instance_id.to_owned()).await.expect("planted");
	}

	fn heard_kinds(&self) -> Vec<String> {
		let heard = self.heard.lock().expect("the events");
		heard
			.iter()
			.inspect(|change| assert_eq!(change["spaceId"], PERSONAL))
			.map(|change| change["state"]["kind"].as_str().expect("a kind").to_owned())
			.collect()
	}

	async fn heard_until(&self, is_heard: impl Fn(&[String]) -> bool) -> Vec<String> {
		for _ in 0..500 {
			let kinds = self.heard_kinds();
			if is_heard(&kinds) {
				return kinds;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		self.heard_kinds()
	}
}

async fn next_text(member: &mut WebSocket, wanted: impl Fn(&Value) -> bool) -> Value {
	loop {
		let frame = tokio::time::timeout(PATIENCE, member.recv())
			.await
			.expect("a frame in time")
			.expect("the socket is open")
			.expect("a readable frame");
		if let Message::Text(text) = frame {
			let frame: Value = serde_json::from_str(text.as_str()).expect("a json frame");
			if wanted(&frame) {
				return frame;
			}
		}
	}
}

async fn answer(member: &mut WebSocket) -> Value {
	next_text(member, |frame| frame.get("event").is_none()).await
}

async fn send(member: &mut WebSocket, text: &str) {
	member.send(Message::Text(text.into())).await.expect("the member frame leaves");
}

fn run(test: impl std::future::Future<Output = ()>) {
	tauri::async_runtime::block_on(test);
}

#[test]
fn a_first_start_registers_once_and_a_later_start_reuses_the_instance() {
	run(async {
		let mut harness = Harness::signed_in("reuse").await;

		assert_eq!(harness.started().await, HostingState::Connecting);
		let _first = harness.member().await;
		harness.reached(HostingState::Online).await;
		let (registered, flagged) = harness.stored().await;
		harness.stopped().await;
		harness.started().await;
		let _second = harness.member().await;
		harness.reached(HostingState::Online).await;

		assert_eq!(harness.registered(), vec!["Personal".to_owned()]);
		assert!(harness
			.relay
			.known
			.lock()
			.expect("the relay")
			.contains(&registered.clone().expect("an id")));
		assert_eq!(flagged, vec![PERSONAL.to_owned()]);
		assert_eq!(harness.stored().await.0, registered);
		assert_eq!(harness.attempts(), 2);
	});
}

#[test]
fn an_instance_the_relay_forgot_is_registered_anew_and_replaced() {
	run(async {
		let mut harness = Harness::signed_in("forgotten").await;
		let forgotten = uuid::Uuid::new_v4().to_string();
		harness.plant(&forgotten).await;

		harness.started().await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		let (stored, _) = harness.stored().await;
		assert_eq!(harness.registered().len(), 1);
		assert_ne!(stored.as_deref(), Some(forgotten.as_str()));
		assert_eq!(harness.attempts(), 2);
	});
}

#[test]
fn without_a_bearer_the_space_needs_a_sign_in_and_nothing_is_called() {
	run(async {
		let harness = Harness::new("no-bearer", None, None).await;

		assert_eq!(harness.started().await, HostingState::NeedsSignIn);

		assert!(harness.registered().is_empty());
		assert_eq!(harness.attempts(), 0);
		assert_eq!(harness.heard_until(|kinds| !kinds.is_empty()).await, vec!["needsSignIn"]);
	});
}

#[test]
fn a_bearer_the_relay_refuses_needs_a_sign_in_and_is_not_retried() {
	run(async {
		let harness = Harness::new("revoked", Some(StatusCode::UNAUTHORIZED), Some(BEARER)).await;

		harness.started().await;
		harness.reached(HostingState::NeedsSignIn).await;
		tokio::time::sleep(LONGER_THAN_THE_FIRST_BACKOFF).await;

		assert_eq!(harness.attempts(), 1);
		assert_eq!(harness.state(), HostingState::NeedsSignIn);
	});
}

#[test]
fn an_instance_owned_by_another_account_fails_naming_403_and_is_not_retried() {
	run(async {
		let harness = Harness::new("forbidden", Some(StatusCode::FORBIDDEN), Some(BEARER)).await;

		harness.started().await;
		let reason = harness.failed().await;
		tokio::time::sleep(LONGER_THAN_THE_FIRST_BACKOFF).await;

		assert!(reason.contains("403"), "{reason}");
		assert_eq!(harness.attempts(), 1);
	});
}

#[test]
fn a_host_replaced_by_another_fails_naming_4001_and_does_not_reconnect() {
	run(async {
		let mut harness = Harness::signed_in("replaced").await;
		harness.started().await;
		let mut member = harness.member().await;
		harness.reached(HostingState::Online).await;

		let close = CloseFrame { code: 4001, reason: "Host replaced".into() };
		member.send(Message::Close(Some(close))).await.expect("the close leaves");
		let reason = harness.failed().await;
		tokio::time::sleep(LONGER_THAN_THE_FIRST_BACKOFF).await;

		assert!(reason.contains("4001"), "{reason}");
		assert_eq!(harness.attempts(), 1);
	});
}

#[test]
fn a_dropped_socket_reconnects_after_the_first_backoff() {
	run(async {
		let mut harness = Harness::signed_in("dropped").await;
		harness.started().await;
		let member = harness.member().await;
		harness.reached(HostingState::Online).await;

		drop(member);
		harness.reached(HostingState::Connecting).await;
		let _again = harness.member().await;
		harness.reached(HostingState::Online).await;

		let heard = harness.heard_until(|kinds| kinds.len() >= 4).await;

		assert_eq!(heard, vec!["connecting", "online", "connecting", "online"]);
		assert_eq!(harness.attempts(), 2);
	});
}

#[test]
fn a_member_call_reaches_the_local_api_with_the_host_token_and_its_answer_comes_back() {
	run(async {
		let mut harness = Harness::signed_in("invoke").await;
		harness.started().await;
		let mut member = harness.member().await;

		send(&mut member, r#"{"id": "c1", "command": "space_list", "args": {"a": 1}}"#).await;

		assert_eq!(
			answer(&mut member).await,
			json!({
				"id": "c1",
				"status": 200,
				"body": { "command": "space_list", "args": { "a": 1 } }
			})
		);
	});
}

#[test]
fn a_malformed_member_frame_is_answered_400_and_the_socket_stays_open() {
	run(async {
		let mut harness = Harness::signed_in("malformed").await;
		harness.started().await;
		let mut member = harness.member().await;

		send(&mut member, r#"{"id": "m1", "command": 7}"#).await;
		let refused = answer(&mut member).await;
		send(&mut member, r#"{"id": "m2", "command": "space_list"}"#).await;
		let answered = answer(&mut member).await;

		assert_eq!((refused["id"].clone(), refused["status"].clone()), (json!("m1"), json!(400)));
		assert_eq!((answered["id"].clone(), answered["status"].clone()), (json!("m2"), json!(200)));
		assert_eq!(harness.state(), HostingState::Online);
	});
}

#[test]
fn a_member_frame_naming_a_host_member_command_is_refused_and_others_still_forwarded() {
	run(async {
		let mut harness = Harness::signed_in("host-only").await;
		harness.started().await;
		let mut member = harness.member().await;

		for command in [
			"hosting_members",
			"hosting_invite_member",
			"hosting_withdraw_invitation",
			"hosting_remove_member",
		] {
			let frame =
				json!({ "id": command, "command": command, "args": { "spaceId": PERSONAL } });
			send(&mut member, &frame.to_string()).await;
			assert_eq!(
				answer(&mut member).await,
				json!({ "id": command, "status": 403, "body": { "error": "this command belongs to the host" } })
			);
		}
		send(&mut member, r#"{"id": "after", "command": "space_list"}"#).await;
		let answered = answer(&mut member).await;

		assert_eq!(
			(answered["id"].clone(), answered["status"].clone()),
			(json!("after"), json!(200))
		);
		assert!(
			harness.member_calls().iter().all(|call| call == "GET"),
			"{:?}",
			harness.member_calls()
		);
	});
}

#[test]
fn a_local_event_is_forwarded_to_the_relay() {
	run(async {
		let mut harness = Harness::signed_in("event").await;
		harness.started().await;
		let mut member = harness.member().await;
		send(&mut member, r#"{"id": "warm", "command": "space_list"}"#).await;
		answer(&mut member).await;

		events::emit(harness.app.handle(), "test://forwarded", json!({ "n": 1 })).expect("emitted");
		let forwarded =
			next_text(&mut member, |frame| frame["event"].to_string().contains("test://forwarded"))
				.await;

		assert!(forwarded["event"].to_string().contains(r#""n":1"#), "{forwarded}");
	});
}

#[test]
fn the_first_member_announcement_of_an_online_space_sends_nothing_on_the_relay() {
	run(async {
		let mut harness = Harness::signed_in("members-local").await;
		harness.started().await;
		let mut member = harness.member().await;
		harness.reached(HostingState::Online).await;
		for _ in 0..500 {
			if !harness.heard_member_lists().is_empty() {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		assert_eq!(harness.heard_member_lists().len(), 1);

		events::emit(harness.app.handle(), "test://after-members", json!(1)).expect("emitted");
		let first = next_text(&mut member, |_| true).await;

		assert_eq!(first, json!({ "event": { "event": "test://after-members", "payload": 1 } }));
	});
}

#[test]
fn stopping_closes_with_1000_clears_the_flag_and_keeps_the_instance() {
	run(async {
		let mut harness = Harness::signed_in("stop").await;
		harness.started().await;
		let mut member = harness.member().await;
		harness.reached(HostingState::Online).await;
		let (registered, _) = harness.stored().await;

		assert_eq!(harness.stopped().await, HostingState::Off);
		let closed = tokio::time::timeout(PATIENCE, member.recv()).await.expect("a frame in time");

		let Some(Ok(Message::Close(Some(close)))) = closed else {
			panic!("the relay took no close frame: {closed:?}");
		};
		assert_eq!(close.code, 1000);
		assert_eq!(harness.stored().await, (registered, Vec::new()));
		let heard = harness.heard_until(|kinds| kinds.last().is_some_and(|kind| kind == "off")).await;
		assert_eq!(heard.last().map(String::as_str), Some("off"));
	});
}

#[test]
fn a_second_start_answers_the_current_state_without_another_socket() {
	run(async {
		let mut harness = Harness::signed_in("twice").await;
		harness.started().await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		assert_eq!(harness.started().await, HostingState::Online);
		tokio::time::sleep(Duration::from_millis(200)).await;

		assert_eq!(harness.attempts(), 1);
	});
}

#[test]
fn signing_out_closes_the_relay_and_needs_a_sign_in_keeping_the_flag() {
	run(async {
		let mut harness = Harness::signed_in("signed-out").await;
		harness.started().await;
		let mut member = harness.member().await;
		harness.reached(HostingState::Online).await;

		signed_out(harness.app.handle()).await;
		let closed = tokio::time::timeout(PATIENCE, member.recv()).await.expect("a frame in time");

		assert!(matches!(closed, Some(Ok(Message::Close(_)))), "{closed:?}");
		assert_eq!(harness.state(), HostingState::NeedsSignIn);
		assert_eq!(harness.stored().await.1, vec![PERSONAL.to_owned()]);
	});
}

#[test]
fn a_flagged_space_comes_back_online_when_the_account_is_restored() {
	run(async {
		let mut harness = Harness::signed_in("resumed").await;
		let known = uuid::Uuid::new_v4().to_string();
		harness.relay.known.lock().expect("the relay").insert(known.clone());
		harness.plant(&known).await;

		resumed(harness.app.handle()).await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		assert!(harness.registered().is_empty());
	});
}

#[test]
fn a_registration_refused_401_needs_a_sign_in_and_opens_no_socket() {
	run(async {
		let harness = Harness::new("register-revoked", None, Some("bearer-the-cloud-forgot")).await;

		harness.started().await;
		harness.reached(HostingState::NeedsSignIn).await;

		assert!(harness.registered().is_empty());
		assert_eq!(harness.attempts(), 0);
		assert_eq!(harness.stored().await, (None, vec![PERSONAL.to_owned()]));
	});
}

#[test]
fn a_stop_during_registration_keeps_the_answered_instance_and_a_later_start_reuses_it() {
	run(async {
		let mut harness = Harness::signed_in("stop-registering").await;
		*harness.relay.registration_delay.lock().expect("the relay") = Duration::from_millis(400);

		harness.started().await;
		while harness.registered().is_empty() {
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		assert_eq!(harness.stopped().await, HostingState::Off);
		let (kept, flagged) = harness.stored().await;
		harness.started().await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		let kept = kept.expect("the answered instance was stored");
		assert!(harness.relay.known.lock().expect("the relay").contains(&kept));
		assert!(flagged.is_empty());
		assert_eq!(harness.registered().len(), 1);
		assert_eq!(harness.stored().await.0, Some(kept));
		assert_eq!(harness.attempts(), 1);
	});
}

#[test]
fn deleting_a_hosted_space_closes_its_relay_with_1000_and_reads_off() {
	run(async {
		let mut harness = Harness::signed_in("deleted").await;
		let work = {
			let state = harness.app.state::<DatabaseState>();
			let database = state.as_ref().expect("the database");
			database.spaces().create("Work".to_owned()).await.expect("the space").id
		};
		start(harness.app.handle(), work.clone()).await.expect("the hosting starts");
		let mut member = harness.member().await;
		harness.reached_by(&work, HostingState::Online).await;

		space_delete(harness.app.handle().clone(), harness.app.state(), work.clone())
			.await
			.expect("the space is deleted");
		let closed = tokio::time::timeout(PATIENCE, member.recv()).await.expect("a frame in time");

		let Some(Ok(Message::Close(Some(close)))) = closed else {
			panic!("the relay took no close frame: {closed:?}");
		};
		assert_eq!(close.code, 1000);
		assert_eq!(harness.app.state::<Hosting>().current(&work), HostingState::Off);
		let state = harness.app.state::<DatabaseState>();
		let hosting = state.as_ref().expect("the database").space_hosting();
		assert!(hosting.hosted_space_ids().await.expect("the flags").is_empty());
	});
}

#[test]
fn a_first_start_persists_the_intent_before_registering() {
	run(async {
		let harness = Harness::signed_in("intent").await;
		harness.relay.is_registration_down.store(true, Ordering::SeqCst);

		assert_eq!(harness.started().await, HostingState::Connecting);

		assert_eq!(harness.stored().await, (None, vec![PERSONAL.to_owned()]));
		assert!(harness.registered().is_empty());
	});
}

#[test]
fn a_space_whose_registration_never_succeeded_is_resumed_and_registered() {
	run(async {
		let mut harness = Harness::signed_in("intent-resumed").await;
		let state = harness.app.state::<DatabaseState>();
		let hosting = state.as_ref().expect("the database").space_hosting();
		hosting.set_hosted(PERSONAL.to_owned(), true).await.expect("the intent is kept");

		resumed(harness.app.handle()).await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		assert_eq!(harness.registered(), vec!["Personal".to_owned()]);
		assert!(harness.stored().await.0.is_some());
	});
}

const INSTANCE: &str = "6f1c2a7e-0d4b-4c9a-9a51-2f7f3f1d8c10";

impl Harness {
	async fn hosted(name: &str) -> Self {
		let harness = Self::signed_in(name).await;
		harness.plant(INSTANCE).await;
		harness
	}

	fn seed(&self, members: &[Value]) {
		self.relay.members.lock().expect("the relay").extend_from_slice(members);
	}

	fn member_calls(&self) -> Vec<String> {
		self.relay.member_calls.lock().expect("the relay").clone()
	}

	fn forget_member_calls(&self) {
		self.relay.member_calls.lock().expect("the relay").clear();
	}

	fn cloud_answers(&self, status: StatusCode, body: Value) {
		*self.relay.member_answer.lock().expect("the relay") = Some((status, body));
	}

	fn heard_member_lists(&self) -> Vec<Value> {
		let heard = self.heard_members.lock().expect("the events");
		heard
			.iter()
			.inspect(|change| assert_eq!(change["spaceId"], PERSONAL))
			.map(|change| change["members"].clone())
			.collect()
	}

	async fn listed(&self) -> Result<Vec<Member>, MembersError> {
		list(self.app.handle(), PERSONAL.to_owned()).await
	}

	async fn invited(&self, email: &str) -> Result<Member, MembersError> {
		invite(self.app.handle(), PERSONAL.to_owned(), email.to_owned()).await
	}

	async fn withdrawn(&self, user_id: &str) -> Result<Vec<Member>, MembersError> {
		withdraw(self.app.handle(), PERSONAL.to_owned(), user_id.to_owned()).await
	}

	async fn removed(&self, user_id: &str) -> Result<Vec<Member>, MembersError> {
		remove(self.app.handle(), PERSONAL.to_owned(), user_id.to_owned()).await
	}

	async fn listed_with_a_guest_and_a_joiner(&self) {
		self.seed(&[
			cloud_member("guest", "guest@example.com", "member", "pending"),
			cloud_member("joiner", "joiner@example.com", "member", "joined"),
		]);
		self.listed().await.expect("the members list");
		self.forget_member_calls();
	}
}

fn member(user_id: &str, email: &str, status: MemberStatus) -> Member {
	Member { user_id: user_id.to_owned(), name: None, email: email.to_owned(), status }
}

fn user_ids(members: &[Member]) -> Vec<&str> {
	members.iter().map(|member| member.user_id.as_str()).collect()
}

#[test]
fn the_members_are_listed_in_the_cloud_order_with_a_status_each() {
	run(async {
		let harness = Harness::hosted("members-list").await;
		harness.seed(&[
			json!({ "userId": "joiner", "email": "joiner@example.com", "name": "Joiner", "role": "member", "state": "joined" }),
			cloud_member("guest", "guest@example.com", "member", "pending"),
		]);

		let members = harness.listed().await.expect("the members list");

		assert_eq!(
			members,
			vec![
				member("owner", OWNER_EMAIL, MemberStatus::Host),
				Member {
					name: Some("Joiner".to_owned()),
					..member("joiner", "joiner@example.com", MemberStatus::Joined)
				},
				member("guest", "guest@example.com", MemberStatus::Pending),
			]
		);
		assert_eq!(harness.member_calls(), vec!["GET"]);
	});
}

#[test]
fn an_invite_is_trimmed_lowercased_posted_and_answered_pending_with_the_list_read_back() {
	run(async {
		let harness = Harness::hosted("members-invite").await;

		let invited = harness.invited("  Ada@Example.COM ").await.expect("the invite lands");

		assert_eq!(invited.email, "ada@example.com");
		assert_eq!(invited.status, MemberStatus::Pending);
		assert_eq!(harness.member_calls(), vec!["POST ada@example.com", "GET"]);
		let heard = harness.heard_member_lists();
		assert_eq!(heard.len(), 1);
		assert_eq!(heard[0][1]["email"], "ada@example.com");
		assert_eq!(heard[0][1]["status"], "pending");
	});
}

#[test]
fn a_pending_member_is_withdrawn_and_a_joined_one_removed_each_read_back() {
	run(async {
		let harness = Harness::hosted("members-end").await;
		harness.listed_with_a_guest_and_a_joiner().await;

		let withdrawn = harness.withdrawn("guest").await.expect("the invitation is withdrawn");
		let removed = harness.removed("joiner").await.expect("the member is removed");

		assert_eq!(user_ids(&withdrawn), vec!["owner", "joiner"]);
		assert_eq!(user_ids(&removed), vec!["owner"]);
		assert_eq!(
			harness.member_calls(),
			vec!["GET", "DELETE guest", "GET", "GET", "DELETE joiner", "GET"]
		);
		let heard = harness.heard_member_lists();
		assert_eq!(heard.len(), 3);
		assert_eq!(
			heard[2],
			json!([{ "userId": "owner", "name": null, "email": OWNER_EMAIL, "status": "host" }])
		);
	});
}

#[test]
fn what_is_not_an_email_is_refused_before_the_cloud_and_a_cloud_400_alike() {
	run(async {
		let harness = Harness::hosted("members-not-email").await;

		assert_eq!(harness.invited("ada@").await, Err(MembersError::NotAnEmail));
		assert!(harness.member_calls().is_empty());

		harness.cloud_answers(
			StatusCode::BAD_REQUEST,
			json!({ "error": { "code": "INVALID_EMAIL" } }),
		);
		assert_eq!(harness.invited("ada@example.com").await, Err(MembersError::NotAnEmail));
		assert_eq!(harness.member_calls(), vec!["POST ada@example.com"]);
	});
}

#[test]
fn the_own_account_email_is_refused_before_the_cloud() {
	run(async {
		let harness = Harness::hosted("members-own").await;
		restore(harness.app.handle().clone()).await;

		assert_eq!(harness.invited(" Owner@Example.com").await, Err(MembersError::OwnAccount));
		assert!(harness.member_calls().is_empty());
	});
}

#[test]
fn the_cloud_conflicts_are_typed_refusals() {
	run(async {
		let harness = Harness::hosted("members-conflicts").await;

		for (code, refusal) in [
			("ALREADY_MEMBER", MembersError::AlreadyInvited),
			("MEMBER_LIMIT_REACHED", MembersError::LimitReached),
		] {
			harness.cloud_answers(StatusCode::CONFLICT, json!({ "error": { "code": code } }));
			assert_eq!(harness.invited("ada@example.com").await, Err(refusal));
		}
		assert!(harness.heard_member_lists().is_empty());
	});
}

#[test]
fn a_status_mismatch_the_host_or_an_unknown_member_is_refused_from_a_fresh_read_without_delete() {
	run(async {
		let harness = Harness::hosted("members-mismatch").await;
		harness.listed_with_a_guest_and_a_joiner().await;

		assert_eq!(harness.withdrawn("joiner").await, Err(MembersError::NotPending));
		assert_eq!(harness.removed("guest").await, Err(MembersError::NotJoined));
		assert_eq!(harness.withdrawn("owner").await, Err(MembersError::HostNotRemovable));
		assert_eq!(harness.removed("owner").await, Err(MembersError::HostNotRemovable));
		assert_eq!(harness.removed("stranger").await, Err(MembersError::UnknownMember));
		assert_eq!(harness.withdrawn("stranger").await, Err(MembersError::UnknownMember));
		assert_eq!(harness.member_calls(), vec!["GET"; 6]);
	});
}

#[test]
fn withdraw_and_remove_succeed_on_a_space_never_listed_in_this_process() {
	run(async {
		let harness = Harness::hosted("members-never-listed").await;
		harness.seed(&[
			cloud_member("guest", "guest@example.com", "member", "pending"),
			cloud_member("joiner", "joiner@example.com", "member", "joined"),
		]);

		let withdrawn = harness.withdrawn("guest").await.expect("the invitation is withdrawn");
		let removed = harness.removed("joiner").await.expect("the member is removed");

		assert_eq!(user_ids(&withdrawn), vec!["owner", "joiner"]);
		assert_eq!(user_ids(&removed), vec!["owner"]);
		assert_eq!(
			harness.member_calls(),
			vec!["GET", "DELETE guest", "GET", "GET", "DELETE joiner", "GET"]
		);
	});
}

#[test]
fn the_status_is_decided_on_the_cloud_list_not_on_a_stale_one() {
	run(async {
		let harness = Harness::hosted("members-stale").await;
		harness.listed_with_a_guest_and_a_joiner().await;
		for member in harness.relay.members.lock().expect("the relay").iter_mut() {
			if member["userId"] == "guest" {
				member["state"] = json!("joined");
			}
		}

		assert_eq!(harness.withdrawn("guest").await, Err(MembersError::NotPending));
		let removed = harness.removed("guest").await.expect("the now joined guest is removed");

		assert_eq!(user_ids(&removed), vec!["owner", "joiner"]);
		assert_eq!(harness.member_calls(), vec!["GET", "GET", "DELETE guest", "GET"]);
	});
}

#[test]
fn a_space_without_an_instance_refuses_every_member_command_before_the_cloud() {
	run(async {
		let harness = Harness::signed_in("members-not-hosting").await;

		assert_eq!(harness.listed().await, Err(MembersError::NotHosting));
		assert_eq!(harness.invited("ada@example.com").await, Err(MembersError::NotHosting));
		assert_eq!(harness.withdrawn("guest").await, Err(MembersError::NotHosting));
		assert_eq!(harness.removed("joiner").await, Err(MembersError::NotHosting));
		assert!(harness.member_calls().is_empty());
	});
}

#[test]
fn a_cloud_401_needs_a_sign_in() {
	run(async {
		let harness = Harness::hosted("members-revoked").await;
		harness.listed_with_a_guest_and_a_joiner().await;
		harness.cloud_answers(StatusCode::UNAUTHORIZED, json!({}));

		assert_eq!(harness.listed().await, Err(MembersError::NeedsSignIn));
		assert_eq!(harness.invited("ada@example.com").await, Err(MembersError::NeedsSignIn));
		assert_eq!(harness.withdrawn("guest").await, Err(MembersError::NeedsSignIn));
		assert_eq!(harness.removed("joiner").await, Err(MembersError::NeedsSignIn));
	});
}

#[test]
fn a_5xx_or_an_unreadable_list_is_unreachable_with_its_cause() {
	run(async {
		let harness = Harness::hosted("members-5xx").await;

		harness.cloud_answers(StatusCode::SERVICE_UNAVAILABLE, json!({}));
		let Err(MembersError::Unreachable { reason }) = harness.listed().await else {
			panic!("a 503 is unreachable");
		};
		assert!(reason.contains("503"), "{reason}");

		harness.cloud_answers(StatusCode::OK, json!({ "members": [] }));
		let Err(MembersError::Unreachable { reason }) = harness.listed().await else {
			panic!("an unreadable list is unreachable");
		};
		assert!(reason.contains("did not parse"), "{reason}");
	});
}

#[test]
fn an_unreachable_cloud_is_unreachable_with_its_cause() {
	run(async {
		let closed = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
		let address = closed.local_addr().expect("the port is named");
		drop(closed);
		let root =
			std::env::temp_dir().join(format!("kiroshi-hosting-down-{}", uuid::Uuid::new_v4()));
		store::set(&root, &EnvScope::Account, ACCOUNT_BEARER, BEARER).expect("the bearer is kept");
		let cloud = format!("http://{address}");
		let app = mock_app();
		app.manage::<DatabaseState>(Ok(db::open(&temp_dir())));
		app.manage(AccountSession::new(Ok::<PathBuf, _>(root), &cloud));
		app.manage(Hosting::new(&cloud, None));
		let state = app.state::<DatabaseState>();
		let hosting = state.as_ref().expect("the database").space_hosting();
		hosting.registered(PERSONAL.to_owned(), INSTANCE.to_owned()).await.expect("planted");

		let listed = list(app.handle(), PERSONAL.to_owned()).await;

		let Err(MembersError::Unreachable { reason }) = listed else {
			panic!("a closed port is unreachable, not {listed:?}");
		};
		assert!(reason.contains("could not be reached"), "{reason}");
	});
}

#[test]
fn an_online_space_polls_its_members_and_announces_only_a_changed_list() {
	run(async {
		let mut harness =
			Harness::polling_members("members-poll", None, Some(BEARER), POLL_EVERY).await;
		harness.started().await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		let polled_a_few_times = || harness.member_calls().len() >= 4;
		for _ in 0..500 {
			if polled_a_few_times() {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		assert!(polled_a_few_times(), "{:?}", harness.member_calls());
		assert_eq!(harness.heard_member_lists().len(), 1);

		harness.seed(&[cloud_member("guest", "guest@example.com", "member", "pending")]);
		for _ in 0..500 {
			if harness.heard_member_lists().len() == 2 {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		let heard = harness.heard_member_lists();
		assert_eq!(heard.len(), 2);
		assert_eq!(heard[1][1]["userId"], "guest");
	});
}

#[test]
fn an_online_space_polls_its_members_at_once_before_the_fifteen_seconds() {
	run(async {
		let mut harness = Harness::signed_in("members-at-once").await;
		harness.started().await;
		let _member = harness.member().await;
		harness.reached(HostingState::Online).await;

		for _ in 0..500 {
			if !harness.heard_member_lists().is_empty() {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}

		assert_eq!(harness.heard_member_lists().len(), 1);
		assert_eq!(harness.member_calls(), vec!["GET"]);
	});
}

#[test]
fn the_members_are_polled_every_fifteen_seconds() {
	assert_eq!(Hosting::new("http://127.0.0.1:9", None).members_every, Duration::from_secs(15));
}

#[test]
fn a_space_that_is_not_online_does_not_poll_its_members() {
	run(async {
		let harness =
			Harness::polling_members("members-offline", None, Some(BEARER), POLL_EVERY).await;
		harness.plant(INSTANCE).await;

		tokio::time::sleep(POLL_EVERY * 3).await;

		assert!(harness.member_calls().is_empty());
	});
}
