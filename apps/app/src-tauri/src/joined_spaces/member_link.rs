use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use serde_json::{json, Value};
use tokio::sync::{broadcast, mpsc, oneshot, watch};
use tokio::time::timeout;

use crate::events::Frame;

const CALL_BOUND: Duration = Duration::from_secs(300);

pub(super) const LEARN_BOUND: Duration = Duration::from_secs(30);

const BUFFERED_EVENTS: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Presence {
	Connecting,
	Online,
	Down,
	Ended,
}

pub(super) struct Answer {
	pub(super) status: u16,
	pub(super) body: Value,
}

struct Session {
	calls: mpsc::Sender<String>,
	events: broadcast::Sender<Frame>,
}

pub(super) struct MemberLink {
	session: Mutex<Option<Session>>,
	pending: Mutex<HashMap<u64, oneshot::Sender<Answer>>>,
	presence: watch::Sender<Presence>,
	next_call: AtomicU64,
}

impl MemberLink {
	pub(super) fn new() -> Self {
		Self {
			session: Mutex::new(None),
			pending: Mutex::new(HashMap::new()),
			presence: watch::channel(Presence::Connecting).0,
			next_call: AtomicU64::new(1),
		}
	}

	fn session(&self) -> MutexGuard<'_, Option<Session>> {
		self.session.lock().unwrap_or_else(PoisonError::into_inner)
	}

	fn pending(&self) -> MutexGuard<'_, HashMap<u64, oneshot::Sender<Answer>>> {
		self.pending.lock().unwrap_or_else(PoisonError::into_inner)
	}

	pub(super) fn presence(&self) -> watch::Receiver<Presence> {
		self.presence.subscribe()
	}

	pub(super) async fn settled(&self) -> Presence {
		let mut presence = self.presence();
		let settled = timeout(LEARN_BOUND, presence.wait_for(|now| *now != Presence::Connecting))
			.await
			.ok()
			.and_then(Result::ok)
			.map(|now| *now);
		settled.unwrap_or(Presence::Connecting)
	}

	pub(super) fn connecting(&self) {
		self.presence.send_replace(Presence::Connecting);
	}

	pub(super) fn opened(&self, calls: mpsc::Sender<String>) {
		let events = broadcast::channel(BUFFERED_EVENTS).0;
		*self.session() = Some(Session { calls, events });
		self.presence.send_replace(Presence::Online);
	}

	pub(super) fn closed(&self, presence: Presence) {
		self.session().take();
		self.pending().clear();
		self.presence.send_replace(presence);
	}

	pub(super) fn subscribed(&self) -> Option<broadcast::Receiver<Frame>> {
		self.session().as_ref().map(|session| session.events.subscribe())
	}

	pub(super) async fn called(&self, command: &str, args: Value) -> Option<Answer> {
		let calls = self.session().as_ref()?.calls.clone();
		let id = self.next_call.fetch_add(1, Ordering::Relaxed);
		let (answer, answered) = oneshot::channel();
		self.pending().insert(id, answer);
		let frame = json!({ "id": id, "command": command, "args": args }).to_string();
		let answered = match calls.send(frame).await {
			Ok(()) => timeout(CALL_BOUND, answered).await.ok().and_then(Result::ok),
			Err(_) => None,
		};
		self.pending().remove(&id);
		answered
	}

	pub(super) fn received(&self, text: &str) {
		let Ok(frame) = serde_json::from_str::<Value>(text) else {
			return eprintln!("the member relay sent a frame that is not json");
		};
		if let Some(event) = frame.get("event") {
			return self.heard(event.to_string());
		}
		let (Some(id), Some(status)) = (
			frame.get("id").and_then(Value::as_u64),
			frame
				.get("status")
				.and_then(Value::as_u64)
				.and_then(|status| u16::try_from(status).ok()),
		) else {
			return eprintln!(
				"the member relay sent a frame that is neither an event nor an answer"
			);
		};
		let Some(caller) = self.pending().remove(&id) else {
			return eprintln!("the member relay answered call {id} that no caller awaits");
		};
		let body = frame.get("body").cloned().unwrap_or(Value::Null);
		if caller.send(Answer { status, body }).is_err() {
			eprintln!("the member relay answered call {id} after its caller left");
		}
	}

	fn heard(&self, event: String) {
		let session = self.session();
		let Some(session) = session.as_ref() else {
			return;
		};
		if session.events.receiver_count() > 0 && session.events.send(event.into()).is_err() {
			eprintln!("a relayed event found no listener left");
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[tokio::test]
	async fn a_call_is_framed_with_an_id_and_its_answer_reaches_the_caller() {
		let link = MemberLink::new();
		let (calls, mut sent) = mpsc::channel(4);
		link.opened(calls);

		let answering = async {
			let frame: Value =
				serde_json::from_str(&sent.recv().await.expect("a frame")).expect("a json frame");
			assert_eq!(frame["command"], "space_list");
			assert_eq!(frame["args"], json!({ "a": 1 }));
			link.received(&json!({ "id": frame["id"], "status": 200, "body": [1] }).to_string());
		};
		let (answer, ()) = tokio::join!(link.called("space_list", json!({ "a": 1 })), answering);

		let answer = answer.expect("an answer");
		assert_eq!((answer.status, answer.body), (200, json!([1])));
	}

	#[tokio::test]
	async fn a_call_while_closed_or_cut_by_a_close_gets_no_answer() {
		let link = MemberLink::new();
		assert!(link.called("space_list", json!({})).await.is_none());

		let (calls, mut sent) = mpsc::channel(4);
		link.opened(calls);
		let cutting = async {
			sent.recv().await.expect("a frame");
			link.closed(Presence::Down);
		};
		let (answer, ()) = tokio::join!(link.called("space_list", json!({})), cutting);

		assert!(answer.is_none());
		assert_eq!(*link.presence().borrow(), Presence::Down);
		assert!(link.subscribed().is_none());
	}

	#[tokio::test]
	async fn an_event_frame_reaches_every_subscriber_unwrapped() {
		let link = MemberLink::new();
		let (calls, _sent) = mpsc::channel(4);
		link.opened(calls);
		let mut heard = link.subscribed().expect("an open session");

		link.received(r#"{"event":{"event":"a://b","payload":1}}"#);

		let frame = heard.recv().await.expect("the event");
		assert_eq!(
			serde_json::from_str::<Value>(&frame).expect("json"),
			json!({ "event": "a://b", "payload": 1 })
		);
	}
}
