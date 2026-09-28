use axum::extract::ws::{close_code, CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Request, State};
use axum::http::Uri;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use tauri::Runtime;
use tokio::sync::broadcast::error::RecvError;
use tokio::sync::broadcast::Receiver;

use super::invoke::{self, REFUSED, UNAUTHORIZED};
use crate::events::{self, Frame};
use crate::routines::webhook::{named_here, Calls};

pub const PATH: &str = "/api/events";

const TOKEN_PARAMETER: &str = "token=";

const FELL_BEHIND: &str = "the client fell behind the event buffer";

type Heard = Option<Result<Message, axum::Error>>;

pub(crate) fn route<R: Runtime>(calls: Calls<R>) -> Router<Calls<R>> {
	Router::new()
		.route(PATH, get(opened::<R>))
		.route_layer(middleware::from_fn_with_state(calls, guarded::<R>))
}

async fn guarded<R: Runtime>(
	State(calls): State<Calls<R>>,
	request: Request,
	next: Next,
) -> Response {
	if !named_here(request.headers()) {
		return REFUSED.into_response();
	}
	if !invoke::authorized(&calls, request.headers())
		&& !queried_token_admitted(&calls, request.uri())
	{
		return UNAUTHORIZED.into_response();
	}
	next.run(request).await
}

fn queried_token_admitted<R: Runtime>(calls: &Calls<R>, uri: &Uri) -> bool {
	let Some(token) = &calls.token else {
		return false;
	};
	uri.query()
		.and_then(|query| query.split('&').find_map(|pair| pair.strip_prefix(TOKEN_PARAMETER)))
		.is_some_and(|presented| token.admits(presented))
}

async fn opened<R: Runtime>(State(calls): State<Calls<R>>, upgrade: WebSocketUpgrade) -> Response {
	let heard = events::subscribed(&calls.app);
	upgrade
		.on_failed_upgrade(|failure| {
			eprintln!("a host api event client never connected: {failure}")
		})
		.on_upgrade(|socket| relayed(socket, heard))
}

async fn relayed(mut socket: WebSocket, mut heard: Receiver<Frame>) {
	loop {
		tokio::select! {
			frame = heard.recv() => match frame {
				Ok(frame) => {
					if let Err(failure) = socket.send(Message::Text(frame.as_ref().into())).await {
						return eprintln!("a host api event client left mid frame: {failure}");
					}
				}
				Err(RecvError::Lagged(missed)) => return fell_behind(socket, missed).await,
				Err(RecvError::Closed) => return,
			},
			sent = socket.recv() => {
				if !keeps_listening(sent) {
					return;
				}
			}
		}
	}
}

fn keeps_listening(sent: Heard) -> bool {
	match sent {
		None | Some(Ok(Message::Close(_))) => false,
		Some(Ok(_)) => true,
		Some(Err(failure)) => {
			eprintln!("a host api event client was dropped: its socket failed: {failure}");
			false
		}
	}
}

async fn fell_behind(mut socket: WebSocket, missed: u64) {
	let close = CloseFrame { code: close_code::AGAIN, reason: FELL_BEHIND.into() };
	match socket.send(Message::Close(Some(close))).await {
		Ok(()) => eprintln!("a host api event client was dropped: it fell {missed} events behind"),
		Err(failure) => eprintln!(
			"a host api event client was dropped: it fell {missed} events behind, and took no close frame: {failure}"
		),
	}
}
