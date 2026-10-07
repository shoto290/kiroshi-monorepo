use std::future::IntoFuture;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use axum::extract::State;
use axum::http::{StatusCode, Uri};
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use reqwest::Url;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Notify};

use super::contract::AccountFailure;

pub const CALLBACK_PATH: &str = "/callback";

const NONCE_BYTES: usize = 32;

const INVALID_TOKEN: &str = "INVALID_TOKEN";

const SERVER_ERROR: &str = "SERVER_ERROR";

const SIGNED_IN_PAGE: &str = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Kiroshi</title></head><body><p>You are signed in to Kiroshi. You can close this tab and go back to the app.</p></body></html>";

const REFUSED_PAGE: &str = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Kiroshi</title></head><body><p>This sign-in link did not work. Ask Kiroshi for a new one.</p></body></html>";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Delivered {
	Bearer(String),
	Refused(AccountFailure),
}

pub fn nonce() -> Result<String, getrandom::Error> {
	let mut bytes = [0u8; NONCE_BYTES];
	getrandom::fill(&mut bytes)?;
	Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub fn callback_url(port: u16, nonce: &str) -> String {
	format!("http://127.0.0.1:{port}{CALLBACK_PATH}?state={nonce}")
}

pub async fn awaited(listener: TcpListener, nonce: String, bound: Duration) -> Option<Delivered> {
	let (deliver, delivered) = oneshot::channel();
	let expecting =
		Expecting { nonce: Arc::from(nonce), deliver: Arc::new(Mutex::new(Some(deliver))) };
	let router = Router::new().route(CALLBACK_PATH, get(answered)).with_state(expecting);
	let stop = Arc::new(Notify::new());
	let stopped = Arc::clone(&stop);
	let serving = axum::serve(listener, router)
		.with_graceful_shutdown(async move { stopped.notified().await })
		.into_future();
	let settling = async move {
		let settled = tokio::time::timeout(bound, delivered).await.ok().and_then(Result::ok);
		stop.notify_one();
		settled
	};
	let (served, settled) = tokio::join!(serving, settling);
	if let Err(error) = served {
		eprintln!("the account callback listener stopped on an error: {error}");
	}
	settled
}

#[derive(Clone)]
struct Expecting {
	nonce: Arc<str>,
	deliver: Arc<Mutex<Option<oneshot::Sender<Delivered>>>>,
}

#[derive(Default)]
struct Answer {
	state: Option<String>,
	token: Option<String>,
	error: Option<String>,
}

impl Answer {
	fn read(uri: &Uri) -> Self {
		let Ok(url) = Url::parse(&format!("http://127.0.0.1{uri}")) else {
			return Self::default();
		};
		let named = |name: &str| {
			url.query_pairs().find(|(key, _)| key == name).map(|(_, value)| value.into_owned())
		};
		Self { state: named("state"), token: named("token"), error: named("error") }
	}
}

async fn answered(
	State(expecting): State<Expecting>,
	uri: Uri,
) -> (StatusCode, Html<&'static str>) {
	let answer = Answer::read(&uri);
	if answer.state.as_deref() != Some(&*expecting.nonce) {
		return (StatusCode::BAD_REQUEST, Html(REFUSED_PAGE));
	}
	let Some(delivered) = delivered_by(answer) else {
		return (StatusCode::BAD_REQUEST, Html(REFUSED_PAGE));
	};
	let page = match delivered {
		Delivered::Bearer(_) => SIGNED_IN_PAGE,
		Delivered::Refused(_) => REFUSED_PAGE,
	};
	let deliver = expecting.deliver.lock().unwrap_or_else(PoisonError::into_inner).take();
	match deliver.map(|deliver| deliver.send(delivered)) {
		Some(Ok(())) => (StatusCode::OK, Html(page)),
		_ => (StatusCode::GONE, Html(REFUSED_PAGE)),
	}
}

fn delivered_by(answer: Answer) -> Option<Delivered> {
	match (answer.token, answer.error.as_deref()) {
		(Some(token), None) if !token.is_empty() => Some(Delivered::Bearer(token)),
		(None, Some(INVALID_TOKEN)) => Some(Delivered::Refused(AccountFailure::LinkInvalid)),
		(None, Some(SERVER_ERROR)) => Some(Delivered::Refused(AccountFailure::ServerError)),
		_ => None,
	}
}
