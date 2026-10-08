use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State as Served};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::test::{mock_app, MockRuntime};
use tauri::{App, Listener, Manager};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

use super::contract::{InvitationError, CHANGED_EVENT};
use super::{accept, decline, read, resumed, Invitations};
use crate::account::session::{sign_out, AccountSession};
use crate::db::connection::temp_dir;
use crate::db::repositories::joined_spaces::{JoinedReach, JoinedSpace};
use crate::db::{self, DatabaseError, DatabaseState};
use crate::environment::contract::{EnvScope, ACCOUNT_BEARER};
use crate::environment::store;
use crate::joined_spaces::commands::{
	joined_space_add, joined_space_connect, CHANGED_EVENT as JOINED_CHANGED, REMOVED_EVENT,
};
use crate::joined_spaces::contract::{JoinedSpaceConnection, JoinedSpaceError};
use crate::joined_spaces::relay::RelayGuests;

const BEARER: &str = "bearer-that-never-leaves";
const INSTANCE: &str = "instance-1";
const SHARED_SPACE: &str = "shared-space-of-the-host";
const PATIENCE: Duration = Duration::from_secs(5);

#[derive(Clone)]
struct Cloud {
	invitations: Arc<Mutex<Value>>,
	invitations_status: Arc<Mutex<StatusCode>>,
	call_answer: Arc<Mutex<(StatusCode, Value)>>,
	called: Arc<Mutex<Vec<String>>>,
	unknown_instances: Arc<Mutex<Vec<String>>>,
	call_delay: Arc<Mutex<Duration>>,
	is_refusing_members: Arc<AtomicBool>,
	members: mpsc::UnboundedSender<WebSocket>,
}

fn an_invitation(instance_id: &str, name: &str) -> Value {
	json!({
		"instanceId": instance_id,
		"instanceName": name,
		"inviterEmail": "owner@example.com",
		"invitedAt": "2026-10-01T00:00:00.000Z"
	})
}

fn answered_json(status: StatusCode, body: &Value) -> Response {
	(status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

fn refusal(status: StatusCode, code: &str) -> (StatusCode, Value) {
	(status, json!({ "error": { "code": code, "message": code, "status": status.as_u16() } }))
}

fn is_bearer(headers: &HeaderMap) -> bool {
	headers.get("authorization").and_then(|value| value.to_str().ok())
		== Some(&format!("Bearer {BEARER}"))
}

async fn invitations_listed(Served(cloud): Served<Cloud>, headers: HeaderMap) -> Response {
	if !is_bearer(&headers) {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	let status = *cloud.invitations_status.lock().expect("the cloud");
	let invitations = cloud.invitations.lock().expect("the cloud").clone();
	answered_json(status, &invitations)
}

async fn invitation_called(
	Served(cloud): Served<Cloud>,
	Path((instance_id, verb)): Path<(String, String)>,
	headers: HeaderMap,
) -> Response {
	if !is_bearer(&headers) {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	cloud.called.lock().expect("the cloud").push(format!("{verb} {instance_id}"));
	let delay = *cloud.call_delay.lock().expect("the cloud");
	tokio::time::sleep(delay).await;
	let (status, body) = cloud.call_answer.lock().expect("the cloud").clone();
	if status == StatusCode::NO_CONTENT {
		return status.into_response();
	}
	answered_json(status, &body)
}

async fn member_relay(
	Served(cloud): Served<Cloud>,
	Path(instance_id): Path<String>,
	headers: HeaderMap,
	upgrade: WebSocketUpgrade,
) -> Response {
	if !is_bearer(&headers) || cloud.is_refusing_members.load(Ordering::SeqCst) {
		return StatusCode::UNAUTHORIZED.into_response();
	}
	if cloud.unknown_instances.lock().expect("the cloud").contains(&instance_id) {
		return StatusCode::NOT_FOUND.into_response();
	}
	upgrade.on_upgrade(move |socket| async move {
		cloud.members.send(socket).expect("the test holds the member sockets");
	})
}

async fn signed_out_of_the_cloud() -> StatusCode {
	StatusCode::OK
}

async fn served(router: Router) -> String {
	let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("the fake binds");
	let address = listener.local_addr().expect("the fake is named");
	tauri::async_runtime::spawn(async move {
		axum::serve(listener, router).await.expect("the fake serves");
	});
	format!("http://{address}")
}

async fn a_closed_port() -> String {
	let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
	let address = listener.local_addr().expect("the port is named");
	drop(listener);
	format!("http://{address}")
}

struct Harness {
	app: App<MockRuntime>,
	cloud: Cloud,
	members: mpsc::UnboundedReceiver<WebSocket>,
	heard: Arc<Mutex<Vec<(String, String)>>>,
	root: PathBuf,
}

impl Harness {
	async fn new(bearer: Option<&str>) -> Self {
		Self::over(bearer, None, Ok(())).await
	}

	async fn over(
		bearer: Option<&str>,
		api_url: Option<String>,
		database: Result<(), DatabaseError>,
	) -> Self {
		let (members_in, members) = mpsc::unbounded_channel();
		let cloud = Cloud {
			invitations: Arc::new(Mutex::new(json!([an_invitation(INSTANCE, "Studio")]))),
			invitations_status: Arc::new(Mutex::new(StatusCode::OK)),
			call_answer: Arc::new(Mutex::new((
				StatusCode::OK,
				json!({ "id": INSTANCE, "name": "Studio", "role": "member", "createdAt": "2026-10-01T00:00:00.000Z" }),
			))),
			called: Arc::default(),
			unknown_instances: Arc::default(),
			call_delay: Arc::default(),
			is_refusing_members: Arc::default(),
			members: members_in,
		};
		let served_url = served(
			Router::new()
				.route("/invitations", get(invitations_listed))
				.route("/invitations/{id}/{verb}", post(invitation_called))
				.route("/instances/{id}/relay/member", get(member_relay))
				.route("/api/auth/sign-out", post(signed_out_of_the_cloud))
				.with_state(cloud.clone()),
		)
		.await;
		let api_url = api_url.unwrap_or(served_url);
		let root =
			std::env::temp_dir().join(format!("kiroshi-invitations-{}", uuid::Uuid::new_v4()));
		if let Some(bearer) = bearer {
			store::set(&root, &EnvScope::Account, ACCOUNT_BEARER, bearer)
				.expect("the bearer is kept");
		}
		let app = mock_app();
		let database = database.map(|()| db::open(&temp_dir()));
		app.manage::<DatabaseState>(database);
		app.manage(AccountSession::new(Ok::<PathBuf, _>(root.clone()), &api_url));
		app.manage(Invitations::new(&api_url).polling_every(Duration::from_millis(100)));
		app.manage(RelayGuests::new(&api_url));
		let heard = Arc::new(Mutex::new(Vec::new()));
		for event in [CHANGED_EVENT, JOINED_CHANGED, REMOVED_EVENT] {
			let hearing = Arc::clone(&heard);
			app.listen(event, move |heard| {
				let payload = heard.payload().to_owned();
				hearing.lock().expect("the events").push((event.to_owned(), payload));
			});
		}
		Self { app, cloud, members, heard, root }
	}

	fn heard(&self, event: &str) -> Vec<Value> {
		self.heard
			.lock()
			.expect("the events")
			.iter()
			.filter(|(name, _)| name == event)
			.map(|(_, payload)| serde_json::from_str(payload).expect("a json payload"))
			.collect()
	}

	fn heard_names(&self) -> Vec<String> {
		self.heard.lock().expect("the events").iter().map(|(name, _)| name.clone()).collect()
	}

	fn every_payload(&self) -> String {
		self.heard.lock().expect("the events").iter().map(|(_, payload)| payload.as_str()).collect()
	}

	async fn heard_until(&self, event: &str, count: usize) -> Vec<Value> {
		for _ in 0..500 {
			if self.heard(event).len() >= count {
				return self.heard(event);
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		panic!("{event} was heard {} times, never {count}", self.heard(event).len());
	}

	fn answering(&self, status: StatusCode, body: Value) {
		*self.cloud.call_answer.lock().expect("the cloud") = (status, body);
	}

	async fn stored(&self) -> Vec<JoinedSpace> {
		let state = self.app.state::<DatabaseState>();
		state.as_ref().expect("the database").joined_spaces().list().await.expect("the list")
	}

	async fn stored_until(&self, is_done: impl Fn(&[JoinedSpace]) -> bool) -> Vec<JoinedSpace> {
		for _ in 0..500 {
			let stored = self.stored().await;
			if is_done(&stored) {
				return stored;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		self.stored().await
	}

	async fn member(&mut self) -> WebSocket {
		tokio::time::timeout(PATIENCE, self.members.recv())
			.await
			.expect("the guest opened the member relay in time")
			.expect("the relay is up")
	}

	async fn accepted(&self) -> String {
		accept(self.app.handle(), INSTANCE.to_owned()).await.expect("the accept").id
	}

	async fn connect(&self, id: &str) -> Result<JoinedSpaceConnection, JoinedSpaceError> {
		connect(&self.app, id).await
	}
}

async fn connect(
	app: &App<MockRuntime>,
	id: &str,
) -> Result<JoinedSpaceConnection, JoinedSpaceError> {
	joined_space_connect(app.handle().clone(), app.state(), id.to_owned()).await
}

fn run(test: impl std::future::Future<Output = ()>) {
	tauri::async_runtime::block_on(test);
}

async fn call(member: &mut WebSocket) -> Value {
	loop {
		let frame = tokio::time::timeout(PATIENCE, member.recv())
			.await
			.expect("a frame in time")
			.expect("the socket is open")
			.expect("a readable frame");
		if let Message::Text(text) = frame {
			return serde_json::from_str(text.as_str()).expect("a json frame");
		}
	}
}

async fn send(member: &mut WebSocket, frame: Value) {
	member.send(Message::Text(frame.to_string().into())).await.expect("the frame leaves");
}

async fn closed_with(member: &mut WebSocket, code: u16) {
	let close = CloseFrame { code, reason: "".into() };
	member.send(Message::Close(Some(close))).await.expect("the close leaves");
}

async fn shared_space_answered(member: &mut WebSocket) {
	let asked = call(member).await;
	assert_eq!(asked["command"], "relay_shared_space");
	send(member, json!({ "id": asked["id"], "status": 200, "body": { "spaceId": SHARED_SPACE } }))
		.await;
}

async fn proxied(connection: &JoinedSpaceConnection, command: &str) -> reqwest::Response {
	reqwest::Client::new()
		.post(format!("{}/api/invoke/{command}", connection.host_url))
		.bearer_auth(&connection.token)
		.json(&json!({ "spaceId": SHARED_SPACE }))
		.send()
		.await
		.expect("the proxy answers")
}

async fn connected(harness: &mut Harness, id: &str) -> (JoinedSpaceConnection, WebSocket) {
	let Harness { app, members, .. } = harness;
	let connecting = connect(app, id);
	let mut member = None;
	let answering = async {
		let mut socket = members.recv().await.expect("the guest opened the relay");
		shared_space_answered(&mut socket).await;
		member = Some(socket);
	};
	let (connection, ()) = tokio::join!(connecting, answering);
	(connection.expect("the connection"), member.expect("the member socket"))
}

#[test]
fn the_pending_invitations_are_read_oldest_first_as_the_cloud_answers_them() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;
		*harness.cloud.invitations.lock().expect("the cloud") =
			json!([an_invitation("i-old", "Old"), an_invitation("i-new", "New")]);

		let listed = read(harness.app.handle()).await.expect("the list");

		assert_eq!(
			serde_json::to_value(&listed).expect("serialized"),
			json!([an_invitation("i-old", "Old"), an_invitation("i-new", "New")])
		);
		assert_eq!(harness.heard(CHANGED_EVENT).len(), 1);
	});
}

#[test]
fn every_refusal_of_the_cloud_is_answered_by_its_kind() {
	run(async {
		let unsigned = Harness::new(None).await;
		assert_eq!(read(unsigned.app.handle()).await, Err(InvitationError::NotSignedIn));
		assert_eq!(
			accept(unsigned.app.handle(), INSTANCE.to_owned()).await.map(|joined| joined.id),
			Err(InvitationError::NotSignedIn)
		);

		let revoked = Harness::new(Some("a-bearer-the-cloud-forgot")).await;
		assert_eq!(read(revoked.app.handle()).await, Err(InvitationError::NotSignedIn));

		let offline = Harness::over(Some(BEARER), Some(a_closed_port().await), Ok(())).await;
		assert!(matches!(read(offline.app.handle()).await, Err(InvitationError::Offline { .. })));

		let harness = Harness::new(Some(BEARER)).await;
		*harness.cloud.invitations_status.lock().expect("the cloud") =
			StatusCode::SERVICE_UNAVAILABLE;
		assert!(matches!(
			read(harness.app.handle()).await,
			Err(InvitationError::ServersUnreachable { .. })
		));
		*harness.cloud.invitations_status.lock().expect("the cloud") = StatusCode::OK;
		*harness.cloud.invitations.lock().expect("the cloud") = json!({ "not": "a list" });
		assert!(matches!(
			read(harness.app.handle()).await,
			Err(InvitationError::ServersUnreachable { .. })
		));

		for (answer, expected) in [
			(refusal(StatusCode::GONE, "INVITATION_WITHDRAWN"), InvitationError::Withdrawn),
			(refusal(StatusCode::NOT_FOUND, "NOT_FOUND"), InvitationError::UnknownInvitation),
			(refusal(StatusCode::UNAUTHORIZED, "UNAUTHORIZED"), InvitationError::NotSignedIn),
		] {
			harness.answering(answer.0, answer.1);
			assert_eq!(
				accept(harness.app.handle(), INSTANCE.to_owned()).await.map(|joined| joined.id),
				Err(expected.clone())
			);
			assert_eq!(decline(harness.app.handle(), INSTANCE.to_owned()).await, Err(expected));
		}
		harness.answering(StatusCode::BAD_GATEWAY, json!({}));
		assert!(matches!(
			decline(harness.app.handle(), INSTANCE.to_owned()).await,
			Err(InvitationError::ServersUnreachable { .. })
		));
		assert!(harness.stored().await.is_empty());
		assert!(harness.heard(JOINED_CHANGED).is_empty());
	});
}

#[test]
fn an_accept_the_store_cannot_keep_is_answered_storage() {
	run(async {
		let harness = Harness::over(Some(BEARER), None, Err(DatabaseError::AppDataDir)).await;

		let refused = accept(harness.app.handle(), INSTANCE.to_owned()).await;

		assert!(matches!(refused, Err(InvitationError::Storage { .. })), "{refused:?}");
	});
}

#[test]
fn an_accept_writes_one_relay_entry_named_by_the_instance_and_announces_it() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;

		let joined = accept(harness.app.handle(), INSTANCE.to_owned()).await.expect("the accept");

		assert_eq!(joined.name, "Studio");
		assert_eq!(
			harness.stored().await,
			vec![JoinedSpace {
				id: joined.id.clone(),
				reach: JoinedReach::Relay { instance_id: INSTANCE.to_owned() },
				remote_space_id: None,
				name: "Studio".to_owned(),
			}]
		);
		assert_eq!(harness.heard(JOINED_CHANGED), vec![json!({ "id": joined.id })]);
		assert_eq!(
			harness.cloud.called.lock().expect("the cloud").clone(),
			vec!["accept instance-1"]
		);
	});
}

#[test]
fn an_accept_answered_already_joined_writes_the_entry_once_under_the_same_id() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;
		read(harness.app.handle()).await.expect("the invitations are read");
		harness.answering(StatusCode::CONFLICT, refusal(StatusCode::CONFLICT, "ALREADY_JOINED").1);

		let first = accept(harness.app.handle(), INSTANCE.to_owned()).await.expect("the accept");
		let second = accept(harness.app.handle(), INSTANCE.to_owned()).await.expect("the replay");

		assert_eq!(first, second);
		assert_eq!(first.name, "Studio");
		assert_eq!(harness.stored().await.len(), 1);
		assert_eq!(harness.heard(JOINED_CHANGED).len(), 2);
	});
}

#[test]
fn a_decline_leaves_the_joined_spaces_unchanged() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;
		harness.answering(StatusCode::NO_CONTENT, Value::Null);

		decline(harness.app.handle(), INSTANCE.to_owned()).await.expect("the decline");

		assert!(harness.stored().await.is_empty());
		assert!(harness.heard(JOINED_CHANGED).is_empty());
		assert_eq!(
			harness.cloud.called.lock().expect("the cloud").clone(),
			vec!["decline instance-1"]
		);
	});
}

#[test]
fn the_poll_announces_each_change_once_and_sign_out_stops_it_with_an_empty_list() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;

		resumed(harness.app.handle());
		let first = harness.heard_until(CHANGED_EVENT, 1).await;
		tokio::time::sleep(Duration::from_millis(350)).await;
		assert_eq!(harness.heard(CHANGED_EVENT).len(), 1);
		*harness.cloud.invitations.lock().expect("the cloud") = json!([]);
		let changed = harness.heard_until(CHANGED_EVENT, 2).await;
		sign_out(harness.app.handle()).await.expect("the sign out");
		*harness.cloud.invitations.lock().expect("the cloud") =
			json!([an_invitation("i-late", "Late")]);
		tokio::time::sleep(Duration::from_millis(350)).await;

		assert_eq!(first[0], json!({ "invitations": [an_invitation(INSTANCE, "Studio")] }));
		assert_eq!(changed[1], json!({ "invitations": [] }));
		assert_eq!(
			harness.heard(CHANGED_EVENT),
			vec![
				json!({ "invitations": [an_invitation(INSTANCE, "Studio")] }),
				json!({ "invitations": [] }),
				json!({ "invitations": [] }),
			]
		);
	});
}

#[test]
fn a_relay_entry_is_reached_through_the_loopback_proxy_end_to_end() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;

		let (connection, mut member) = connected(&mut harness, &id).await;

		assert!(connection.host_url.starts_with("http://127.0.0.1:"));
		assert_eq!(connection.remote_space_id.as_deref(), Some(SHARED_SPACE));
		assert!(connection.token.len() >= 32);
		assert_eq!(harness.stored().await[0].remote_space_id.as_deref(), Some(SHARED_SPACE));

		let events_url = format!(
			"{}/api/events?token={}",
			connection.host_url.replacen("http", "ws", 1),
			connection.token
		);
		let (mut events, _) =
			tokio_tungstenite::connect_async(events_url).await.expect("the events socket opens");
		let invoking = proxied(&connection, "conversation_list");
		let answering = async {
			let invoked = call(&mut member).await;
			assert_eq!(invoked["command"], "conversation_list");
			assert_eq!(invoked["args"], json!({ "spaceId": SHARED_SPACE }));
			send(
				&mut member,
				json!({ "id": invoked["id"], "status": 200, "body": [{ "id": "c1" }] }),
			)
			.await;
		};
		let (answered, ()) = tokio::join!(invoking, answering);
		assert_eq!(answered.status(), StatusCode::OK);
		assert_eq!(answered.json::<Value>().await.expect("a json answer"), json!([{ "id": "c1" }]));

		let frame = json!({ "event": "conversation://changed", "payload": { "id": "c1" } });
		send(&mut member, json!({ "event": frame })).await;
		let forwarded = tokio::time::timeout(PATIENCE, events.next())
			.await
			.expect("an event in time")
			.expect("the socket is open")
			.expect("a readable event");
		assert_eq!(
			serde_json::from_str::<Value>(forwarded.to_text().expect("a text event"))
				.expect("a json event"),
			frame
		);

		let refused = reqwest::Client::new()
			.post(format!("{}/api/invoke/conversation_list", connection.host_url))
			.bearer_auth("not-the-token")
			.send()
			.await
			.expect("the proxy answers");
		assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);
		let again = harness.connect(&id).await.expect("the second connection");
		assert_eq!((again.host_url, again.token), (connection.host_url, connection.token.clone()));
		assert!(!harness.every_payload().contains(&connection.token));
		assert!(!harness.every_payload().contains(BEARER));
	});
}

#[test]
fn a_host_offline_before_the_shared_space_is_known_answers_host_offline_and_keeps_the_entry() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;

		let Harness { app, members, .. } = &mut harness;
		let connecting = connect(app, &id);
		let closing = async {
			let mut member = members.recv().await.expect("the guest opened the relay");
			let asked = call(&mut member).await;
			assert_eq!(asked["command"], "relay_shared_space");
			closed_with(&mut member, 4002).await;
		};
		let (refused, ()) = tokio::join!(connecting, closing);

		assert_eq!(refused, Err(JoinedSpaceError::HostOffline { id: id.clone() }));
		assert_eq!(harness.stored().await.len(), 1);
		assert!(harness.heard(REMOVED_EVENT).is_empty());
	});
}

#[test]
fn a_live_relay_closed_4002_answers_503_reopens_and_keeps_the_entry() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		let (connection, mut member) = connected(&mut harness, &id).await;

		closed_with(&mut member, 4002).await;
		let mut offline = proxied(&connection, "conversation_list").await;
		for _ in 0..100 {
			if offline.status() == StatusCode::SERVICE_UNAVAILABLE {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
			offline = proxied(&connection, "conversation_list").await;
		}
		assert_eq!(offline.status(), StatusCode::SERVICE_UNAVAILABLE);
		let mut reopened = harness.member().await;

		let invoking = proxied(&connection, "conversation_list");
		let answering = async {
			let invoked = call(&mut reopened).await;
			send(&mut reopened, json!({ "id": invoked["id"], "status": 200, "body": [] })).await;
		};
		let (answered, ()) = tokio::join!(invoking, answering);

		assert_eq!(answered.status(), StatusCode::OK);
		assert_eq!(harness.stored().await.len(), 1);
		assert!(harness.heard(REMOVED_EVENT).is_empty());
	});
}

#[test]
fn a_membership_ended_4003_removes_the_entry_and_announces_its_removal() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		let (connection, mut member) = connected(&mut harness, &id).await;

		closed_with(&mut member, 4003).await;
		let stored = harness.stored_until(<[JoinedSpace]>::is_empty).await;
		let proxy = reqwest::Client::new();
		let mut is_closed = false;
		for _ in 0..200 {
			let attempt = proxy
				.post(format!("{}/api/invoke/conversation_list", connection.host_url))
				.bearer_auth(&connection.token)
				.send()
				.await;
			is_closed = attempt.is_err();
			if is_closed {
				break;
			}
			tokio::time::sleep(Duration::from_millis(10)).await;
		}
		let removed = harness.heard_until(REMOVED_EVENT, 1).await;

		assert!(stored.is_empty());
		assert_eq!(removed, vec![json!({ "id": id, "name": "Studio" })]);
		let names = harness.heard_names();
		let changed_at = names.iter().rposition(|name| name == JOINED_CHANGED).expect("changed");
		let removed_at = names.iter().position(|name| name == REMOVED_EVENT).expect("removed");
		assert!(changed_at < removed_at);
		assert!(is_closed, "the proxy of a removed entry still answers");
	});
}

#[test]
fn an_instance_the_relay_answers_404_on_open_removes_the_entry_with_the_removed_event() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		harness.cloud.unknown_instances.lock().expect("the cloud").push(INSTANCE.to_owned());

		let refused = harness.connect(&id).await;

		assert_eq!(refused, Err(JoinedSpaceError::UnknownJoinedSpace { id: id.clone() }));
		assert!(harness.stored_until(<[JoinedSpace]>::is_empty).await.is_empty());
		assert_eq!(
			harness.heard_until(REMOVED_EVENT, 1).await,
			vec![json!({ "id": id, "name": "Studio" })]
		);
	});
}

#[test]
fn sign_out_drops_the_relay_entries_and_keeps_the_direct_link_ones() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let relay_id = harness.accepted().await;
		let (connection, _member) = connected(&mut harness, &relay_id).await;
		let link = joined_space_add(
			harness.app.handle().clone(),
			harness.app.state(),
			"x#host=http://h.test&token=direct-token".to_owned(),
			None,
		)
		.await
		.expect("the direct link");

		sign_out(harness.app.handle()).await.expect("the sign out");

		let stored = harness.stored().await;
		assert_eq!(stored.len(), 1);
		assert_eq!(stored[0].id, link.id);
		assert_eq!(harness.heard(JOINED_CHANGED).last(), Some(&json!({ "id": relay_id })));
		assert!(harness.heard(REMOVED_EVENT).is_empty());
		assert!(reqwest::Client::new()
			.post(format!("{}/api/invoke/conversation_list", connection.host_url))
			.bearer_auth(&connection.token)
			.send()
			.await
			.is_err());
		assert!(!harness.every_payload().contains(BEARER));
		assert!(!harness.every_payload().contains("direct-token"));
	});
}

fn is_guest_running(harness: &Harness, id: &str) -> bool {
	harness.app.state::<RelayGuests>().is_running(id)
}

async fn proxy_closed(connection: &JoinedSpaceConnection) -> bool {
	for _ in 0..200 {
		let attempt = reqwest::Client::new()
			.post(format!("{}/api/invoke/conversation_list", connection.host_url))
			.bearer_auth(&connection.token)
			.send()
			.await;
		if attempt.is_err() {
			return true;
		}
		tokio::time::sleep(Duration::from_millis(10)).await;
	}
	false
}

async fn guest_ended(harness: &Harness, id: &str) -> bool {
	for _ in 0..500 {
		if !is_guest_running(harness, id) {
			return true;
		}
		tokio::time::sleep(Duration::from_millis(10)).await;
	}
	false
}

#[test]
fn an_accept_in_flight_during_sign_out_answers_not_signed_in_and_leaves_no_relay_entry() {
	run(async {
		let harness = Harness::new(Some(BEARER)).await;
		*harness.cloud.call_delay.lock().expect("the cloud") = Duration::from_millis(300);

		let accepting = accept(harness.app.handle(), INSTANCE.to_owned());
		let signing_out = async {
			for _ in 0..500 {
				if !harness.cloud.called.lock().expect("the cloud").is_empty() {
					break;
				}
				tokio::time::sleep(Duration::from_millis(5)).await;
			}
			sign_out(harness.app.handle()).await.expect("the sign out");
		};
		let (accepted, ()) = tokio::join!(accepting, signing_out);

		assert_eq!(accepted.map(|joined| joined.id), Err(InvitationError::NotSignedIn));
		assert!(harness.stored().await.is_empty());
		assert!(harness.heard(JOINED_CHANGED).is_empty());
	});
}

#[test]
fn a_connect_waiting_on_the_turn_during_sign_out_answers_unknown_and_starts_no_guest() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		let guests = harness.app.state::<RelayGuests>();
		let held = guests.turn().lock().await;

		let signing_out = sign_out(harness.app.handle());
		let connecting = async {
			tokio::time::sleep(Duration::from_millis(100)).await;
			harness.connect(&id).await
		};
		let releasing = async {
			tokio::time::sleep(Duration::from_millis(300)).await;
			drop(held);
		};
		let (signed_out, connected, ()) = tokio::join!(signing_out, connecting, releasing);

		signed_out.expect("the sign out");
		assert_eq!(connected, Err(JoinedSpaceError::UnknownJoinedSpace { id: id.clone() }));
		assert!(!is_guest_running(&harness, &id));
		assert!(tokio::time::timeout(Duration::from_millis(300), harness.members.recv())
			.await
			.is_err());
		assert!(harness.stored().await.is_empty());
	});
}

#[test]
fn a_guest_left_without_an_account_ends_closes_its_proxy_and_keeps_the_entry() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		let (connection, mut member) = connected(&mut harness, &id).await;
		store::delete(&harness.root, &EnvScope::Account, ACCOUNT_BEARER).expect("signed out");

		closed_with(&mut member, 4002).await;

		assert!(guest_ended(&harness, &id).await, "the guest still runs");
		assert!(proxy_closed(&connection).await, "the proxy still answers");
		assert_eq!(harness.stored().await.len(), 1);
		assert!(harness.heard(REMOVED_EVENT).is_empty());
		assert!(tokio::time::timeout(Duration::from_millis(1500), harness.members.recv())
			.await
			.is_err());

		store::set(&harness.root, &EnvScope::Account, ACCOUNT_BEARER, BEARER).expect("signed in");
		let again = harness.connect(&id).await.expect("the new connection");
		let _reopened = harness.member().await;

		assert!(is_guest_running(&harness, &id));
		assert_ne!(again.host_url, connection.host_url);
	});
}

#[test]
fn a_guest_refused_401_ends_and_a_connect_after_a_new_sign_in_starts_a_new_one() {
	run(async {
		let mut harness = Harness::new(Some(BEARER)).await;
		let id = harness.accepted().await;
		let (first, mut member) = connected(&mut harness, &id).await;
		harness.cloud.is_refusing_members.store(true, Ordering::SeqCst);

		closed_with(&mut member, 4002).await;

		assert!(guest_ended(&harness, &id).await, "the guest still runs");
		assert!(proxy_closed(&first).await, "the proxy still answers");
		assert_eq!(harness.stored().await.len(), 1);
		assert!(harness.heard(REMOVED_EVENT).is_empty());

		harness.cloud.is_refusing_members.store(false, Ordering::SeqCst);
		let second = harness.connect(&id).await.expect("the new connection");
		let _reopened = harness.member().await;

		assert!(is_guest_running(&harness, &id));
		assert_ne!(second.host_url, first.host_url);
		assert_ne!(second.token, first.token);
		assert_eq!(second.remote_space_id.as_deref(), Some(SHARED_SPACE));
	});
}
