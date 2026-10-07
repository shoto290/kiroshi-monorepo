use std::future::Future;
use std::time::Duration;

use futures_util::stream::SplitSink;
use futures_util::{SinkExt, StreamExt};
use reqwest::StatusCode;
use tauri::http::{header, HeaderValue};
use tauri::{AppHandle, Manager, Runtime};
use tokio::net::TcpStream;
use tokio::sync::broadcast::error::RecvError;
use tokio::sync::watch;
use tokio::task::JoinSet;
use tokio::time::{interval_at, sleep, timeout, Instant};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::{Error as SocketError, Message};
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use super::bridge::{self, LocalApi};
use super::contract::HostingState;
use super::{entered, Hosting};
use crate::account::cloud::RegisterError;
use crate::account::session::AccountSession;
use crate::db;
use crate::events;
use crate::host_api::events::SEND_PATIENCE;
use crate::missions::github::installed_tls_provider;
use crate::spaces::commands::ready;
use crate::spaces::contract::SpaceError;

const PING_EVERY: Duration = Duration::from_secs(30);

const SILENCE_BOUND: Duration = Duration::from_secs(90);

const FIRST_BACKOFF: Duration = Duration::from_secs(1);

const BACKOFF_CAP: Duration = Duration::from_secs(60);

const CONNECT_BOUND: Duration = Duration::from_secs(20);

const HOST_REPLACED: u16 = 4001;

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

type Sink = SplitSink<Socket, Message>;

pub(super) struct Hosted {
	pub(super) space_id: String,
	pub(super) name: String,
	pub(super) instance_id: Option<String>,
}

enum Opened {
	Socket(Box<Socket>),
	Revoked,
	Forbidden,
	Unknown,
	Unreachable(String),
}

enum Ended {
	Stopped,
	Replaced,
	Dropped(String),
}

enum Next {
	Retry(String),
	Settled(HostingState),
	Stopped,
}

struct Backoff(Duration);

impl Backoff {
	fn reset(&mut self) {
		self.0 = FIRST_BACKOFF;
	}

	fn step(&mut self) -> Duration {
		let waited = self.0;
		self.0 = (waited * 2).min(BACKOFF_CAP);
		waited
	}
}

pub(super) async fn hosted<R: Runtime>(
	app: AppHandle<R>,
	mut hosted: Hosted,
	local: LocalApi,
	mut stop: watch::Receiver<bool>,
) {
	let mut backoff = Backoff(FIRST_BACKOFF);
	let mut is_reregistered = false;
	loop {
		let next =
			attempted(&app, &mut hosted, &local, &mut stop, &mut backoff, &mut is_reregistered)
				.await;
		let instance_id = hosted.instance_id.as_deref();
		match next {
			Next::Stopped => return,
			Next::Settled(state) => return entered(&app, &hosted.space_id, instance_id, state),
			Next::Retry(reason) => {
				eprintln!(
					"hosting of space {} (instance {}) lost its relay: {reason}",
					hosted.space_id,
					instance_id.unwrap_or("none")
				);
				entered(&app, &hosted.space_id, instance_id, HostingState::Connecting);
				if until_stopped(&mut stop, sleep(backoff.step())).await.is_none() {
					return;
				}
			}
		}
	}
}

async fn attempted<R: Runtime>(
	app: &AppHandle<R>,
	hosted: &mut Hosted,
	local: &LocalApi,
	stop: &mut watch::Receiver<bool>,
	backoff: &mut Backoff,
	is_reregistered: &mut bool,
) -> Next {
	let bearer = match app.state::<AccountSession>().bearer() {
		Ok(Some(bearer)) => bearer,
		Ok(None) => return Next::Settled(HostingState::NeedsSignIn),
		Err(error) => {
			return Next::Settled(HostingState::Failed {
				reason: format!("the account session store failed: {error:?}"),
			})
		}
	};
	let instance_id = match hosted.instance_id.clone() {
		Some(instance_id) => instance_id,
		None => match until_stopped(stop, registered(app, &bearer, hosted)).await {
			None => return Next::Stopped,
			Some(Ok(instance_id)) => instance_id,
			Some(Err(next)) => return next,
		},
	};
	let opened = until_stopped(stop, opened(app, &instance_id, &bearer)).await;
	match opened {
		None => Next::Stopped,
		Some(Opened::Socket(socket)) => {
			*is_reregistered = false;
			backoff.reset();
			entered(app, &hosted.space_id, Some(&instance_id), HostingState::Online);
			let ids = Ids { space_id: &hosted.space_id, instance_id: &instance_id };
			match online(app, *socket, local, stop, ids).await {
				Ended::Stopped => Next::Stopped,
				Ended::Replaced => Next::Settled(HostingState::Failed {
					reason: "another host took this instance over (relay close 4001)".to_owned(),
				}),
				Ended::Dropped(reason) => Next::Retry(reason),
			}
		}
		Some(Opened::Revoked) => Next::Settled(HostingState::NeedsSignIn),
		Some(Opened::Forbidden) => Next::Settled(HostingState::Failed {
			reason: "the account does not own this instance (relay answered 403)".to_owned(),
		}),
		Some(Opened::Unknown) if !*is_reregistered => {
			*is_reregistered = true;
			hosted.instance_id = None;
			Box::pin(attempted(app, hosted, local, stop, backoff, is_reregistered)).await
		}
		Some(Opened::Unknown) => Next::Settled(HostingState::Failed {
			reason: "kiroshi-cloud knows no instance under the id it just registered (relay answered 404)"
				.to_owned(),
		}),
		Some(Opened::Unreachable(reason)) => Next::Retry(reason),
	}
}

async fn registered<R: Runtime>(
	app: &AppHandle<R>,
	bearer: &str,
	hosted: &mut Hosted,
) -> Result<String, Next> {
	let cloud = &app.state::<Hosting>().cloud;
	let instance_id = match cloud.register_instance(bearer, &hosted.name).await {
		Ok(instance_id) => instance_id,
		Err(RegisterError::Revoked) => return Err(Next::Settled(HostingState::NeedsSignIn)),
		Err(RegisterError::Unreachable(reason)) => return Err(Next::Retry(reason)),
	};
	let state = app.state::<db::DatabaseState>();
	let stored = match ready(&state) {
		Ok(database) => database
			.space_hosting()
			.registered(hosted.space_id.clone(), instance_id.clone())
			.await
			.map_err(SpaceError::from),
		Err(failure) => Err(failure),
	};
	if let Err(failure) = stored {
		return Err(Next::Settled(HostingState::Failed {
			reason: format!("the registered instance {instance_id} was not stored: {failure:?}"),
		}));
	}
	eprintln!("space {} registered instance {instance_id}", hosted.space_id);
	hosted.instance_id = Some(instance_id.clone());
	Ok(instance_id)
}

async fn opened<R: Runtime>(app: &AppHandle<R>, instance_id: &str, bearer: &str) -> Opened {
	let url = app.state::<Hosting>().cloud.host_relay_url(instance_id);
	let mut request = match url.into_client_request() {
		Ok(request) => request,
		Err(error) => return Opened::Unreachable(format!("the relay url is unusable: {error}")),
	};
	let Ok(authorization) = HeaderValue::from_str(&format!("Bearer {bearer}")) else {
		return Opened::Revoked;
	};
	request.headers_mut().insert(header::AUTHORIZATION, authorization);
	installed_tls_provider();
	match timeout(CONNECT_BOUND, connect_async(request)).await {
		Err(_) => Opened::Unreachable(format!("the relay did not answer within {CONNECT_BOUND:?}")),
		Ok(Ok((socket, _))) => Opened::Socket(Box::new(socket)),
		Ok(Err(SocketError::Http(response))) => match response.status() {
			StatusCode::UNAUTHORIZED => Opened::Revoked,
			StatusCode::FORBIDDEN => Opened::Forbidden,
			StatusCode::NOT_FOUND => Opened::Unknown,
			status => Opened::Unreachable(format!("the relay answered {status}")),
		},
		Ok(Err(error)) => Opened::Unreachable(format!("the relay could not be reached: {error}")),
	}
}

#[derive(Clone, Copy)]
struct Ids<'a> {
	space_id: &'a str,
	instance_id: &'a str,
}

async fn online<R: Runtime>(
	app: &AppHandle<R>,
	socket: Socket,
	local: &LocalApi,
	stop: &mut watch::Receiver<bool>,
	ids: Ids<'_>,
) -> Ended {
	let (mut sink, mut stream) = socket.split();
	let mut heard = events::subscribed(app);
	let mut pings = interval_at(Instant::now() + PING_EVERY, PING_EVERY);
	let mut invokes = JoinSet::new();
	let silence = sleep(SILENCE_BOUND);
	tokio::pin!(silence);
	loop {
		let outgoing = tokio::select! {
			_ = stop.changed() => return closed(&mut sink, ids).await,
			frame = stream.next() => {
				silence.as_mut().reset(Instant::now() + SILENCE_BOUND);
				match received(frame, ids) {
					Received::Call(call) => {
						invokes.spawn(bridge::bridged(local.clone(), call));
						continue;
					}
					Received::Answer(answer) => Message::text(answer),
					Received::Nothing => continue,
					Received::Ended(ended) => return ended,
				}
			}
			Some(answer) = invokes.join_next(), if !invokes.is_empty() => match answer {
				Ok(answer) => Message::text(answer),
				Err(failure) => {
					eprintln!("a relayed invoke of space {} ended abnormally: {failure}", ids.space_id);
					continue;
				}
			},
			frame = heard.recv() => match frame {
				Ok(frame) => Message::text(bridge::forwarded(&frame)),
				Err(RecvError::Lagged(missed)) => {
					eprintln!("the relay of space {} missed {missed} events", ids.space_id);
					continue;
				}
				Err(RecvError::Closed) => return Ended::Dropped("the local event stream closed".to_owned()),
			},
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

enum Received {
	Call(bridge::MemberCall),
	Answer(String),
	Nothing,
	Ended(Ended),
}

fn received(frame: Option<Result<Message, SocketError>>, ids: Ids<'_>) -> Received {
	match frame {
		Some(Ok(Message::Text(text))) => match bridge::member_call(text.as_str()) {
			Ok(call) => Received::Call(call),
			Err(refusal) => Received::Answer(refusal),
		},
		Some(Ok(Message::Binary(_))) => Received::Answer(bridge::refused(None)),
		Some(Ok(Message::Close(frame))) => Received::Ended(closed_by_relay(frame, ids)),
		Some(Ok(_)) => Received::Nothing,
		Some(Err(error)) => {
			Received::Ended(Ended::Dropped(format!("the relay socket failed: {error}")))
		}
		None => Received::Ended(Ended::Dropped("the relay socket ended".to_owned())),
	}
}

fn closed_by_relay(frame: Option<CloseFrame>, ids: Ids<'_>) -> Ended {
	let code = frame.as_ref().map(|frame| u16::from(frame.code));
	eprintln!(
		"the relay closed space {} (instance {}) with code {}",
		ids.space_id,
		ids.instance_id,
		code.map_or_else(|| "none".to_owned(), |code| code.to_string())
	);
	match code {
		Some(HOST_REPLACED) => Ended::Replaced,
		_ => Ended::Dropped(format!("the relay closed the socket with code {code:?}")),
	}
}

async fn closed(sink: &mut Sink, ids: Ids<'_>) -> Ended {
	let close = CloseFrame { code: CloseCode::Normal, reason: "".into() };
	match sent(sink, Message::Close(Some(close))).await {
		Ok(()) => eprintln!(
			"space {} (instance {}) closed its relay with code 1000",
			ids.space_id, ids.instance_id
		),
		Err(reason) => eprintln!(
			"space {} (instance {}) left its relay without the 1000 close frame: {reason}",
			ids.space_id, ids.instance_id
		),
	}
	Ended::Stopped
}

async fn sent(sink: &mut Sink, message: Message) -> Result<(), String> {
	match timeout(SEND_PATIENCE, sink.send(message)).await {
		Ok(Ok(())) => Ok(()),
		Ok(Err(error)) => Err(format!("the relay socket refused a frame: {error}")),
		Err(_) => Err(format!("the relay socket stalled on a frame for {SEND_PATIENCE:?}")),
	}
}

async fn until_stopped<F: Future>(stop: &mut watch::Receiver<bool>, work: F) -> Option<F::Output> {
	if *stop.borrow() {
		return None;
	}
	tokio::select! {
		_ = stop.changed() => None,
		done = work => Some(done),
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn the_backoff_doubles_from_one_second_to_a_minute_and_resets() {
		let mut backoff = Backoff(FIRST_BACKOFF);

		let waits: Vec<u64> = (0..8).map(|_| backoff.step().as_secs()).collect();
		backoff.reset();

		assert_eq!(waits, vec![1, 2, 4, 8, 16, 32, 60, 60]);
		assert_eq!(backoff.step(), FIRST_BACKOFF);
	}
}
