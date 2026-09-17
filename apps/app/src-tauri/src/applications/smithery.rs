use std::collections::BTreeMap;

use reqwest::{Client, StatusCode, Url};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use tokio::task::JoinHandle;

use super::contract::{Application, ApplicationsError, Install, InstallField, InstallRefusal};
use super::registry::{client, endpoint, parsed, read, reference, variable};
use super::search::{elsewhere, normalised, repository, terms, Dropped, Listing, SMITHERY_SOURCE};

pub const REGISTRY: &str = "https://registry.smithery.ai";

const BOUND: &str = "10";

const FIRST_PAGE: &str = "1";

const OFFERED_PAGE: &str = "12";

const HTTP: &str = "http";

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

pub async fn search(base: &str, query: &str) -> Result<Vec<Listing>, ApplicationsError> {
	if terms(query).is_empty() {
		return Ok(Vec::new());
	}
	rows(base, &[("q", query), ("page", FIRST_PAGE), ("pageSize", BOUND)]).await
}

pub async fn offered(base: &str) -> Result<Vec<Listing>, ApplicationsError> {
	rows(base, &[("page", FIRST_PAGE), ("pageSize", OFFERED_PAGE)]).await
}

async fn rows(base: &str, asked: &[(&str, &str)]) -> Result<Vec<Listing>, ApplicationsError> {
	let base = parsed(base)?;
	let mut list = endpoint(&base, &["servers"])?;
	for (name, value) in asked {
		list.query_pairs_mut().append_pair(name, value);
	}
	let client = client()?;
	let listed: Listed = read(&client, list).await?;
	let answered = listed.servers.len();
	let found = listings(&client, &base, listed.servers).await;
	Ok(normalised(SMITHERY_SOURCE, answered, found))
}

pub async fn detail(base: &str, name: &str) -> Result<Option<Application>, ApplicationsError> {
	let base = parsed(base)?;
	let Some(detail) = detailed(&client()?, &base, name).await? else {
		return Ok(None);
	};
	Ok(read_by_name(&detail))
}

async fn listings(client: &Client, base: &Url, kept: Vec<Row>) -> Vec<Result<Listing, Dropped>> {
	let running: Vec<JoinHandle<Result<Listing, Dropped>>> = kept
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
			Ok(read) => described.push(read),
			Err(failure) => {
				eprintln!("a Smithery detail was not awaited: {failure}");
				described.push(Err(Dropped::Unread));
			}
		}
	}
	described
}

async fn listed(client: &Client, base: &Url, row: Row) -> Result<Listing, Dropped> {
	let detail = match detailed(client, base, &row.qualified_name).await {
		Ok(detail) => detail.ok_or(Dropped::Unread)?,
		Err(failure) => {
			eprintln!("the Smithery detail of {} was not read: {failure:?}", row.qualified_name);
			return Err(Dropped::Unread);
		}
	};
	let served = served(&detail).ok_or(Dropped::Unread)?;
	let hosted_by = hosted_by(&row, &elsewhere(&served.endpoint)?);
	let (config, install) = declared(served);
	Ok(Listing {
		repository: row.homepage.as_deref().and_then(repository),
		application: Application {
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
		},
	})
}

fn tool_names(detail: &Detail) -> Vec<String> {
	detail.tools.iter().map(|tool| tool.name.clone()).collect()
}

fn read_by_name(detail: &Detail) -> Option<Application> {
	let served = served(detail)?;
	if elsewhere(&served.endpoint).is_err() {
		return None;
	}
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
		concealed: true,
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

fn hosted_by(row: &Row, host: &str) -> Option<String> {
	let home = row
		.homepage
		.as_deref()
		.and_then(|held| Url::parse(held).ok())
		.and_then(|held| elsewhere(&held).ok());
	if home.as_deref() == Some(host) {
		return None;
	}
	Some(host.to_owned())
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
		let application = described(a_detail("@owner/slack", "https://slack.example"));

		assert_eq!(application.install, Install::Oauth);
		assert_eq!(application.config, json!({ "type": "http", "url": "https://slack.example/" }));
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
					concealed: true,
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
						concealed: true,
					},
					InstallField {
						name: "tenant".to_owned(),
						secret: "TENANT".to_owned(),
						description: None,
						concealed: true,
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
	async fn a_search_answers_every_row_in_the_order_the_registry_ranked_them() {
		let (base, held) = serving(holding(
			vec![
				a_row("@owner/slack-lite", "Slack Lite", 12),
				a_row("@owner/godot-engine", "Godot", 9000),
				a_row("@owner/slack", "Slack", 900),
			],
			vec![
				a_detail("@owner/slack-lite", "https://lite.example"),
				a_detail("@owner/slack", "https://slack.example"),
				a_detail("@owner/godot-engine", "https://godot.example"),
			],
		))
		.await;

		let found = search(&base, "chat with my team").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.application.name.as_str()).collect();
		assert_eq!(names, ["@owner/slack-lite", "@owner/godot-engine", "@owner/slack"]);
		assert_eq!(
			*held.asked.lock().expect("the stub records"),
			["/servers?q=chat+with+my+team&page=1&pageSize=10"]
		);
	}

	#[tokio::test]
	async fn a_search_carries_the_icon_the_count_the_flag_and_the_tools_of_its_detail() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://slack.example")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		let held = &found[0].application;
		assert_eq!(held.logo_url.as_deref(), Some("https://icons.test/Slack.png"));
		assert_eq!(held.use_count, Some(900));
		assert_eq!(held.verified, Some(true));
		assert_eq!(held.tools, ["search", "create"]);
		assert_eq!(held.logo, None);
	}

	#[tokio::test]
	async fn a_deployment_hosted_at_home_names_nobody_and_one_under_smithery_is_left_out() {
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

		let names: Vec<&str> = found.iter().map(|held| held.application.name.as_str()).collect();
		assert_eq!(names, ["@owner/mine"]);
		assert_eq!(found[0].application.hosted_by, None);
	}

	#[tokio::test]
	async fn a_deployment_under_run_tools_answers_no_listing_and_no_application_by_name() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://slack.run.tools")],
		))
		.await;

		assert!(search(&base, "slack").await.expect("the search answers").is_empty());
		assert_eq!(detail(&base, "@owner/slack").await, Ok(None));
	}

	#[tokio::test]
	async fn a_deployment_outside_smithery_names_the_last_two_labels_of_its_host() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack", "Slack", 900)],
			vec![a_detail("@owner/slack", "https://mcp.slack.example/mcp")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		assert_eq!(found[0].application.hosted_by.as_deref(), Some("slack.example"));
	}

	#[tokio::test]
	async fn a_query_whose_every_term_is_too_short_reads_nothing_from_smithery() {
		let (base, held) =
			serving(holding(vec![a_row("@owner/slack", "Slack", 1)], Vec::new())).await;

		assert!(search(&base, "an my").await.expect("the search answers").is_empty());
		assert!(search(&base, "").await.expect("the search answers").is_empty());
		assert!(held.asked.lock().expect("the stub records").is_empty(), "a list was read");
	}

	#[tokio::test]
	async fn a_row_whose_detail_is_absent_or_unreadable_is_left_out_and_the_others_answered() {
		let (base, _) = serving(holding(
			vec![a_row("@owner/slack-a", "Slack", 3), a_row("@owner/slack-b", "Slack", 2)],
			vec![a_detail("@owner/slack-b", "https://b.example")],
		))
		.await;

		let found = search(&base, "slack").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.application.name.as_str()).collect();
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
	async fn a_detail_read_by_name_answers_its_tools_and_an_unknown_one_answers_nothing() {
		let (base, _) =
			serving(holding(Vec::new(), vec![a_detail("@owner/slack", "https://slack.example")]))
				.await;

		let found = detail(&base, "@owner/slack").await.expect("the detail answers");

		assert_eq!(found.expect("the server is known").tools, ["search", "create"]);
		assert_eq!(detail(&base, "@owner/nowhere").await, Ok(None));
	}
}
