use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::{Client, StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use tokio::task::JoinHandle;

use super::contract::{Application, ApplicationsError, Install, InstallField, InstallRefusal};
use crate::missions::github::installed_tls_provider;

pub const REGISTRY: &str = "https://registry.smithery.ai";

const BOUND: &str = "10";

const OFFERED_PAGE: &str = "12";

const OFFERS: usize = 9;

const FIRST_PAGE: &str = "1";

const SHORTEST_TERM: usize = 3;

const TIMEOUT: Duration = Duration::from_secs(30);

const AGENT: &str = "Kiroshi";

const HTTP: &str = "http";

const SMITHERY: &str = "Smithery";

const SMITHERY_HOSTS: [&str; 2] = ["run.tools", "smithery.ai"];

const LABELS: usize = 2;

#[derive(Deserialize)]
struct Listed {
	servers: Vec<Row>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Row {
	qualified_name: String,
	#[serde(default)]
	display_name: Option<String>,
	#[serde(default)]
	description: String,
	#[serde(default)]
	icon_url: Option<String>,
	#[serde(default)]
	verified: Option<bool>,
	#[serde(default)]
	use_count: Option<u64>,
	#[serde(default)]
	homepage: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Detail {
	qualified_name: String,
	#[serde(default)]
	display_name: Option<String>,
	#[serde(default)]
	description: String,
	#[serde(default)]
	icon_url: Option<String>,
	#[serde(default)]
	connections: Vec<Connection>,
	#[serde(default)]
	tools: Vec<Tool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Connection {
	#[serde(rename = "type")]
	kind: String,
	#[serde(default)]
	deployment_url: Option<String>,
	#[serde(default)]
	config_schema: Option<Schema>,
}

#[derive(Deserialize)]
struct Schema {
	#[serde(default)]
	required: Vec<String>,
	#[serde(default)]
	properties: BTreeMap<String, Property>,
}

#[derive(Deserialize)]
struct Property {
	#[serde(default)]
	description: Option<String>,
	#[serde(default, rename = "x-from")]
	from: Option<Carried>,
}

#[derive(Deserialize)]
struct Carried {
	#[serde(default)]
	header: Option<String>,
}

#[derive(Deserialize)]
struct Tool {
	name: String,
}

struct Served {
	endpoint: Url,
	headers: Map<String, Value>,
	install: Install,
}

pub async fn search(base: &str, query: &str) -> Result<Vec<Application>, ApplicationsError> {
	if query.trim().is_empty() {
		return offered(base).await;
	}
	let terms = terms(query);
	if terms.is_empty() {
		return Ok(Vec::new());
	}
	ranked(base, query, &terms).await
}

async fn offered(base: &str) -> Result<Vec<Application>, ApplicationsError> {
	let base = parsed(base)?;
	let client = client()?;
	let rows = page(&client, &base, &[("page", FIRST_PAGE), ("pageSize", OFFERED_PAGE)]).await?;
	let mut offers: Vec<Application> =
		listings(&client, &base, rows).await.into_iter().filter(installs).collect();
	offers.truncate(OFFERS);
	Ok(offers)
}

fn installs(application: &Application) -> bool {
	!matches!(application.install, Install::Refused(_))
}

async fn ranked(
	base: &str,
	query: &str,
	terms: &[String],
) -> Result<Vec<Application>, ApplicationsError> {
	let base = parsed(base)?;
	let client = client()?;
	let asked = [("q", query), ("page", FIRST_PAGE), ("pageSize", BOUND)];
	let mut kept: Vec<Row> =
		page(&client, &base, &asked).await?.into_iter().filter(|row| carries(row, terms)).collect();
	kept.sort_by_key(|row| Reverse(row.use_count.unwrap_or_default()));
	Ok(listings(&client, &base, kept).await)
}

async fn page(
	client: &Client,
	base: &Url,
	asked: &[(&str, &str)],
) -> Result<Vec<Row>, ApplicationsError> {
	let mut url = endpoint(base, &["servers"])?;
	for (name, value) in asked {
		url.query_pairs_mut().append_pair(name, value);
	}
	let listed: Listed = read(client, url).await?;
	Ok(listed.servers)
}

pub(super) fn terms(query: &str) -> Vec<String> {
	query
		.split_whitespace()
		.filter(|term| term.chars().count() >= SHORTEST_TERM)
		.map(str::to_lowercase)
		.collect()
}

pub async fn detail(base: &str, name: &str) -> Result<Option<Application>, ApplicationsError> {
	let base = parsed(base)?;
	let Some(detail) = detailed(&client()?, &base, name).await? else {
		return Ok(None);
	};
	Ok(read_by_name(&detail))
}

fn carries(row: &Row, terms: &[String]) -> bool {
	let named = format!(
		"{} {}",
		row.qualified_name.to_lowercase(),
		row.display_name.as_deref().unwrap_or_default().to_lowercase()
	);
	terms.iter().all(|term| named.contains(term.as_str()))
}

async fn listings(client: &Client, base: &Url, kept: Vec<Row>) -> Vec<Application> {
	let running: Vec<JoinHandle<Option<Application>>> = kept
		.into_iter()
		.map(|row| {
			let client = client.clone();
			let base = base.clone();
			tokio::spawn(async move { listed(&client, &base, row).await })
		})
		.collect();
	let mut described = Vec::new();
	for handle in running {
		match handle.await {
			Ok(Some(application)) => described.push(application),
			Ok(None) => {}
			Err(failure) => eprintln!("a Smithery detail was not awaited: {failure}"),
		}
	}
	described
}

async fn listed(client: &Client, base: &Url, row: Row) -> Option<Application> {
	let detail = match detailed(client, base, &row.qualified_name).await {
		Ok(detail) => detail?,
		Err(failure) => {
			eprintln!("the Smithery detail of {} was not read: {failure:?}", row.qualified_name);
			return None;
		}
	};
	let served = served(&detail)?;
	let hosted_by = hosted_by(&row, &served.endpoint);
	let (config, install) = declared(served);
	Some(Application {
		title: row.display_name.unwrap_or_else(|| row.qualified_name.clone()),
		name: row.qualified_name,
		description: row.description,
		config,
		tools: tool_names(&detail),
		logo: None,
		logo_url: row.icon_url,
		use_count: row.use_count,
		verified: row.verified,
		hosted_by,
		install,
	})
}

fn tool_names(detail: &Detail) -> Vec<String> {
	detail.tools.iter().map(|tool| tool.name.clone()).collect()
}

fn read_by_name(detail: &Detail) -> Option<Application> {
	let served = served(detail)?;
	let (config, install) = declared(served);
	Some(Application {
		name: detail.qualified_name.clone(),
		title: detail.display_name.clone().unwrap_or_else(|| detail.qualified_name.clone()),
		description: detail.description.clone(),
		config,
		tools: tool_names(detail),
		logo: None,
		logo_url: detail.icon_url.clone(),
		use_count: None,
		verified: None,
		hosted_by: None,
		install,
	})
}

async fn detailed(
	client: &Client,
	base: &Url,
	name: &str,
) -> Result<Option<Detail>, ApplicationsError> {
	let url = base
		.join(&format!("servers/{name}"))
		.map_err(|error| ApplicationsError::RegistryUnreached { detail: error.to_string() })?;
	match read::<Detail>(client, url).await {
		Ok(detail) => Ok(Some(detail)),
		Err(ApplicationsError::RegistryRefused { status }) if status == StatusCode::NOT_FOUND => {
			Ok(None)
		}
		Err(failure) => Err(failure),
	}
}

fn parsed(base: &str) -> Result<Url, ApplicationsError> {
	Url::parse(base)
		.map_err(|error| ApplicationsError::RegistryUnreached { detail: error.to_string() })
}

fn client() -> Result<Client, ApplicationsError> {
	installed_tls_provider();
	let mut headers = HeaderMap::new();
	headers.insert(USER_AGENT, HeaderValue::from_static(AGENT));
	Client::builder().timeout(TIMEOUT).default_headers(headers).build().map_err(|error| {
		ApplicationsError::RegistryUnreached {
			detail: format!("the http client was not built: {error}"),
		}
	})
}

fn endpoint(base: &Url, segments: &[&str]) -> Result<Url, ApplicationsError> {
	let mut url = base.clone();
	url.path_segments_mut()
		.map_err(|()| ApplicationsError::RegistryUnreached {
			detail: format!("{base} cannot hold a path"),
		})?
		.pop_if_empty()
		.extend(segments);
	Ok(url)
}

async fn read<T: DeserializeOwned>(client: &Client, url: Url) -> Result<T, ApplicationsError> {
	let answer = client.get(url).send().await.map_err(unreached)?;
	if answer.status() != StatusCode::OK {
		return Err(ApplicationsError::RegistryRefused { status: answer.status().as_u16() });
	}
	answer
		.json::<T>()
		.await
		.map_err(|error| ApplicationsError::RegistryUnreadable { detail: error.to_string() })
}

fn unreached(error: reqwest::Error) -> ApplicationsError {
	if error.is_timeout() {
		return ApplicationsError::RegistryTimedOut;
	}
	ApplicationsError::RegistryUnreached { detail: error.to_string() }
}

fn served(detail: &Detail) -> Option<Served> {
	let connection = detail.connections.iter().find(|held| held.kind == HTTP)?;
	let endpoint = Url::parse(connection.deployment_url.as_deref()?).ok()?;
	let schema = connection.config_schema.as_ref();
	Some(Served { endpoint, headers: headers(schema), install: install(schema) })
}

fn headers(schema: Option<&Schema>) -> Map<String, Value> {
	let Some(schema) = schema else {
		return Map::new();
	};
	schema
		.required
		.iter()
		.filter_map(|field| Some((header_of(schema, field)?, Value::String(reference(field)))))
		.collect()
}

fn reference(declared: &str) -> String {
	format!("${{{}}}", variable(declared))
}

fn variable(declared: &str) -> String {
	let named: String = declared
		.chars()
		.map(|held| if held.is_ascii_alphanumeric() { held.to_ascii_uppercase() } else { '_' })
		.collect();
	if named.starts_with(|held: char| held.is_ascii_digit()) {
		return format!("_{named}");
	}
	named
}

fn header_of(schema: &Schema, field: &str) -> Option<String> {
	schema.properties.get(field)?.from.as_ref()?.header.clone()
}

fn install(schema: Option<&Schema>) -> Install {
	let Some(schema) = schema else {
		return Install::Oauth;
	};
	if let Some(field) = schema.required.iter().find(|held| header_of(schema, held).is_none()) {
		return Install::Refused(InstallRefusal { field: field.clone(), reason: uncarried(field) });
	}
	if schema.required.is_empty() {
		return Install::Oauth;
	}
	Install::asking(schema.required.iter().map(|field| asked_field(schema, field)).collect())
}

fn asked_field(schema: &Schema, field: &str) -> InstallField {
	InstallField {
		name: field.to_owned(),
		secret: variable(field),
		description: schema.properties.get(field).and_then(|held| held.description.clone()),
	}
}

fn uncarried(field: &str) -> String {
	format!(
		"the required field \"{field}\" names no header to carry it, and a key must never travel in a url"
	)
}

fn declared(served: Served) -> (Value, Install) {
	let config = config(&served);
	let install = served.install.covering(&config);
	(config, install)
}

fn config(served: &Served) -> Value {
	let mut config = json!({ "type": "http", "url": served.endpoint.as_str() });
	if !served.headers.is_empty() {
		config["headers"] = Value::Object(served.headers.clone());
	}
	config
}

fn hosted_by(row: &Row, endpoint: &Url) -> Option<String> {
	let deployment = endpoint.host_str()?.to_lowercase();
	if SMITHERY_HOSTS.iter().any(|held| under(&deployment, held)) {
		return Some(SMITHERY.to_owned());
	}
	let hosting = last_labels(&deployment)?;
	let home = row
		.homepage
		.as_deref()
		.and_then(|held| Url::parse(held).ok())
		.and_then(|held| held.host_str().and_then(last_labels));
	(home.as_ref() != Some(&hosting)).then_some(hosting)
}

fn under(host: &str, root: &str) -> bool {
	host == root || host.ends_with(&format!(".{root}"))
}

fn last_labels(host: &str) -> Option<String> {
	let labels: Vec<&str> = host.split('.').collect();
	let held = labels[labels.len().saturating_sub(LABELS)..].join(".").to_lowercase();
	(!held.is_empty()).then_some(held)
}

#[cfg(test)]
pub(crate) mod tests {
	use std::collections::HashMap;
	use std::net::{Ipv4Addr, SocketAddr};
	use std::sync::{Arc, Mutex};

	use axum::extract::{Path as AxumPath, State as Extracted};
	use axum::http::Uri;
	use axum::response::{IntoResponse, Response as Answered};
	use axum::routing::get;
	use axum::Router;

	use super::*;

	pub(crate) struct Held {
		list_status: StatusCode,
		rows: Vec<Value>,
		details: HashMap<String, Value>,
		pub(crate) asked: Mutex<Vec<String>>,
		pub(crate) detailed: Mutex<Vec<String>>,
	}

	pub(crate) fn nothing() -> Held {
		holding(Vec::new(), Vec::new())
	}

	pub(crate) fn holding(rows: Vec<Value>, details: Vec<Value>) -> Held {
		Held {
			list_status: StatusCode::OK,
			rows,
			details: details
				.into_iter()
				.map(|detail| (detail["qualifiedName"].as_str().expect("named").to_owned(), detail))
				.collect(),
			asked: Mutex::new(Vec::new()),
			detailed: Mutex::new(Vec::new()),
		}
	}

	pub(crate) async fn unreached() -> String {
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
		let address = listener.local_addr().expect("the port is named");
		drop(listener);
		format!("http://{address}")
	}

	pub(crate) async fn serving(held: Held) -> (String, Arc<Held>) {
		let held = Arc::new(held);
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("the stub binds");
		let address: SocketAddr = listener.local_addr().expect("the stub is named");
		let router = Router::new()
			.route("/servers", get(list_of))
			.route("/servers/{*name}", get(detail_of))
			.with_state(held.clone());
		tokio::spawn(async move { axum::serve(listener, router).await.expect("the stub serves") });
		(format!("http://{address}"), held)
	}

	async fn list_of(Extracted(held): Extracted<Arc<Held>>, uri: Uri) -> Answered {
		held.asked.lock().expect("the stub records").push(uri.to_string());
		if held.list_status != StatusCode::OK {
			return held.list_status.into_response();
		}
		as_json(&json!({ "servers": held.rows }))
	}

	async fn detail_of(
		Extracted(held): Extracted<Arc<Held>>,
		AxumPath(name): AxumPath<String>,
	) -> Answered {
		held.detailed.lock().expect("the stub records").push(name.clone());
		match held.details.get(&name) {
			Some(detail) => as_json(detail),
			None => StatusCode::NOT_FOUND.into_response(),
		}
	}

	fn as_json(held: &Value) -> Answered {
		Answered::builder()
			.status(StatusCode::OK)
			.header(reqwest::header::CONTENT_TYPE, "application/json")
			.body(axum::body::Body::from(held.to_string()))
			.expect("the stub answers with a body")
	}

	pub(crate) fn a_row(name: &str, display: &str, use_count: u64) -> Value {
		json!({
			"qualifiedName": name,
			"displayName": display,
			"description": format!("{display} through Smithery."),
			"iconUrl": format!("https://icons.test/{display}.png"),
			"verified": true,
			"useCount": use_count,
			"homepage": format!("https://github.com/owner/{display}"),
		})
	}

	pub(crate) fn a_detail(name: &str, url: &str) -> Value {
		json!({
			"qualifiedName": name,
			"connections": [{ "type": "http", "deploymentUrl": url, "configSchema": {} }],
			"tools": [{ "name": "search" }, { "name": "create" }],
		})
	}

	pub(crate) fn an_uncarried_detail(name: &str, url: &str) -> Value {
		json!({
			"qualifiedName": name,
			"connections": [{
				"type": "http",
				"deploymentUrl": url,
				"configSchema": { "required": ["apiKey"], "properties": { "apiKey": {} } },
			}],
			"tools": [{ "name": "search" }],
		})
	}

	fn described(detail: Value) -> Application {
		let detail: Detail = serde_json::from_value(detail).expect("the fixture is a detail");
		read_by_name(&detail).expect("the fixture offers an http connection")
	}

	#[test]
	fn a_connection_asking_for_nothing_answers_oauth_on_its_deployment_url() {
		let application = described(a_detail("@owner/slack", "https://slack.run.tools"));

		assert_eq!(application.install, Install::Oauth);
		assert_eq!(
			application.config,
			json!({ "type": "http", "url": "https://slack.run.tools/" })
		);
		assert_eq!(application.tools, ["search", "create"]);
	}

	#[test]
	fn a_required_field_named_by_a_header_is_written_as_a_placeholder_into_that_header() {
		let application = described(json!({
			"qualifiedName": "@owner/keyed",
			"connections": [{
				"type": "http",
				"deploymentUrl": "https://keyed.test/mcp",
				"configSchema": {
					"required": ["apiKey"],
					"properties": {
						"apiKey": { "description": "The key.", "x-from": { "header": "X-Api-Key" } },
					},
				},
			}],
		}));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "apiKey".to_owned(),
					secret: "APIKEY".to_owned(),
					description: Some("The key.".to_owned()),
				}],
			}
		);
		assert_eq!(
			application.config,
			json!({
				"type": "http",
				"url": "https://keyed.test/mcp",
				"headers": { "X-Api-Key": "${APIKEY}" },
			})
		);
	}

	#[test]
	fn a_required_field_naming_no_header_refuses_the_install_and_leaves_the_url_alone() {
		let application = described(json!({
			"qualifiedName": "@owner/queried",
			"connections": [{
				"type": "http",
				"deploymentUrl": "https://queried.test/mcp?tenant=one",
				"configSchema": {
					"required": ["apiKey", "profile"],
					"properties": { "apiKey": { "x-from": { "query": "api_key" } } },
				},
			}],
		}));

		let Install::Refused(refusal) = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(refusal.field, "apiKey");
		assert!(refusal.reason.contains("apiKey"), "got {}", refusal.reason);
		assert!(refusal.reason.contains("url"), "got {}", refusal.reason);
		assert_eq!(
			application.config,
			json!({ "type": "http", "url": "https://queried.test/mcp?tenant=one" })
		);
	}

	#[test]
	fn a_header_beside_a_field_naming_none_refuses_and_leaves_the_url_without_a_placeholder() {
		let application = described(json!({
			"qualifiedName": "@owner/mixed",
			"connections": [{
				"type": "http",
				"deploymentUrl": "https://mixed.test/mcp",
				"configSchema": {
					"required": ["apiKey", "profile"],
					"properties": { "apiKey": { "x-from": { "header": "X-Api-Key" } } },
				},
			}],
		}));

		let Install::Refused(refusal) = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(refusal.field, "profile");
		assert_eq!(
			application.config,
			json!({
				"type": "http",
				"url": "https://mixed.test/mcp",
				"headers": { "X-Api-Key": "${APIKEY}" },
			})
		);
	}

	#[test]
	fn every_required_field_naming_a_header_is_asked_for_and_carried_in_its_own_header() {
		let application = described(json!({
			"qualifiedName": "@owner/two-headers",
			"connections": [{
				"type": "http",
				"deploymentUrl": "https://two.test/mcp",
				"configSchema": {
					"required": ["apiKey", "tenant"],
					"properties": {
						"apiKey": { "x-from": { "header": "X-Api-Key" } },
						"tenant": { "x-from": { "header": "X-Tenant" } },
					},
				},
			}],
		}));

		assert_eq!(
			application.config,
			json!({
				"type": "http",
				"url": "https://two.test/mcp",
				"headers": { "X-Api-Key": "${APIKEY}", "X-Tenant": "${TENANT}" },
			})
		);
		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![
					InstallField {
						name: "apiKey".to_owned(),
						secret: "APIKEY".to_owned(),
						description: None,
					},
					InstallField {
						name: "tenant".to_owned(),
						secret: "TENANT".to_owned(),
						description: None,
					},
				],
			}
		);
	}

	#[test]
	fn two_required_fields_answering_one_variable_refuse_the_install() {
		let application = described(json!({
			"qualifiedName": "@owner/collapsed",
			"connections": [{
				"type": "http",
				"deploymentUrl": "https://collapsed.test/mcp",
				"configSchema": {
					"required": ["api-key", "api_key"],
					"properties": {
						"api-key": { "x-from": { "header": "X-Api-Key" } },
						"api_key": { "x-from": { "header": "X-Api-Key-Too" } },
					},
				},
			}],
		}));

		let Install::Refused(refusal) = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(refusal.field, "api_key");
		assert!(refusal.reason.contains("API_KEY"), "got {}", refusal.reason);
	}

	#[test]
	fn a_server_offering_no_http_connection_is_left_out() {
		let detail: Detail = serde_json::from_value(json!({
			"qualifiedName": "@owner/local",
			"connections": [{ "type": "stdio", "configSchema": {} }],
		}))
		.expect("the fixture is a detail");

		assert!(read_by_name(&detail).is_none());
	}

	#[tokio::test]
	async fn a_search_keeps_the_rows_every_term_names_ordered_by_use_count_descending() {
		let (base, held) = serving(holding(
			vec![
				a_row("@owner/slack-lite", "Slack Lite", 12),
				a_row("@owner/godot-engine", "Godot", 9000),
				a_row("@owner/slack", "Slack", 900),
			],
			vec![
				a_detail("@owner/slack-lite", "https://lite.run.tools"),
				a_detail("@owner/slack", "https://slack.run.tools"),
				a_detail("@owner/godot-engine", "https://godot.run.tools"),
			],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.name.as_str()).collect();
		assert_eq!(names, ["@owner/slack", "@owner/slack-lite"]);
		assert_eq!(
			*held.asked.lock().expect("the stub records"),
			["/servers?q=slack&page=1&pageSize=10"]
		);
	}

	#[tokio::test]
	async fn a_search_carries_the_icon_the_count_the_flag_and_the_tools_of_its_detail() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://slack.run.tools")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		let held = &found[0];
		assert_eq!(held.logo_url.as_deref(), Some("https://icons.test/Slack.png"));
		assert_eq!(held.use_count, Some(900));
		assert_eq!(held.verified, Some(true));
		assert_eq!(held.tools, ["search", "create"]);
		assert_eq!(held.logo, None);
	}

	#[tokio::test]
	async fn a_deployment_under_smithery_names_smithery_and_one_hosted_at_home_names_nobody() {
		let mut mine = a_row("@owner/mine", "Mine", 1);
		mine["homepage"] = json!("https://mine.test/docs");
		let (base, _) = serving(holding(
			vec![mine, a_row("@owner/theirs", "Mine", 2)],
			vec![
				a_detail("@owner/mine", "https://mcp.mine.test/mcp"),
				a_detail("@owner/theirs", "https://server.smithery.ai/mcp"),
			],
		))
		.await;

		let found = search(&base, "mine").await.expect("the search answers");

		let hosts: Vec<Option<&str>> = found.iter().map(|held| held.hosted_by.as_deref()).collect();
		assert_eq!(hosts, [Some("Smithery"), None]);
	}

	#[tokio::test]
	async fn a_deployment_under_run_tools_names_smithery_though_its_homepage_names_github() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://slack.run.tools")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		assert_eq!(found[0].hosted_by.as_deref(), Some("Smithery"));
	}

	#[tokio::test]
	async fn a_deployment_outside_smithery_names_the_last_two_labels_of_its_host() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://mcp.slack.example/mcp")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		assert_eq!(found[0].hosted_by.as_deref(), Some("slack.example"));
	}

	#[test]
	fn a_query_keeps_only_the_terms_of_three_characters_or_more_in_lowercase() {
		assert_eq!(terms("My Issues an"), ["issues"]);
		assert_eq!(terms("an my"), Vec::<String>::new());
		assert_eq!(terms(""), Vec::<String>::new());
	}

	fn a_page_of(named: &[&str]) -> Held {
		holding(
			named.iter().map(|name| a_row(name, name, 1)).collect(),
			named.iter().map(|name| a_detail(name, &format!("https://{name}.run.tools"))).collect(),
		)
	}

	fn offered_names(found: &[Application]) -> Vec<&str> {
		found.iter().map(|held| held.name.as_str()).collect()
	}

	const A_PAGE: [&str; 12] = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

	#[tokio::test]
	async fn an_empty_query_asks_for_the_first_page_of_twelve_without_any_q() {
		let (base, held) = serving(a_page_of(&A_PAGE)).await;

		search(&base, "").await.expect("the search answers");
		search(&base, "   ").await.expect("the search answers");

		assert_eq!(
			*held.asked.lock().expect("the stub records"),
			["/servers?page=1&pageSize=12", "/servers?page=1&pageSize=12"]
		);
	}

	#[tokio::test]
	async fn a_query_of_whitespace_alone_answers_the_first_nine_rows_smithery_returned() {
		let (base, _) = serving(a_page_of(&A_PAGE)).await;

		let found = search(&base, " \t ").await.expect("the search answers");

		assert_eq!(offered_names(&found), ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
	}

	#[tokio::test]
	async fn a_query_whose_every_term_is_under_three_characters_reads_nothing_and_answers_nothing()
	{
		let (base, held) = serving(a_page_of(&A_PAGE)).await;

		assert!(search(&base, "an").await.expect("the search answers").is_empty());
		assert!(search(&base, "an my").await.expect("the search answers").is_empty());

		assert!(held.asked.lock().expect("the stub records").is_empty(), "a page was read");
	}

	#[tokio::test]
	async fn an_empty_query_leaves_out_a_row_reading_down_to_nothing_and_fills_its_place() {
		let mut page = a_page_of(&A_PAGE);
		page.details.remove("c");
		let (base, _) = serving(page).await;

		let found = search(&base, "").await.expect("the search answers");

		assert_eq!(offered_names(&found), ["a", "b", "d", "e", "f", "g", "h", "i", "j"]);
	}

	#[tokio::test]
	async fn an_empty_query_leaves_out_a_row_whose_install_is_refused_and_fills_its_place() {
		let mut page = a_page_of(&A_PAGE);
		page.details.insert("c".to_owned(), an_uncarried_detail("c", "https://c.run.tools"));
		let (base, _) = serving(page).await;

		let found = search(&base, "").await.expect("the search answers");

		assert_eq!(offered_names(&found), ["a", "b", "d", "e", "f", "g", "h", "i", "j"]);
	}

	#[tokio::test]
	async fn an_empty_query_answers_the_page_order_though_the_use_counts_rise_along_it() {
		let rows = A_PAGE
			.iter()
			.enumerate()
			.map(|(rank, name)| a_row(name, name, rank as u64 + 1))
			.collect();
		let details = A_PAGE
			.iter()
			.map(|name| a_detail(name, &format!("https://{name}.run.tools")))
			.collect();
		let (base, _) = serving(holding(rows, details)).await;

		let found = search(&base, "").await.expect("the search answers");

		assert_eq!(offered_names(&found), ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
	}

	#[tokio::test]
	async fn a_typed_query_answers_a_row_whose_install_is_refused() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/queried", "Slack", 900)],
			vec![an_uncarried_detail("@owner/queried", "https://queried.test/mcp")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		assert_eq!(offered_names(&found), ["@owner/queried"]);
		assert!(matches!(found[0].install, Install::Refused(_)), "got {:?}", found[0].install);
	}

	#[tokio::test]
	async fn a_row_of_an_empty_query_carries_what_a_typed_search_carries() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://slack.run.tools")],
		))
		.await;

		let found = search(&base, "").await.expect("the search answers");

		let held = &found[0];
		assert_eq!(held.config, json!({ "type": "http", "url": "https://slack.run.tools/" }));
		assert_eq!(held.tools, ["search", "create"]);
		assert_eq!(held.logo_url.as_deref(), Some("https://icons.test/Slack.png"));
		assert_eq!(held.use_count, Some(900));
		assert_eq!(held.verified, Some(true));
		assert_eq!(held.hosted_by.as_deref(), Some("Smithery"));
		assert_eq!(held.install, Install::Oauth);
	}

	#[tokio::test]
	async fn an_empty_query_answers_a_refused_list_as_an_error() {
		let mut refusing = a_page_of(&A_PAGE);
		refusing.list_status = StatusCode::SERVICE_UNAVAILABLE;
		let (base, _) = serving(refusing).await;

		assert_eq!(
			search(&base, "").await.err(),
			Some(ApplicationsError::RegistryRefused { status: 503 })
		);
	}

	#[tokio::test]
	async fn a_row_whose_detail_is_absent_or_unreadable_is_left_out_and_the_others_answered() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack-a", "Slack", 3), a_row("@owner/slack-b", "Slack", 2)],
			vec![a_detail("@owner/slack-b", "https://b.run.tools")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.name.as_str()).collect();
		assert_eq!(names, ["@owner/slack-b"]);
	}

	#[tokio::test]
	async fn a_refused_list_answers_an_error_and_not_an_empty_list() {
		let mut refusing = holding(vec![a_row("@owner/slack", "Slack", 1)], Vec::new());
		refusing.list_status = StatusCode::SERVICE_UNAVAILABLE;
		let (base, _) = serving(refusing).await;

		assert_eq!(
			search(&base, "slack").await.err(),
			Some(ApplicationsError::RegistryRefused { status: 503 })
		);
	}

	#[tokio::test]
	async fn an_unreached_registry_answers_an_error_and_not_an_empty_list() {
		let base = unreached().await;

		let answered = search(&base, "slack").await.err();

		assert!(
			matches!(answered, Some(ApplicationsError::RegistryUnreached { .. })),
			"got {answered:?}"
		);
	}

	#[tokio::test]
	async fn a_detail_read_by_name_answers_its_tools_and_an_unknown_one_answers_nothing() {
		let (base, _) =
			serving(holding(Vec::new(), vec![a_detail("@owner/slack", "https://slack.run.tools")]))
				.await;

		let found = detail(&base, "@owner/slack").await.expect("the detail answers");

		assert_eq!(found.expect("the server is known").tools, ["search", "create"]);
		assert_eq!(detail(&base, "@owner/nowhere").await, Ok(None));
	}
}
