use std::future::IntoFuture;
use std::net::Ipv4Addr;
use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::rejection::BytesRejection;
use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde_json::Value;
use tokio::net::TcpListener;
use tokio::sync::watch;

use super::member_link::MemberLink;
use crate::host_api::invoke::{
	self, arguments, bearer_admitted, declares_more_than_the_cap, names_an_app_command, unread,
	JSON, MAX_BODY_BYTES, REFUSED, TOO_LARGE, UNAUTHORIZED, UNREADABLE, UNREGISTERED,
};
use crate::host_api::token::HostToken;
use crate::host_api::{cors, events};
use crate::hosting::relay::until_stopped;
use crate::routines::webhook::named_here;

const HOST_OFFLINE: (StatusCode, &str) =
	(StatusCode::SERVICE_UNAVAILABLE, "the host of this space is offline");

#[derive(Clone)]
struct Proxy {
	link: Arc<MemberLink>,
	token: Arc<HostToken>,
}

pub(super) async fn served(
	link: Arc<MemberLink>,
	token: Arc<HostToken>,
	mut stop: watch::Receiver<bool>,
) -> std::io::Result<String> {
	let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
	let origin = format!("http://{}", listener.local_addr()?);
	let router = routed(Proxy { link, token });
	tauri::async_runtime::spawn(async move {
		if let Some(Err(failure)) =
			until_stopped(&mut stop, axum::serve(listener, router).into_future()).await
		{
			eprintln!("a joined space proxy stopped serving: {failure}");
		}
	});
	Ok(origin)
}

fn routed(proxy: Proxy) -> Router {
	let invokes = Router::new()
		.route(invoke::PATH, post(invoked).layer(DefaultBodyLimit::max(MAX_BODY_BYTES)))
		.route_layer(middleware::from_fn_with_state(proxy.clone(), invoke_guarded));
	let events = Router::new()
		.route(events::PATH, get(events_opened))
		.route_layer(middleware::from_fn_with_state(proxy.clone(), events_guarded));
	invokes.merge(events).layer(middleware::from_fn(cors::shared)).with_state(proxy)
}

async fn invoke_guarded(State(proxy): State<Proxy>, request: Request, next: Next) -> Response {
	if !named_here(request.headers()) {
		return REFUSED.into_response();
	}
	if !bearer_admitted(&proxy.token, request.headers()) {
		return UNAUTHORIZED.into_response();
	}
	if declares_more_than_the_cap(request.headers()) {
		return TOO_LARGE.into_response();
	}
	next.run(request).await
}

async fn events_guarded(State(proxy): State<Proxy>, request: Request, next: Next) -> Response {
	if !named_here(request.headers()) {
		return REFUSED.into_response();
	}
	if !bearer_admitted(&proxy.token, request.headers())
		&& !events::query_admitted(&proxy.token, request.uri())
	{
		return UNAUTHORIZED.into_response();
	}
	next.run(request).await
}

async fn invoked(
	State(proxy): State<Proxy>,
	Path(command): Path<String>,
	body: Result<Bytes, BytesRejection>,
) -> Response {
	if !names_an_app_command(&command) {
		return UNREGISTERED.into_response();
	}
	let arguments = match body {
		Ok(body) => arguments(&body),
		Err(rejection) => return unread(rejection),
	};
	let Some(arguments) = arguments else {
		return UNREADABLE.into_response();
	};
	match proxy.link.called(&command, arguments).await {
		Some(answer) => answered(answer.status, answer.body),
		None => HOST_OFFLINE.into_response(),
	}
}

fn answered(status: u16, body: Value) -> Response {
	let status = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
	match body {
		Value::String(text) if !is_json_answered(status) => (status, text).into_response(),
		body => (status, [(header::CONTENT_TYPE, JSON)], body.to_string()).into_response(),
	}
}

fn is_json_answered(status: StatusCode) -> bool {
	status.is_success() || status == StatusCode::INTERNAL_SERVER_ERROR
}

async fn events_opened(State(proxy): State<Proxy>, upgrade: WebSocketUpgrade) -> Response {
	let Some(heard) = proxy.link.subscribed() else {
		return HOST_OFFLINE.into_response();
	};
	upgrade
		.on_failed_upgrade(|failure| {
			eprintln!("a joined space proxy event client never connected: {failure}")
		})
		.on_upgrade(|socket| events::relayed(socket, heard))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_text_refusal_crosses_as_text_and_a_command_answer_as_json() {
		let refusal = answered(404, Value::String("no command bears this name".to_owned()));
		let command_error = answered(500, Value::String("failed".to_owned()));
		let success = answered(200, serde_json::json!({ "a": 1 }));

		assert_eq!(refusal.status(), StatusCode::NOT_FOUND);
		assert!(refusal.headers().get(header::CONTENT_TYPE).is_some_and(|kind| kind != JSON));
		for json in [command_error, success] {
			assert_eq!(
				json.headers().get(header::CONTENT_TYPE).map(|kind| kind.as_bytes()),
				Some(JSON.as_bytes())
			);
		}
	}
}
