use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Arc, PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::Duration;

use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::watch as signal;
use tokio::sync::Mutex;

use super::contract::{Application, ApplicationSearch, ApplicationsError, AuthPosture, Install};
use super::registry::{client, endpoint, parsed, read, SSE, STREAMABLE_HTTP};
use super::search::terms;
use crate::db::repositories::catalogue::folded;
use crate::routines::core::{Clock, SystemClock};

pub const DIRECTORY: &str = "https://api.anthropic.com";

const SEGMENTS: [&str; 3] = ["api", "directory", "servers"];

const LIMIT: &str = "5000";

const VISIBILITY: &str = "commercial,gsuite,gsuite-google";

const PAGES: usize = 4;

const SCHEMA: u32 = 1;

const DAY_MS: i64 = 24 * 60 * 60 * 1000;

const TICK: Duration = Duration::from_secs(60 * 60);

const CACHE_DIR: &str = "applications";

const CACHE_FILE: &str = "directory.json";

const HTTPS: &str = "https";

const HTTP: &str = "http";

const REMOTE: &str = "remote";

const TRUSTED_TIERS: [&str; 2] = ["anthropic", "partner"];

const OTHER: &str = "Other";

pub const BUCKETS: [(&str, &[&str]); 16] = [
	("Commerce & shopping", &["commerce-shopping", "e-commerce"]),
	("Communication", &["communication"]),
	("Consumer health", &["consumer-health"]),
	("Creative", &["creative", "design"]),
	("Data & analytics", &["data-analytics", "data"]),
	("Developer tools", &["developer-tools", "code"]),
	("Education", &["education"]),
	("Financial services", &["financial-services"]),
	("Health & life sciences", &["health-life-sciences", "life-sciences", "health", "healthcare"]),
	("Legal", &["legal"]),
	("Media & entertainment", &["media-entertainment"]),
	("Nonprofit", &["nonprofit"]),
	("Productivity", &["productivity", "business-productivity"]),
	("Sales & marketing", &["sales-and-marketing"]),
	("Travel", &["travel"]),
	(OTHER, &["other", "technology"]),
];

const AUTH_REQUIRED: &str = "auth_required";

const NO_AUTH: &str = "no_auth";

#[derive(Deserialize)]
struct Page {
	#[serde(default)]
	servers: Vec<Entry>,
	#[serde(default)]
	next_cursor: Option<String>,
}

#[derive(Deserialize)]
struct Entry {
	name: String,
	#[serde(rename = "type")]
	kind: String,
	#[serde(default)]
	rank: i64,
	#[serde(default)]
	display_name: Option<String>,
	#[serde(default)]
	one_liner: Option<String>,
	#[serde(default)]
	description: Option<String>,
	#[serde(default)]
	categories: Option<Vec<String>>,
	#[serde(default)]
	icon_url: Option<String>,
	#[serde(default)]
	tool_names: Option<Vec<String>>,
	#[serde(default)]
	verified_tier: Option<String>,
	#[serde(default)]
	popularity_score: Option<u64>,
	#[serde(default)]
	remote: Option<Remote>,
}

#[derive(Deserialize)]
struct Remote {
	#[serde(default)]
	url: Option<String>,
	#[serde(default)]
	transport: Option<String>,
	#[serde(default)]
	auth_posture: Option<String>,
}

struct Ranked {
	rank: i64,
	application: Application,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Cached {
	schema: u32,
	read_at: i64,
	applications: Vec<Application>,
}

#[derive(Default)]
struct Held {
	cached: Option<Cached>,
	failure: Option<ApplicationsError>,
	is_disk_read: bool,
}

pub struct Directory {
	base: String,
	file: Option<PathBuf>,
	clock: Box<dyn Clock>,
	held: RwLock<Held>,
	reading: Mutex<()>,
	stop: signal::Sender<bool>,
}

impl std::fmt::Debug for Directory {
	fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		formatter
			.debug_struct("Directory")
			.field("base", &self.base)
			.field("is_held", &self.kept().cached.is_some())
			.finish()
	}
}

impl Directory {
	pub fn at(base: String, file: Option<PathBuf>) -> Self {
		Self::timed(base, file, Box::new(SystemClock))
	}

	fn timed(base: String, file: Option<PathBuf>, clock: Box<dyn Clock>) -> Self {
		Self {
			base,
			file,
			clock,
			held: RwLock::new(Held::default()),
			reading: Mutex::new(()),
			stop: signal::channel(false).0,
		}
	}

	pub fn stop(&self) {
		self.stop.send_replace(true);
	}

	pub async fn searched(&self, query: &str) -> Result<ApplicationSearch, ApplicationsError> {
		if self.is_unread() {
			self.refreshed().await;
		}
		let held = self.kept();
		let Some(cached) = held.cached.as_ref() else {
			return Err(held.failure.clone().unwrap_or_else(unread_directory));
		};
		Ok(ApplicationSearch {
			applications: matched(&cached.applications, query),
			registry_failure: held.failure.clone(),
			read_at: Some(cached.read_at),
			is_stale: Some(is_stale(cached.read_at, self.clock.now_ms())),
		})
	}

	pub fn named(&self, name: &str) -> Option<Application> {
		self.kept().cached.as_ref()?.applications.iter().find(|held| held.name == name).cloned()
	}

	pub async fn refreshed(&self) {
		let _reading = self.reading.lock().await;
		self.kept_file();
		if self.is_fresh() {
			return;
		}
		self.fetched().await;
	}

	fn kept(&self) -> RwLockReadGuard<'_, Held> {
		self.held.read().unwrap_or_else(PoisonError::into_inner)
	}

	fn keeping(&self) -> RwLockWriteGuard<'_, Held> {
		self.held.write().unwrap_or_else(PoisonError::into_inner)
	}

	fn is_unread(&self) -> bool {
		let held = self.kept();
		held.cached.is_none() && held.failure.is_none()
	}

	fn is_fresh(&self) -> bool {
		let now = self.clock.now_ms();
		self.kept().cached.as_ref().is_some_and(|cached| !is_stale(cached.read_at, now))
	}

	fn kept_file(&self) {
		if self.kept().is_disk_read {
			return;
		}
		let cached = self.file.as_deref().and_then(from_file);
		let mut held = self.keeping();
		held.is_disk_read = true;
		held.cached = cached;
	}

	async fn fetched(&self) {
		match listed(&self.base).await {
			Ok(applications) => {
				let cached = Cached { schema: SCHEMA, read_at: self.clock.now_ms(), applications };
				if let Some(file) = self.file.as_deref() {
					to_file(file, &cached);
				}
				let mut held = self.keeping();
				held.cached = Some(cached);
				held.failure = None;
			}
			Err(failure) => {
				eprintln!("the Anthropic directory was not read: {failure:?}");
				self.keeping().failure = Some(failure);
			}
		}
	}
}

pub fn spawn<R: Runtime>(app: AppHandle<R>) -> Arc<Directory> {
	let directory = Arc::new(Directory::at(DIRECTORY.to_owned(), file(&app)));
	tauri::async_runtime::spawn(watching(directory.clone(), directory.stop.subscribe()));
	directory
}

async fn watching(directory: Arc<Directory>, mut halted: signal::Receiver<bool>) {
	let mut ticker = tokio::time::interval(TICK);
	loop {
		tokio::select! {
			_ = halted.changed() => return,
			_ = ticker.tick() => directory.refreshed().await,
		}
	}
}

fn file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
	Some(app.path().app_data_dir().ok()?.join(CACHE_DIR).join(CACHE_FILE))
}

fn unread_directory() -> ApplicationsError {
	ApplicationsError::RegistryUnreadable {
		detail: "the Anthropic directory was never read and no cache is held".to_owned(),
	}
}

fn is_stale(read_at: i64, now: i64) -> bool {
	now - read_at > DAY_MS
}

fn matched(applications: &[Application], query: &str) -> Vec<Application> {
	let wanted = wanted(query);
	if wanted.is_empty() {
		return applications.to_vec();
	}
	applications.iter().filter(|held| carries(held, &wanted)).cloned().collect()
}

fn wanted(query: &str) -> Vec<String> {
	let held: Vec<String> = terms(query).iter().map(|term| folded(term)).collect();
	if !held.is_empty() {
		return held;
	}
	let whole = folded(query.trim());
	if whole.is_empty() {
		return Vec::new();
	}
	vec![whole]
}

fn carries(application: &Application, wanted: &[String]) -> bool {
	let searchable = folded(&format!(
		"{} {} {}",
		application.name,
		application.description,
		application.categories.join(" ")
	));
	wanted.iter().all(|term| searchable.contains(term))
}

async fn listed(base: &str) -> Result<Vec<Application>, ApplicationsError> {
	let client = client()?;
	let base = parsed(base)?;
	let mut entries = Vec::new();
	let mut cursor: Option<String> = None;
	for _ in 0..PAGES {
		let page: Page = read(&client, listing(&base, cursor.as_deref())?).await?;
		entries.extend(page.servers);
		cursor = page.next_cursor;
		if cursor.is_none() {
			break;
		}
	}
	let applications = mapped(entries);
	if let Some(line) = left_unread(applications.len(), cursor.as_deref()) {
		eprintln!("{line}");
	}
	if applications.is_empty() {
		return Err(answered_nothing());
	}
	Ok(applications)
}

fn left_unread(held: usize, cursor: Option<&str>) -> Option<String> {
	cursor.map(|cursor| {
		format!(
			"the Anthropic directory holds {held} applications after {PAGES} pages and left the cursor {cursor} unread"
		)
	})
}

fn answered_nothing() -> ApplicationsError {
	ApplicationsError::RegistryUnreadable {
		detail: "the Anthropic directory answered no application this reader serves".to_owned(),
	}
}

fn listing(base: &Url, cursor: Option<&str>) -> Result<Url, ApplicationsError> {
	let mut url = endpoint(base, &SEGMENTS)?;
	url.query_pairs_mut().append_pair("limit", LIMIT).append_pair("visibility", VISIBILITY);
	if let Some(cursor) = cursor {
		url.query_pairs_mut().append_pair("cursor", cursor);
	}
	Ok(url)
}

fn mapped(entries: Vec<Entry>) -> Vec<Application> {
	let mut seen = HashSet::new();
	let mut ranked: Vec<Ranked> = entries
		.into_iter()
		.filter_map(served)
		.filter(|held| seen.insert(held.application.name.clone()))
		.collect();
	ranked.sort_by_key(|held| held.rank);
	ranked.into_iter().map(|held| held.application).collect()
}

fn served(entry: Entry) -> Option<Ranked> {
	if entry.kind != REMOTE {
		return None;
	}
	if entry.verified_tier.as_deref().is_some_and(|tier| !trusted(tier)) {
		return None;
	}
	let remote = entry.remote?;
	let url = secure(remote.url.as_deref()?)?;
	let config = configured(remote.transport.as_deref()?, url)?;
	let auth_posture = remote.auth_posture.as_deref().and_then(posture);
	let title = entry.display_name.filter(|held| !held.is_empty());
	Some(Ranked {
		rank: entry.rank,
		application: Application {
			title: title.unwrap_or_else(|| entry.name.clone()),
			name: entry.name,
			description: described(entry.one_liner, entry.description),
			config,
			tools: entry.tool_names.filter(|held| !held.is_empty()),
			logo: None,
			logo_url: entry.icon_url,
			use_count: entry.popularity_score,
			verified: entry.verified_tier.as_deref().map(trusted),
			hosted_by: None,
			categories: bucketed(entry.categories.unwrap_or_default()),
			auth_posture,
			install: installed(auth_posture),
		},
	})
}

fn secure(url: &str) -> Option<&str> {
	(Url::parse(url).ok()?.scheme() == HTTPS).then_some(url)
}

fn configured(transport: &str, url: &str) -> Option<Value> {
	let kind = match transport {
		STREAMABLE_HTTP => HTTP,
		SSE => SSE,
		_ => return None,
	};
	Some(json!({ "type": kind, "url": url }))
}

fn posture(held: &str) -> Option<AuthPosture> {
	match held {
		AUTH_REQUIRED => Some(AuthPosture::AuthRequired),
		NO_AUTH => Some(AuthPosture::NoAuth),
		_ => None,
	}
}

fn installed(posture: Option<AuthPosture>) -> Install {
	match posture {
		Some(AuthPosture::NoAuth) => Install::Nothing,
		_ => Install::Oauth,
	}
}

fn trusted(tier: &str) -> bool {
	TRUSTED_TIERS.contains(&tier)
}

fn bucketed(categories: Vec<String>) -> Vec<String> {
	let mut folded: Vec<String> = Vec::new();
	for value in categories {
		let held = bucket(&value);
		if !folded.iter().any(|kept| kept == held) {
			folded.push(held.to_owned());
		}
	}
	if folded.is_empty() {
		folded.push(OTHER.to_owned());
	}
	folded
}

fn bucket(value: &str) -> &'static str {
	BUCKETS.iter().find(|(_, values)| values.contains(&value)).map_or(OTHER, |(name, _)| *name)
}

fn described(one_liner: Option<String>, description: Option<String>) -> String {
	one_liner.filter(|held| !held.is_empty()).or(description).unwrap_or_default()
}

fn from_file(file: &Path) -> Option<Cached> {
	let bytes = match fs::read(file) {
		Ok(bytes) => bytes,
		Err(error) if error.kind() == ErrorKind::NotFound => return None,
		Err(error) => return unreadable(&error.to_string()),
	};
	match serde_json::from_slice::<Cached>(&bytes) {
		Ok(cached) if cached.schema == SCHEMA => Some(cached),
		Ok(cached) => {
			let schema = cached.schema;
			unreadable(&format!("it carries schema {schema} and this build reads {SCHEMA}"))
		}
		Err(error) => unreadable(&error.to_string()),
	}
}

fn unreadable(reason: &str) -> Option<Cached> {
	eprintln!("the directory cache {CACHE_DIR}/{CACHE_FILE} was not read: {reason}");
	None
}

fn to_file(file: &Path, cached: &Cached) {
	if let Err(reason) = written(file, cached) {
		eprintln!("the directory cache {CACHE_DIR}/{CACHE_FILE} was not written: {reason}");
	}
}

fn written(file: &Path, cached: &Cached) -> Result<(), String> {
	if let Some(parent) = file.parent() {
		fs::create_dir_all(parent).map_err(|error| error.to_string())?;
	}
	let body = serde_json::to_vec(cached).map_err(|error| error.to_string())?;
	fs::write(file, body).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
	use std::collections::BTreeSet;
	use std::net::{Ipv4Addr, SocketAddr};
	use std::sync::Mutex as Recorded;

	use axum::extract::State as Extracted;
	use axum::http::Uri;
	use axum::response::{IntoResponse, Response as Answered};
	use axum::routing::get;
	use axum::Router;
	use reqwest::StatusCode;
	use serde_json::to_value;

	use super::*;
	use crate::db::connection::temp_dir;

	const NOON: i64 = 1_700_000_000_000;

	struct Stopped(i64);

	impl Clock for Stopped {
		fn now_ms(&self) -> i64 {
			self.0
		}
	}

	struct Served {
		pages: Vec<Value>,
		refusals: Recorded<usize>,
		asked: Recorded<Vec<String>>,
		queried: Recorded<Vec<String>>,
	}

	impl Served {
		fn refuses_once(&self) -> bool {
			let mut refusals = self.refusals.lock().expect("the stub records");
			let refuses = *refusals > 0;
			*refusals = refusals.saturating_sub(1);
			refuses
		}
	}

	async fn serving(pages: Vec<Value>) -> (String, Arc<Served>) {
		let held = Arc::new(Served {
			pages,
			refusals: Recorded::new(0),
			asked: Recorded::new(Vec::new()),
			queried: Recorded::new(Vec::new()),
		});
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("the stub binds");
		let address: SocketAddr = listener.local_addr().expect("the stub is named");
		let router =
			Router::new().route("/api/directory/servers", get(page_of)).with_state(held.clone());
		tokio::spawn(async move { axum::serve(listener, router).await.expect("the stub serves") });
		(format!("http://{address}"), held)
	}

	async fn page_of(Extracted(held): Extracted<Arc<Served>>, uri: Uri) -> Answered {
		let cursor = asked_cursor(&uri);
		if held.refuses_once() {
			held.asked.lock().expect("the stub records").push(cursor.unwrap_or_default());
			return StatusCode::INTERNAL_SERVER_ERROR.into_response();
		}
		held.queried
			.lock()
			.expect("the stub records")
			.push(uri.query().unwrap_or_default().to_owned());
		held.asked.lock().expect("the stub records").push(cursor.clone().unwrap_or_default());
		let index = cursor.and_then(|held| held.parse::<usize>().ok()).unwrap_or(0);
		let servers = held.pages.get(index).cloned().unwrap_or_else(|| json!([]));
		let next = (index + 1 < held.pages.len()).then(|| (index + 1).to_string());
		as_json(&json!({ "servers": servers, "total": 0, "next_cursor": next }))
	}

	fn asked_cursor(uri: &Uri) -> Option<String> {
		uri.query()?
			.split('&')
			.filter_map(|pair| pair.split_once('='))
			.find(|(name, _)| *name == "cursor")
			.map(|(_, value)| value.to_owned())
	}

	fn as_json(held: &Value) -> Answered {
		Answered::builder()
			.status(StatusCode::OK)
			.header(reqwest::header::CONTENT_TYPE, "application/json")
			.body(axum::body::Body::from(held.to_string()))
			.expect("the stub answers with a body")
	}

	async fn unreached() -> String {
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
		let address = listener.local_addr().expect("the port is named");
		drop(listener);
		format!("http://{address}")
	}

	fn an_entry(name: &str, rank: i64) -> Value {
		json!({
			"type": "remote",
			"name": name,
			"rank": rank,
			"display_name": name,
			"one_liner": format!("{name} does things."),
			"description": "The long story.",
			"categories": ["productivity"],
			"icon_url": format!("https://{name}.test/icon.png"),
			"tool_names": ["read", "write"],
			"verified_tier": "partner",
			"popularity_score": 42,
			"remote": {
				"url": format!("https://{name}.test/mcp"),
				"transport": "streamable-http",
				"auth_posture": "auth_required",
			},
		})
	}

	fn a_page(names: &[&str]) -> Value {
		Value::Array(
			names
				.iter()
				.enumerate()
				.map(|(index, name)| an_entry(name, index as i64 + 1))
				.collect(),
		)
	}

	async fn read_from(pages: Vec<Value>) -> Vec<Application> {
		let (base, _) = serving(pages).await;
		listed(&base).await.expect("the directory reads")
	}

	async fn a_directory_over(pages: Vec<Value>) -> Directory {
		let (base, _) = serving(pages).await;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));
		directory.refreshed().await;
		directory
	}

	fn names(applications: &[Application]) -> Vec<&str> {
		applications.iter().map(|held| held.name.as_str()).collect()
	}

	#[tokio::test]
	async fn an_entry_reads_into_the_application_the_front_is_answered() {
		let read = read_from(vec![a_page(&["notion"])]).await;

		assert_eq!(
			to_value(&read[0]).expect("the application serialises"),
			json!({
				"name": "notion",
				"title": "notion",
				"description": "notion does things.",
				"config": { "type": "http", "url": "https://notion.test/mcp" },
				"tools": ["read", "write"],
				"logoUrl": "https://notion.test/icon.png",
				"useCount": 42,
				"verified": true,
				"categories": ["Productivity"],
				"authPosture": "authRequired",
				"install": { "kind": "oauth" },
			})
		);
	}

	#[test]
	fn every_bucket_names_the_directory_values_it_folds() {
		assert_eq!(
			BUCKETS.map(|(name, values)| (name, values.to_vec())),
			[
				("Commerce & shopping", vec!["commerce-shopping", "e-commerce"]),
				("Communication", vec!["communication"]),
				("Consumer health", vec!["consumer-health"]),
				("Creative", vec!["creative", "design"]),
				("Data & analytics", vec!["data-analytics", "data"]),
				("Developer tools", vec!["developer-tools", "code"]),
				("Education", vec!["education"]),
				("Financial services", vec!["financial-services"]),
				(
					"Health & life sciences",
					vec!["health-life-sciences", "life-sciences", "health", "healthcare"]
				),
				("Legal", vec!["legal"]),
				("Media & entertainment", vec!["media-entertainment"]),
				("Nonprofit", vec!["nonprofit"]),
				("Productivity", vec!["productivity", "business-productivity"]),
				("Sales & marketing", vec!["sales-and-marketing"]),
				("Travel", vec!["travel"]),
				("Other", vec!["other", "technology"]),
			]
		);
	}

	#[test]
	fn every_directory_value_the_table_names_folds_into_its_bucket() {
		for (name, values) in BUCKETS {
			for value in values {
				assert_eq!(bucketed(vec![(*value).to_owned()]), [name], "{value} folds elsewhere");
			}
		}
	}

	#[test]
	fn a_value_the_table_does_not_name_and_no_value_at_all_fold_into_other() {
		assert_eq!(bucketed(vec!["astrology".to_owned()]), ["Other"]);
		assert_eq!(bucketed(Vec::new()), ["Other"]);
	}

	#[test]
	fn values_of_distinct_buckets_are_all_carried_and_values_of_one_bucket_are_carried_once() {
		assert_eq!(
			bucketed(vec!["design".to_owned(), "code".to_owned()]),
			["Creative", "Developer tools"]
		);
		assert_eq!(bucketed(vec!["creative".to_owned(), "design".to_owned()]), ["Creative"]);
	}

	#[tokio::test]
	async fn an_entry_carrying_a_value_the_table_does_not_name_is_kept_under_other() {
		let read = read_from(vec![json!([{
			"type": "remote", "name": "odd", "categories": ["astrology", "developer-tools"],
			"remote": { "url": "https://odd.test/mcp", "transport": "sse" },
		}])])
		.await;

		assert_eq!(names(&read), ["odd"]);
		assert_eq!(read[0].categories, ["Other", "Developer tools"]);
	}

	#[tokio::test]
	async fn the_read_asks_for_no_verified_tier() {
		let (base, held) = serving(vec![a_page(&["one"])]).await;

		listed(&base).await.expect("the directory reads");

		assert!(
			!held.queried.lock().expect("the stub records")[0].contains("verified_tier"),
			"got {:?}",
			held.queried.lock().expect("the stub records")
		);
	}

	#[tokio::test]
	async fn a_tier_of_anthropic_or_partner_is_verified_and_a_null_tier_is_absent() {
		let read = read_from(vec![json!([
			{ "type": "remote", "name": "one", "verified_tier": "anthropic",
				"remote": { "url": "https://one.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "two", "verified_tier": "partner",
				"remote": { "url": "https://two.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "three", "verified_tier": null,
				"remote": { "url": "https://three.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(read[0].verified, Some(true));
		assert_eq!(read[1].verified, Some(true));
		assert_eq!(read[2].verified, None);
	}

	#[tokio::test]
	async fn a_null_icon_a_null_score_and_an_empty_tool_list_are_left_absent() {
		let read = read_from(vec![json!([{
			"type": "remote", "name": "bare", "icon_url": null, "popularity_score": null,
			"tool_names": [], "categories": [],
			"remote": { "url": "https://bare.test/mcp", "transport": "sse" },
		}])])
		.await;

		assert_eq!(read[0].logo_url, None);
		assert_eq!(read[0].use_count, None);
		assert_eq!(read[0].tools, None);
		assert_eq!(read[0].categories, ["Other"]);
		assert_eq!(read[0].hosted_by, None);
	}

	#[tokio::test]
	async fn a_one_liner_that_is_missing_falls_back_to_the_description() {
		let read = read_from(vec![json!([{
			"type": "remote", "name": "quiet", "one_liner": null, "description": "The long story.",
			"remote": { "url": "https://quiet.test/mcp", "transport": "sse" },
		}])])
		.await;

		assert_eq!(read[0].description, "The long story.");
	}

	#[tokio::test]
	async fn a_display_name_that_is_missing_falls_back_to_the_name() {
		let read = read_from(vec![json!([{
			"type": "remote", "name": "unnamed", "display_name": null,
			"remote": { "url": "https://unnamed.test/mcp", "transport": "sse" },
		}])])
		.await;

		assert_eq!(read[0].title, "unnamed");
	}

	#[tokio::test]
	async fn a_streamable_http_entry_writes_http_and_an_sse_entry_writes_sse() {
		let read = read_from(vec![json!([
			{ "type": "remote", "name": "one",
				"remote": { "url": "https://one.test/mcp", "transport": "streamable-http" } },
			{ "type": "remote", "name": "two",
				"remote": { "url": "https://two.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(read[0].config, json!({ "type": "http", "url": "https://one.test/mcp" }));
		assert_eq!(read[1].config, json!({ "type": "sse", "url": "https://two.test/mcp" }));
	}

	#[tokio::test]
	async fn a_no_auth_entry_asks_for_nothing_and_an_auth_required_entry_signs_in() {
		let read = read_from(vec![json!([
			{ "type": "remote", "name": "open",
				"remote": { "url": "https://open.test/mcp", "transport": "sse",
					"auth_posture": "no_auth" } },
			{ "type": "remote", "name": "closed",
				"remote": { "url": "https://closed.test/mcp", "transport": "sse",
					"auth_posture": "auth_required" } },
		])])
		.await;

		assert_eq!(read[0].install, Install::Nothing);
		assert_eq!(read[0].auth_posture, Some(AuthPosture::NoAuth));
		assert_eq!(read[1].install, Install::Oauth);
		assert_eq!(read[1].auth_posture, Some(AuthPosture::AuthRequired));
	}

	#[tokio::test]
	async fn a_local_entry_a_null_url_an_http_url_and_an_unread_transport_are_left_out() {
		let read = read_from(vec![json!([
			{ "type": "local", "name": "bundle", "rank": 1 },
			{ "type": "remote", "name": "urlless", "rank": 2,
				"remote": { "url": null, "transport": "sse" } },
			{ "type": "remote", "name": "insecure", "rank": 3,
				"remote": { "url": "http://insecure.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "websocket", "rank": 4,
				"remote": { "url": "https://ws.test/mcp", "transport": "websocket" } },
			{ "type": "remote", "name": "kept", "rank": 5,
				"remote": { "url": "https://kept.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(names(&read), ["kept"]);
	}

	#[tokio::test]
	async fn two_entries_sharing_a_name_keep_the_one_that_comes_first_in_the_payload() {
		let read = read_from(vec![json!([
			{ "type": "remote", "name": "Consensus", "rank": 2,
				"remote": { "url": "https://first.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "Consensus", "rank": 1,
				"remote": { "url": "https://second.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(read.len(), 1);
		assert_eq!(read[0].config, json!({ "type": "sse", "url": "https://first.test/mcp" }));
	}

	#[tokio::test]
	async fn the_read_follows_the_cursor_and_orders_every_page_by_rank_ascending() {
		let (base, held) = serving(vec![
			json!([an_entry("third", 3), an_entry("first", 1)]),
			json!([an_entry("second", 2)]),
		])
		.await;

		let read = listed(&base).await.expect("the directory reads");

		assert_eq!(names(&read), ["first", "second", "third"]);
		assert_eq!(*held.asked.lock().expect("the stub records"), ["", "1"]);
	}

	#[tokio::test]
	async fn the_read_stops_after_four_pages_even_when_a_cursor_is_still_answered() {
		let (base, held) = serving((1..=6).map(|_| a_page(&["one"])).collect()).await;

		listed(&base).await.expect("the directory reads");

		assert_eq!(held.asked.lock().expect("the stub records").len(), PAGES);
	}

	#[tokio::test]
	async fn an_empty_query_answers_every_application_by_rank_ascending() {
		let page = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
		let directory = a_directory_over(vec![a_page(&page)]).await;

		assert_eq!(
			names(&directory.searched("").await.expect("the search answers").applications),
			page
		);
		assert_eq!(
			names(&directory.searched("   ").await.expect("the search answers").applications),
			page
		);
	}

	#[tokio::test]
	async fn a_query_answers_every_application_carrying_every_term_capped_by_no_count() {
		let page: Vec<String> = (0..30).map(|held| format!("linear-{held}")).collect();
		let names_held: Vec<&str> = page.iter().map(String::as_str).collect();
		let directory = a_directory_over(vec![a_page(&names_held)]).await;

		let answered = directory.searched("linear").await.expect("the search answers");

		assert_eq!(names(&answered.applications), names_held);
	}

	#[tokio::test]
	async fn a_query_matches_on_the_folded_name_description_and_categories_together() {
		let directory = a_directory_over(vec![json!([
			{ "type": "remote", "name": "Café", "rank": 1, "categories": ["productivity"],
				"one_liner": "Brews things.",
				"remote": { "url": "https://cafe.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "other", "rank": 2, "categories": ["design"],
				"one_liner": "Draws things.",
				"remote": { "url": "https://other.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(
			names(&directory.searched("cafe").await.expect("the search answers").applications),
			["Café"]
		);
		assert_eq!(
			names(
				&directory
					.searched("productivity brews")
					.await
					.expect("the search answers")
					.applications
			),
			["Café"]
		);
		assert!(directory
			.searched("cafe design")
			.await
			.expect("the search answers")
			.applications
			.is_empty());
	}

	#[tokio::test]
	async fn a_search_answered_from_the_cache_sends_no_request() {
		let (base, held) = serving(vec![a_page(&["one"])]).await;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));
		directory.refreshed().await;
		held.asked.lock().expect("the stub records").clear();

		directory.searched("one").await.expect("the search answers");
		directory.searched("").await.expect("the search answers");

		assert!(held.asked.lock().expect("the stub records").is_empty(), "the directory was read");
	}

	#[tokio::test]
	async fn an_answer_carries_the_moment_the_cache_was_read_and_calls_it_fresh_within_a_day() {
		let directory = a_directory_over(vec![a_page(&["one"])]).await;

		let answered = directory.searched("").await.expect("the search answers");

		assert_eq!(answered.read_at, Some(NOON));
		assert_eq!(answered.is_stale, Some(false));
		assert_eq!(answered.registry_failure, None);
	}

	#[tokio::test]
	async fn a_cache_read_more_than_a_day_ago_is_answered_as_stale() {
		let (base, _) = serving(vec![a_page(&["one"])]).await;
		let directory = Directory::timed(base.clone(), None, Box::new(Stopped(NOON)));
		directory.refreshed().await;
		let held = a_cache_of(&directory);
		let later = Directory::timed(base, None, Box::new(Stopped(NOON + DAY_MS + 1)));
		*later.keeping() = Held { cached: Some(held), failure: None, is_disk_read: true };

		let answered = later.searched("").await.expect("the search answers");

		assert_eq!(answered.is_stale, Some(true));
	}

	fn a_cache_of(directory: &Directory) -> Cached {
		directory.kept().cached.clone().expect("a cache is held")
	}

	#[tokio::test]
	async fn a_failed_read_while_a_cache_is_held_serves_that_cache_and_reports_the_failure() {
		let (base, _) = serving(vec![a_page(&["one"])]).await;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));
		directory.refreshed().await;
		let held = a_cache_of(&directory);
		let broken = Directory::timed(unreached().await, None, Box::new(Stopped(NOON)));
		*broken.keeping() = Held { cached: Some(held), failure: None, is_disk_read: true };
		broken.fetched().await;

		let answered = broken.searched("").await.expect("the search answers");

		assert_eq!(names(&answered.applications), ["one"]);
		assert!(
			matches!(answered.registry_failure, Some(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.registry_failure
		);
	}

	#[tokio::test]
	async fn a_read_answering_no_application_is_held_as_a_failure_and_writes_nothing() {
		let file = temp_dir().join(CACHE_DIR).join(CACHE_FILE);
		let (base, _) = serving(vec![a_page(&["one"])]).await;
		let directory = Directory::timed(base, Some(file.clone()), Box::new(Stopped(NOON)));
		directory.refreshed().await;
		let written = fs::read(&file).expect("the cache is written");

		let (empty, _) = serving(vec![json!([])]).await;
		let drifted = Directory::timed(empty, Some(file.clone()), Box::new(Stopped(NOON)));
		*drifted.keeping() =
			Held { cached: Some(a_cache_of(&directory)), failure: None, is_disk_read: true };
		drifted.fetched().await;

		let answered = drifted.searched("").await.expect("the search answers");
		assert_eq!(names(&answered.applications), ["one"]);
		assert!(
			matches!(answered.registry_failure, Some(ApplicationsError::RegistryUnreadable { .. })),
			"got {:?}",
			answered.registry_failure
		);
		assert_eq!(fs::read(&file).expect("the cache is still there"), written);
	}

	#[test]
	fn a_cursor_left_after_the_last_page_names_the_count_held_and_that_cursor() {
		let line = left_unread(607, Some("a-cursor")).expect("the drift is named");

		assert!(line.contains("607"), "got {line}");
		assert!(line.contains("a-cursor"), "got {line}");
		assert_eq!(left_unread(607, None), None);
	}

	#[tokio::test]
	async fn an_entry_carrying_a_tier_this_reader_does_not_trust_is_left_out() {
		let read = read_from(vec![json!([
			{ "type": "remote", "name": "community", "rank": 1, "verified_tier": "community",
				"remote": { "url": "https://community.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "unranked", "rank": 2, "verified_tier": "unknown",
				"remote": { "url": "https://unranked.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "kept", "rank": 3, "verified_tier": "anthropic",
				"remote": { "url": "https://kept.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(names(&read), ["kept"]);
	}

	#[tokio::test]
	async fn a_query_of_terms_too_short_to_read_matches_on_the_folded_query_as_one_term() {
		let directory = a_directory_over(vec![json!([
			{ "type": "remote", "name": "ai", "rank": 1, "one_liner": "Thinks.",
				"remote": { "url": "https://ai.test/mcp", "transport": "sse" } },
			{ "type": "remote", "name": "other", "rank": 2, "one_liner": "Draws.",
				"remote": { "url": "https://other.test/mcp", "transport": "sse" } },
		])])
		.await;

		assert_eq!(
			names(&directory.searched("ai").await.expect("the search answers").applications),
			["ai"]
		);
		assert_eq!(
			names(&directory.searched(" AI ").await.expect("the search answers").applications),
			["ai"]
		);
		assert!(directory
			.searched("zz")
			.await
			.expect("the search answers")
			.applications
			.is_empty());
	}

	#[test]
	fn an_empty_query_wants_no_term_and_a_short_query_wants_the_whole_of_it() {
		assert_eq!(wanted(""), Vec::<String>::new());
		assert_eq!(wanted("   "), Vec::<String>::new());
		assert_eq!(wanted(" an my "), ["an my"]);
		assert_eq!(wanted("My Issues an"), ["issues"]);
	}

	#[tokio::test]
	async fn a_failure_held_with_no_cache_is_answered_again_without_reaching_the_network() {
		let (base, held) = serving(vec![a_page(&["one"])]).await;
		*held.refusals.lock().expect("the stub records") = 1;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));

		let first = directory.searched("").await;
		let second = directory.searched("").await;

		assert!(matches!(first, Err(ApplicationsError::RegistryRefused { .. })), "got {first:?}");
		assert!(matches!(second, Err(ApplicationsError::RegistryRefused { .. })), "got {second:?}");
		assert_eq!(held.asked.lock().expect("the stub records").len(), 1);
	}

	#[tokio::test]
	async fn the_refresh_reaches_the_network_whatever_the_last_read_answered() {
		let (base, held) = serving(vec![a_page(&["one"])]).await;
		*held.refusals.lock().expect("the stub records") = 1;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));
		directory.searched("").await.expect_err("the first read is refused");

		directory.refreshed().await;

		assert_eq!(held.asked.lock().expect("the stub records").len(), 2);
		let answered = directory.searched("").await.expect("the search answers");
		assert_eq!(names(&answered.applications), ["one"]);
		assert_eq!(answered.registry_failure, None);
	}

	#[tokio::test]
	async fn a_failed_read_while_no_cache_is_held_answers_that_failure() {
		let directory = Directory::timed(unreached().await, None, Box::new(Stopped(NOON)));

		let answered = directory.searched("").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.map(|held| names(&held.applications).join(","))
		);
	}

	#[tokio::test]
	async fn a_read_writes_the_list_the_moment_and_the_schema_and_reads_them_back() {
		let file = temp_dir().join(CACHE_DIR).join(CACHE_FILE);
		let (base, held) = serving(vec![a_page(&["one", "two"])]).await;
		let directory = Directory::timed(base.clone(), Some(file.clone()), Box::new(Stopped(NOON)));
		directory.refreshed().await;

		let written: Value =
			serde_json::from_slice(&fs::read(&file).expect("the cache reads")).expect("it is json");
		assert_eq!(written["schema"], json!(SCHEMA));
		assert_eq!(written["readAt"], json!(NOON));
		assert_eq!(written["applications"][0]["name"], json!("one"));

		held.asked.lock().expect("the stub records").clear();
		let reopened =
			Directory::timed(base, Some(file), Box::new(Stopped(NOON + 1))).searched("").await;

		assert_eq!(names(&reopened.expect("the search answers").applications), ["one", "two"]);
		assert!(held.asked.lock().expect("the stub records").is_empty(), "the directory was read");
	}

	#[tokio::test]
	async fn a_file_carrying_another_schema_version_reads_as_no_cache() {
		let file = temp_dir().join(CACHE_DIR).join(CACHE_FILE);
		fs::create_dir_all(file.parent().expect("the cache has a home")).expect("the home is made");
		fs::write(
			&file,
			json!({ "schema": SCHEMA + 1, "readAt": NOON, "applications": [] }).to_string(),
		)
		.expect("the cache is written");
		let (base, _) = serving(vec![a_page(&["one"])]).await;

		let directory = Directory::timed(base, Some(file), Box::new(Stopped(NOON)));
		let answered = directory.searched("").await.expect("the search answers");

		assert_eq!(names(&answered.applications), ["one"]);
		assert_eq!(answered.read_at, Some(NOON));
	}

	#[tokio::test]
	async fn a_cache_that_cannot_be_written_leaves_the_list_held_in_memory() {
		let occupied = temp_dir().join(CACHE_DIR);
		fs::write(&occupied, "not a directory").expect("the path is taken");
		let (base, _) = serving(vec![a_page(&["one"])]).await;

		let directory =
			Directory::timed(base, Some(occupied.join(CACHE_FILE)), Box::new(Stopped(NOON)));
		let answered = directory.searched("").await.expect("the search answers");

		assert_eq!(names(&answered.applications), ["one"]);
	}

	#[tokio::test]
	async fn a_cache_read_more_than_a_day_ago_is_read_again_and_a_fresh_one_is_left_alone() {
		let (base, held) = serving(vec![a_page(&["one"])]).await;
		let directory = Directory::timed(base, None, Box::new(Stopped(NOON)));
		directory.refreshed().await;
		directory.refreshed().await;

		assert_eq!(held.asked.lock().expect("the stub records").len(), 1);

		*directory.keeping() = Held {
			cached: Some(Cached { read_at: NOON - DAY_MS - 1, ..a_cache_of(&directory) }),
			failure: None,
			is_disk_read: true,
		};
		directory.refreshed().await;

		assert_eq!(held.asked.lock().expect("the stub records").len(), 2);
	}

	#[tokio::test]
	async fn a_name_the_cache_carries_is_answered_from_it() {
		let directory = a_directory_over(vec![a_page(&["one"])]).await;

		assert_eq!(directory.named("one").map(|held| held.title), Some("one".to_owned()));
		assert_eq!(directory.named("absent").map(|held| held.title), None);
	}

	#[tokio::test]
	#[ignore = "it reads the live directory"]
	async fn the_live_directory_carries_no_category_value_the_buckets_leave_unnamed() {
		let client = client().expect("the http client builds");
		let base = parsed(DIRECTORY).expect("the directory is a url");
		let page: Page = read(&client, listing(&base, None).expect("the listing is a url"))
			.await
			.expect("the live directory answers");
		let unnamed: BTreeSet<String> = page
			.servers
			.iter()
			.filter_map(|entry| entry.categories.as_deref())
			.flatten()
			.filter(|value| !BUCKETS.iter().any(|(_, values)| values.contains(&value.as_str())))
			.cloned()
			.collect();

		let read = mapped(page.servers);
		println!("the live directory mapped {} applications", read.len());
		assert!(unnamed.is_empty(), "no bucket names {unnamed:?}");
		assert!(read.len() > 100, "got {}", read.len());
	}
}
