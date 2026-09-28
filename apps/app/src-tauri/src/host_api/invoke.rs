use axum::body::Bytes;
use axum::extract::rejection::BytesRejection;
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::Router;
use serde_json::{Map, Value};
use tauri::ipc::{CallbackFn, InvokeBody, InvokeError, InvokeResponse, InvokeResponseBody};
use tauri::webview::InvokeRequest;
use tauri::{Manager, Runtime, WebviewWindow};
use tokio::sync::oneshot;

use crate::routines::webhook::{named_here, Calls};

pub const PATH: &str = "/api/invoke/{command}";

pub const MAX_BODY_BYTES: usize = 128 * 1024 * 1024;

const MAIN_WEBVIEW: &str = "main";

const BEARER: &str = "Bearer ";

const JSON: &str = "application/json";

const BYTES: &str = "application/octet-stream";

const REFUSED: (StatusCode, &str) = (StatusCode::NOT_FOUND, "no host api answers this call");

const UNAUTHORIZED: (StatusCode, &str) =
	(StatusCode::UNAUTHORIZED, "the call carried no valid bearer token");

const UNREGISTERED: (StatusCode, &str) = (StatusCode::NOT_FOUND, "no command bears this name");

const TOO_LARGE: (StatusCode, &str) =
	(StatusCode::PAYLOAD_TOO_LARGE, "the call carried more than the cap");

const UNREADABLE: (StatusCode, &str) =
	(StatusCode::BAD_REQUEST, "the call carried no readable JSON arguments");

const DESKTOP_ONLY: (StatusCode, &str) = (
	StatusCode::SERVICE_UNAVAILABLE,
	"desktop-only: the command runs through the desktop window, which is not open",
);

const UNANSWERED: (StatusCode, &str) =
	(StatusCode::INTERNAL_SERVER_ERROR, "the command gave no answer");

pub(crate) fn route<R: Runtime>(calls: Calls<R>) -> Router<Calls<R>> {
	Router::new()
		.route(PATH, post(invoked::<R>).layer(DefaultBodyLimit::max(MAX_BODY_BYTES)))
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
	if !authorized(&calls, request.headers()) {
		return UNAUTHORIZED.into_response();
	}
	if declares_more_than_the_cap(request.headers()) {
		return TOO_LARGE.into_response();
	}
	next.run(request).await
}

fn declares_more_than_the_cap(headers: &HeaderMap) -> bool {
	headers
		.get(header::CONTENT_LENGTH)
		.and_then(|value| value.to_str().ok())
		.and_then(|value| value.parse::<usize>().ok())
		.is_some_and(|declared| declared > MAX_BODY_BYTES)
}

fn authorized<R: Runtime>(calls: &Calls<R>, headers: &HeaderMap) -> bool {
	let Some(token) = &calls.token else {
		return false;
	};
	headers
		.get(header::AUTHORIZATION)
		.and_then(|value| value.to_str().ok())
		.and_then(|value| value.strip_prefix(BEARER))
		.is_some_and(|presented| token.admits(presented))
}

async fn invoked<R: Runtime>(
	State(calls): State<Calls<R>>,
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
	let Some(webview) = calls.app.get_webview_window(MAIN_WEBVIEW) else {
		return DESKTOP_ONLY.into_response();
	};
	match dispatched(webview, command.clone(), arguments).await {
		Some(response) => answered(&command, response),
		None => UNANSWERED.into_response(),
	}
}

fn names_an_app_command(command: &str) -> bool {
	!command.is_empty()
		&& command
			.bytes()
			.all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

fn arguments(body: &[u8]) -> Option<Value> {
	if body.is_empty() {
		return Some(Value::Object(Map::new()));
	}
	serde_json::from_slice(body).ok()
}

fn unread(rejection: BytesRejection) -> Response {
	match rejection.status() {
		StatusCode::PAYLOAD_TOO_LARGE => TOO_LARGE.into_response(),
		_ => UNREADABLE.into_response(),
	}
}

async fn dispatched<R: Runtime>(
	webview: WebviewWindow<R>,
	command: String,
	arguments: Value,
) -> Option<InvokeResponse> {
	let url = match webview.url() {
		Ok(url) => url,
		Err(failure) => {
			eprintln!("the desktop window gave no address to invoke {command} from: {failure}");
			return None;
		}
	};
	let request = InvokeRequest {
		cmd: command.clone(),
		callback: CallbackFn(0),
		error: CallbackFn(1),
		url,
		body: InvokeBody::Json(arguments),
		headers: HeaderMap::new(),
		invoke_key: webview.app_handle().invoke_key().to_owned(),
	};
	let (answer, answering) = oneshot::channel();
	let responder = Box::new(move |_, _, response, _, _| {
		if answer.send(response).is_err() {
			eprintln!("the command {command} answered after its caller left");
		}
	});
	tauri::async_runtime::spawn_blocking(move || webview.on_message(request, responder));
	answering.await.ok()
}

fn answered(command: &str, response: InvokeResponse) -> Response {
	match response {
		InvokeResponse::Ok(InvokeResponseBody::Json(json)) => {
			(StatusCode::OK, [(header::CONTENT_TYPE, JSON)], json).into_response()
		}
		InvokeResponse::Ok(InvokeResponseBody::Raw(bytes)) => {
			(StatusCode::OK, [(header::CONTENT_TYPE, BYTES)], bytes).into_response()
		}
		InvokeResponse::Err(InvokeError(error)) if error == unregistered(command) => {
			UNREGISTERED.into_response()
		}
		InvokeResponse::Err(InvokeError(error)) => {
			(StatusCode::INTERNAL_SERVER_ERROR, [(header::CONTENT_TYPE, JSON)], error.to_string())
				.into_response()
		}
	}
}

fn unregistered(command: &str) -> Value {
	Value::String(format!("Command {command} not found"))
}
