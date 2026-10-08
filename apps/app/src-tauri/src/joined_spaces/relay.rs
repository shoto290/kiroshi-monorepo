use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::{mpsc, watch};
use tokio::time::{interval_at, sleep, timeout, Instant};
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::Message;

use super::commands::{announce_change, announce_removal, ready};
use super::contract::{JoinedSpace, JoinedSpaceConnection, JoinedSpaceError};
use super::member_link::{MemberLink, Presence};
use super::proxy;
use crate::account::cloud::Cloud;
use crate::account::session::AccountSession;
use crate::db;
use crate::db::repositories::joined_spaces::{self, JoinedReach};
use crate::host_api::token::HostToken;
use crate::hosting::bridge::SHARED_SPACE_COMMAND;
use crate::hosting::relay::{
	opened, sent, until_stopped, Backoff, Opened, Socket, PING_EVERY, SILENCE_BOUND,
};

const MEMBERSHIP_ENDED: u16 = 4003;

const LEARN_BOUND: Duration = Duration::from_secs(30);

const CALLS_IN_FLIGHT: usize = 64;

pub struct RelayGuests {
	cloud: Cloud,
	guests: Mutex<HashMap<String, Guest>>,
	turn: tokio::sync::Mutex<()>,
}

struct Guest {
	origin: String,
	token: Arc<HostToken>,
	link: Arc<MemberLink>,
	stop: watch::Sender<bool>,
	run: JoinHandle<()>,
}

struct Reached {
	origin: String,
	token: String,
	link: Arc<MemberLink>,
}

struct Linked {
	id: String,
	instance_id: String,
	link: Arc<MemberLink>,
}

enum Ended {
	Stopped,
	Evicted,
	Dropped(String),
}

impl RelayGuests {
	pub fn new(api_url: &str) -> Self {
		Self {
			cloud: Cloud::new(api_url),
			guests: Mutex::new(HashMap::new()),
			turn: tokio::sync::Mutex::new(()),
		}
	}

	pub fn cloud(&self) -> &Cloud {
		&self.cloud
	}

	fn guests(&self) -> MutexGuard<'_, HashMap<String, Guest>> {
		self.guests.lock().unwrap_or_else(PoisonError::into_inner)
	}

	fn reached(&self, id: &str) -> Option<Reached> {
		self.guests().get(id).map(|guest| Reached {
			origin: guest.origin.clone(),
			token: guest.token.bearer().to_owned(),
			link: Arc::clone(&guest.link),
		})
	}
}

pub async fn joined<R: Runtime>(
	app: &AppHandle<R>,
	instance_id: String,
	name: Option<String>,
) -> Result<JoinedSpace, JoinedSpaceError> {
	let state = app.state::<db::DatabaseState>();
	let repository = ready(&state)?.joined_spaces();
	let reach = JoinedReach::Relay { instance_id: instance_id.clone() };
	let held_name = repository
		.list()
		.await?
		.into_iter()
		.find(|joined| joined.reach == reach)
		.map(|joined| joined.name);
	let candidate = joined_spaces::JoinedSpace {
		id: uuid::Uuid::new_v4().to_string(),
		reach,
		remote_space_id: None,
		name: name.or(held_name).unwrap_or(instance_id),
	};
	let joined = repository.join(candidate).await?;
	announce_change(app, joined.id.clone())?;
	Ok(JoinedSpace::presented(joined, app.state::<RelayGuests>().cloud()))
}

pub async fn connected<R: Runtime>(
	app: &AppHandle<R>,
	found: joined_spaces::JoinedSpace,
	instance_id: String,
) -> Result<JoinedSpaceConnection, JoinedSpaceError> {
	let reached = started(app, &found.id, instance_id).await?;
	let mut found = found;
	if found.remote_space_id.is_none() {
		found.remote_space_id = Some(learned(app, &found.id, &reached.link).await?);
	}
	Ok(JoinedSpaceConnection::over(found, reached.origin, reached.token))
}

async fn started<R: Runtime>(
	app: &AppHandle<R>,
	id: &str,
	instance_id: String,
) -> Result<Reached, JoinedSpaceError> {
	let guests = app.state::<RelayGuests>();
	let _turn = guests.turn.lock().await;
	if let Some(reached) = guests.reached(id) {
		return Ok(reached);
	}
	let link = Arc::new(MemberLink::new());
	let token = Arc::new(HostToken::random());
	let (stop, stopped) = watch::channel(false);
	let origin = proxy::served(Arc::clone(&link), Arc::clone(&token), stopped.clone())
		.await
		.map_err(|error| JoinedSpaceError::ProxyUnavailable { detail: error.to_string() })?;
	let linked = Linked { id: id.to_owned(), instance_id, link: Arc::clone(&link) };
	let run = tauri::async_runtime::spawn(guest_linked(app.clone(), linked, stopped));
	guests.guests().insert(id.to_owned(), Guest { origin, token, link, stop, run });
	guests.reached(id).ok_or_else(|| JoinedSpaceError::UnknownJoinedSpace { id: id.to_owned() })
}

async fn learned<R: Runtime>(
	app: &AppHandle<R>,
	id: &str,
	link: &MemberLink,
) -> Result<String, JoinedSpaceError> {
	let offline = || JoinedSpaceError::HostOffline { id: id.to_owned() };
	let mut presence = link.presence();
	let settled = timeout(LEARN_BOUND, presence.wait_for(|now| *now != Presence::Connecting))
		.await
		.ok()
		.and_then(Result::ok)
		.map(|now| *now);
	match settled {
		Some(Presence::Online) => {}
		Some(Presence::Ended) => {
			return Err(JoinedSpaceError::UnknownJoinedSpace { id: id.to_owned() })
		}
		_ => return Err(offline()),
	}
	let answer = timeout(LEARN_BOUND, link.called(SHARED_SPACE_COMMAND, json!({})))
		.await
		.ok()
		.flatten()
		.filter(|answer| answer.status == 200)
		.ok_or_else(offline)?;
	let space_id = answer.body.get("spaceId").and_then(Value::as_str).ok_or_else(offline)?;
	let state = app.state::<db::DatabaseState>();
	ready(&state)?.joined_spaces().learned(id.to_owned(), space_id.to_owned()).await?;
	Ok(space_id.to_owned())
}

pub async fn closed<R: Runtime>(app: &AppHandle<R>, id: &str) {
	let Some(guests) = app.try_state::<RelayGuests>() else {
		return;
	};
	let _turn = guests.turn.lock().await;
	let guest = guests.guests().remove(id);
	if let Some(guest) = guest {
		finished(id, guest).await;
	}
}

pub async fn signed_out<R: Runtime>(app: &AppHandle<R>) {
	let Some(guests) = app.try_state::<RelayGuests>() else {
		return;
	};
	let _turn = guests.turn.lock().await;
	let running: Vec<(String, Guest)> = guests.guests().drain().collect();
	for (id, guest) in running {
		finished(&id, guest).await;
	}
	let state = app.state::<db::DatabaseState>();
	let repository = match ready(&state) {
		Ok(database) => database.joined_spaces(),
		Err(failure) => return eprintln!("no relay space was dropped on sign out: {failure:?}"),
	};
	let listed = match repository.list().await {
		Ok(listed) => listed,
		Err(failure) => return eprintln!("no relay space was dropped on sign out: {failure:?}"),
	};
	for joined in listed {
		if matches!(joined.reach, JoinedReach::Relay { .. }) {
			dropped_on_sign_out(app, repository, joined.id).await;
		}
	}
}

async fn dropped_on_sign_out<R: Runtime>(
	app: &AppHandle<R>,
	repository: &db::repositories::JoinedSpacesRepository,
	id: String,
) {
	let removed = match repository.remove(id.clone()).await {
		Ok(removed) => removed,
		Err(failure) => return eprintln!("relay space {id} was kept on sign out: {failure:?}"),
	};
	if !removed {
		return;
	}
	if let Err(failure) = announce_change(app, id.clone()) {
		eprintln!("the sign out drop of relay space {id} did not reach the front: {failure:?}");
	}
}

async fn finished(id: &str, guest: Guest) {
	guest.stop.send_replace(true);
	if let Err(error) = guest.run.await {
		eprintln!("the member relay of joined space {id} ended abnormally: {error}");
	}
}

async fn guest_linked<R: Runtime>(
	app: AppHandle<R>,
	linked: Linked,
	mut stop: watch::Receiver<bool>,
) {
	let mut backoff = Backoff::first();
	loop {
		match attempted(&app, &linked, &mut stop, &mut backoff).await {
			Ended::Stopped => return linked.link.closed(Presence::Ended),
			Ended::Evicted => {
				linked.link.closed(Presence::Ended);
				return evicted(&app, &linked.id).await;
			}
			Ended::Dropped(reason) => {
				linked.link.closed(Presence::Down);
				eprintln!(
					"joined space {} (instance {}) lost its member relay: {reason}",
					linked.id, linked.instance_id
				);
				if until_stopped(&mut stop, sleep(backoff.step())).await.is_none() {
					return linked.link.closed(Presence::Ended);
				}
				linked.link.connecting();
			}
		}
	}
}

async fn attempted<R: Runtime>(
	app: &AppHandle<R>,
	linked: &Linked,
	stop: &mut watch::Receiver<bool>,
	backoff: &mut Backoff,
) -> Ended {
	let bearer = match app.state::<AccountSession>().bearer() {
		Ok(Some(bearer)) => bearer,
		Ok(None) => return Ended::Dropped("no account is signed in".to_owned()),
		Err(error) => {
			return Ended::Dropped(format!("the account session store failed: {error:?}"))
		}
	};
	let url = app.state::<RelayGuests>().cloud.member_relay_url(&linked.instance_id);
	match until_stopped(stop, opened(url, &bearer)).await {
		None => Ended::Stopped,
		Some(Opened::Socket(socket)) => {
			backoff.reset();
			online(*socket, &linked.link, stop).await
		}
		Some(Opened::Unknown) => Ended::Evicted,
		Some(Opened::Revoked) => Ended::Dropped("the relay refused the account (401)".to_owned()),
		Some(Opened::Forbidden) => {
			Ended::Dropped("the account is not a member of this instance (403)".to_owned())
		}
		Some(Opened::Unreachable(reason)) => Ended::Dropped(reason),
	}
}

async fn online(socket: Socket, link: &MemberLink, stop: &mut watch::Receiver<bool>) -> Ended {
	let (mut sink, mut stream) = socket.split();
	let (calls_in, mut calls) = mpsc::channel(CALLS_IN_FLIGHT);
	link.opened(calls_in);
	let mut pings = interval_at(Instant::now() + PING_EVERY, PING_EVERY);
	let silence = sleep(SILENCE_BOUND);
	tokio::pin!(silence);
	loop {
		let outgoing = tokio::select! {
			_ = stop.changed() => {
				let close = CloseFrame { code: CloseCode::Normal, reason: "".into() };
				if let Err(reason) = sent(&mut sink, Message::Close(Some(close))).await {
					eprintln!("a member relay was left without its 1000 close frame: {reason}");
				}
				return Ended::Stopped;
			}
			frame = stream.next() => {
				silence.as_mut().reset(Instant::now() + SILENCE_BOUND);
				match frame {
					Some(Ok(Message::Text(text))) => {
						link.received(text.as_str());
						continue;
					}
					Some(Ok(Message::Close(frame))) => return closed_by_relay(frame),
					Some(Ok(_)) => continue,
					Some(Err(error)) => return Ended::Dropped(format!("the member relay socket failed: {error}")),
					None => return Ended::Dropped("the member relay socket ended".to_owned()),
				}
			}
			Some(call) = calls.recv() => Message::text(call),
			_ = pings.tick() => Message::Ping(Vec::new().into()),
			_ = &mut silence => {
				return Ended::Dropped(format!("no frame or pong arrived for {SILENCE_BOUND:?}"));
			}
		};
		if let Err(reason) = sent(&mut sink, outgoing).await {
			return Ended::Dropped(reason);
		}
	}
}

fn closed_by_relay(frame: Option<CloseFrame>) -> Ended {
	match frame.map(|frame| u16::from(frame.code)) {
		Some(MEMBERSHIP_ENDED) => Ended::Evicted,
		code => Ended::Dropped(format!("the member relay closed the socket with code {code:?}")),
	}
}

async fn evicted<R: Runtime>(app: &AppHandle<R>, id: &str) {
	app.state::<RelayGuests>().guests().remove(id);
	let state = app.state::<db::DatabaseState>();
	let repository = match ready(&state) {
		Ok(database) => database.joined_spaces(),
		Err(failure) => {
			return eprintln!("joined space {id} whose membership ended was kept: {failure:?}")
		}
	};
	let name = match repository.find(id.to_owned()).await {
		Ok(Some(found)) => found.name,
		Ok(None) => return,
		Err(failure) => {
			return eprintln!("joined space {id} whose membership ended was kept: {failure:?}")
		}
	};
	match repository.remove(id.to_owned()).await {
		Ok(true) => {}
		Ok(false) => return,
		Err(failure) => {
			return eprintln!("joined space {id} whose membership ended was kept: {failure:?}")
		}
	}
	eprintln!("joined space {id} was removed: its membership ended");
	let announced = announce_change(app, id.to_owned())
		.and_then(|()| announce_removal(app, id.to_owned(), name));
	if let Err(failure) = announced {
		eprintln!("the removal of joined space {id} did not reach the front: {failure:?}");
	}
}
