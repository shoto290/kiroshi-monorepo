use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use reqwest::header::{ACCEPT, WWW_AUTHENTICATE};
use reqwest::{Client, StatusCode};
use serde_json::json;
use tokio::task::JoinSet;

use crate::missions::github::installed_tls_provider;

const ASKING_BOUND: Duration = Duration::from_millis(3000);

const ANSWER_HELD_MS: i64 = 600_000;

const MCP_ACCEPT: &str = "application/json, text/event-stream";

const MCP_PROTOCOL_VERSION: &str = "2025-06-18";

#[derive(Clone, Copy)]
struct Answer {
	asks: bool,
	at: i64,
}

#[derive(Default)]
pub struct AuthorizationAnswers {
	held: Mutex<HashMap<String, Answer>>,
}

impl AuthorizationAnswers {
	pub async fn asking_authorization(&self, urls: HashSet<String>, now: i64) -> HashSet<String> {
		self.asked_within(urls, now, ASKING_BOUND).await
	}

	async fn asked_within(
		&self,
		urls: HashSet<String>,
		now: i64,
		bound: Duration,
	) -> HashSet<String> {
		let unanswered = self.unanswered(&urls, now);
		for (url, answer) in asked_at_once(unanswered, bound).await {
			self.hold(url, answer, now);
		}
		let held = self.held();
		urls.into_iter().filter(|url| held.get(url).is_some_and(|answer| answer.asks)).collect()
	}

	fn unanswered(&self, urls: &HashSet<String>, now: i64) -> Vec<String> {
		let held = self.held();
		urls.iter()
			.filter(|url| held.get(*url).is_none_or(|answer| now - answer.at >= ANSWER_HELD_MS))
			.cloned()
			.collect()
	}

	fn hold(&self, url: String, answer: Option<bool>, now: i64) {
		let mut held = self.held();
		match answer {
			Some(asks) => held.insert(url, Answer { asks, at: now }),
			None => held.remove(&url),
		};
	}

	fn held(&self) -> MutexGuard<'_, HashMap<String, Answer>> {
		self.held.lock().unwrap_or_else(PoisonError::into_inner)
	}
}

async fn asked_at_once(urls: Vec<String>, bound: Duration) -> Vec<(String, Option<bool>)> {
	if urls.is_empty() {
		return Vec::new();
	}
	let client = match asking_client() {
		Ok(client) => client,
		Err(error) => {
			eprintln!("no server was asked whether it asks for authorization: {error}");
			return urls.into_iter().map(|url| (url, None)).collect();
		}
	};
	let mut asking = JoinSet::new();
	for url in urls {
		let client = client.clone();
		asking.spawn(async move {
			let answer = answer_of(&client, &url, bound).await;
			(url, answer)
		});
	}
	let mut answers = Vec::new();
	while let Some(joined) = asking.join_next().await {
		match joined {
			Ok(answer) => answers.push(answer),
			Err(error) => eprintln!("a server was asked in a task that did not finish: {error}"),
		}
	}
	answers
}

fn asking_client() -> Result<Client, reqwest::Error> {
	installed_tls_provider();
	Client::builder().build()
}

async fn answer_of(client: &Client, url: &str, bound: Duration) -> Option<bool> {
	let asked = client.post(url).header(ACCEPT, MCP_ACCEPT).json(&an_initialize()).send();
	match tokio::time::timeout(bound, asked).await {
		Ok(Ok(answered)) => Some(asks_for_authorization(
			answered.status(),
			answered.headers().contains_key(WWW_AUTHENTICATE),
		)),
		Ok(Err(error)) => {
			eprintln!(
				"a server did not answer whether it asks for authorization: {}",
				error.without_url()
			);
			None
		}
		Err(_) => None,
	}
}

fn an_initialize() -> serde_json::Value {
	json!({
		"jsonrpc": "2.0",
		"id": 0,
		"method": "initialize",
		"params": {
			"protocolVersion": MCP_PROTOCOL_VERSION,
			"capabilities": {},
			"clientInfo": { "name": "kiroshi", "version": env!("CARGO_PKG_VERSION") }
		}
	})
}

fn asks_for_authorization(status: StatusCode, challenges: bool) -> bool {
	status == StatusCode::UNAUTHORIZED || (status == StatusCode::FORBIDDEN && challenges)
}

#[cfg(test)]
impl AuthorizationAnswers {
	pub fn answered(&self, url: &str, asks: bool, at: i64) {
		self.hold(url.to_owned(), Some(asks), at);
	}
}

#[cfg(test)]
mod tests {
	use std::net::{Ipv4Addr, SocketAddr};
	use std::sync::atomic::{AtomicUsize, Ordering};
	use std::sync::Arc;
	use std::time::Instant;

	use axum::extract::{Path as AxumPath, State as Extracted};
	use axum::http::{HeaderMap, StatusCode as Answered};
	use axum::routing::post;
	use axum::Router;
	use tokio::sync::watch as signal;

	use super::*;

	const NOW: i64 = 1_800_000_000_000;

	struct Stub {
		base: String,
		asked: Arc<AtomicUsize>,
		_stop: signal::Sender<bool>,
	}

	impl Stub {
		async fn serving() -> Self {
			let asked = Arc::new(AtomicUsize::new(0));
			let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
				.await
				.expect("the stub binds");
			let address: SocketAddr = listener.local_addr().expect("the stub is named");
			let (stop, halted) = signal::channel(false);
			let router =
				Router::new().route("/{answer}", post(answer_named)).with_state(asked.clone());
			let mut halting = halted;
			tokio::spawn(async move {
				let _ = axum::serve(listener, router)
					.with_graceful_shutdown(async move {
						let _ = halting.changed().await;
					})
					.await;
			});
			Stub { base: format!("http://{address}"), asked, _stop: stop }
		}

		fn at(&self, answer: &str) -> String {
			format!("{}/{answer}", self.base)
		}

		fn asked(&self) -> usize {
			self.asked.load(Ordering::SeqCst)
		}
	}

	async fn answer_named(
		Extracted(asked): Extracted<Arc<AtomicUsize>>,
		AxumPath(answer): AxumPath<String>,
	) -> (Answered, HeaderMap) {
		asked.fetch_add(1, Ordering::SeqCst);
		let mut headers = HeaderMap::new();
		let challenge = || "Bearer resource_metadata=\"x\"".parse().expect("the header parses");
		let status = match answer.as_str() {
			"challenged-401" => {
				headers.insert(WWW_AUTHENTICATE, challenge());
				Answered::UNAUTHORIZED
			}
			"bare-401" => Answered::UNAUTHORIZED,
			"challenged-403" => {
				headers.insert(WWW_AUTHENTICATE, challenge());
				Answered::FORBIDDEN
			}
			"bare-403" => Answered::FORBIDDEN,
			"stalled" => {
				tokio::time::sleep(Duration::from_millis(2000)).await;
				Answered::UNAUTHORIZED
			}
			"slow-401" => {
				tokio::time::sleep(Duration::from_millis(400)).await;
				Answered::UNAUTHORIZED
			}
			"not-found" => Answered::NOT_FOUND,
			_ => Answered::OK,
		};
		(status, headers)
	}

	fn urls(stub: &Stub, answers: &[&str]) -> HashSet<String> {
		answers.iter().map(|answer| stub.at(answer)).collect()
	}

	#[tokio::test]
	async fn a_401_or_a_403_carrying_a_challenge_reads_as_asking_for_authorization() {
		let stub = Stub::serving().await;
		let asked = urls(
			&stub,
			&["challenged-401", "bare-401", "challenged-403", "bare-403", "ok", "not-found"],
		);

		let asking = AuthorizationAnswers::default().asking_authorization(asked, NOW).await;

		assert_eq!(asking, urls(&stub, &["challenged-401", "bare-401", "challenged-403"]));
	}

	#[tokio::test]
	async fn a_server_answering_nothing_within_its_bound_holds_no_answer() {
		let stub = Stub::serving().await;
		let answers = AuthorizationAnswers::default();

		let asking =
			answers.asked_within(urls(&stub, &["stalled"]), NOW, Duration::from_millis(200)).await;

		assert!(asking.is_empty());
		assert!(answers.held().is_empty());
	}

	#[tokio::test]
	async fn a_server_nothing_listens_on_holds_no_answer() {
		let answers = AuthorizationAnswers::default();
		let closed = HashSet::from(["http://127.0.0.1:9/mcp".to_owned()]);

		assert!(answers.asking_authorization(closed, NOW).await.is_empty());
		assert!(answers.held().is_empty());
	}

	#[tokio::test]
	async fn a_held_answer_is_read_without_asking_until_it_ages_past_its_hold() {
		let stub = Stub::serving().await;
		let answers = AuthorizationAnswers::default();
		let asked = urls(&stub, &["challenged-401"]);

		answers.asking_authorization(asked.clone(), NOW).await;
		let held = answers.asking_authorization(asked.clone(), NOW + ANSWER_HELD_MS - 1).await;

		assert_eq!(stub.asked(), 1);
		assert_eq!(held, asked);

		answers.asking_authorization(asked.clone(), NOW + ANSWER_HELD_MS).await;

		assert_eq!(stub.asked(), 2);
	}

	#[tokio::test]
	async fn an_aged_answer_the_server_no_longer_gives_is_dropped() {
		let stub = Stub::serving().await;
		let stalled = stub.at("stalled");
		let answers = AuthorizationAnswers::default();
		answers.answered(&stalled, true, NOW - ANSWER_HELD_MS);

		let asking =
			answers.asked_within(HashSet::from([stalled]), NOW, Duration::from_millis(200)).await;

		assert!(asking.is_empty());
		assert!(answers.held().is_empty());
	}

	#[tokio::test]
	async fn several_servers_are_asked_at_the_same_time() {
		let stub = Stub::serving().await;
		let asked: HashSet<String> =
			(0..4).map(|each| format!("{}?each={each}", stub.at("slow-401"))).collect();
		let started = Instant::now();

		let asking = AuthorizationAnswers::default().asking_authorization(asked.clone(), NOW).await;

		assert_eq!(asking, asked);
		assert!(started.elapsed() < Duration::from_millis(1200), "{:?}", started.elapsed());
	}
}
