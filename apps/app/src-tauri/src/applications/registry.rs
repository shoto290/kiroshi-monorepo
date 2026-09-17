use std::collections::HashSet;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use reqwest::{Client, StatusCode, Url};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Map, Value};

use super::contract::{Application, ApplicationsError, Install, InstallField};
use super::runnable::{NPX, UVX};
use crate::missions::github::installed_tls_provider;

pub const REGISTRY: &str = "https://registry.modelcontextprotocol.io";

const API_VERSION: &str = "v0.1";

const BOUND: &str = "10";

const LATEST: &str = "latest";

const TIMEOUT: Duration = Duration::from_secs(30);

const AGENT: &str = "Kiroshi";

pub(super) const STREAMABLE_HTTP: &str = "streamable-http";

pub(super) const SSE: &str = "sse";

const NPM: &str = "npm";

const PYPI: &str = "pypi";

const SMITHERY_HOSTS: [&str; 2] = ["run.tools", "smithery.ai"];

const LABELS: usize = 2;

pub(super) const OFFICIAL_SOURCE: &str = "the official registry";

#[derive(Deserialize)]
struct Listed {
	servers: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
	server: Server,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Server {
	name: String,
	#[serde(default)]
	title: Option<String>,
	#[serde(default)]
	description: String,
	#[serde(default)]
	remotes: Vec<Remote>,
	#[serde(default)]
	packages: Vec<Package>,
	#[serde(default)]
	icons: Vec<Icon>,
}

#[derive(Deserialize)]
struct Icon {
	src: String,
}

#[derive(Deserialize)]
struct Remote {
	#[serde(rename = "type")]
	kind: String,
	url: String,
	#[serde(default)]
	headers: Vec<Input>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Package {
	registry_type: String,
	identifier: String,
	#[serde(default)]
	environment_variables: Vec<Input>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input {
	name: String,
	#[serde(default)]
	description: Option<String>,
	#[serde(default)]
	is_required: bool,
	#[serde(default)]
	is_secret: bool,
	#[serde(default)]
	value: Option<String>,
	#[serde(default)]
	default: Option<Value>,
}

enum Transport<'a> {
	Remote(&'a Remote, String),
	Package(&'a Package),
}

struct Served {
	config: Value,
	install: Install,
	hosted_by: Option<String>,
}

#[derive(Debug)]
pub(super) enum Dropped {
	HostedBySmithery,
	Unread,
}

pub async fn search(base: &str, query: &str) -> Result<Vec<Application>, ApplicationsError> {
	let mut list = endpoint(&parsed(base)?, &[API_VERSION, "servers"])?;
	list.query_pairs_mut()
		.append_pair("search", query)
		.append_pair("limit", BOUND)
		.append_pair("version", LATEST);
	let listed: Listed = read(&client()?, list).await?;
	let rows = distinct(listed.servers);
	let answered = rows.len();
	let read = rows.into_iter().map(descriptor).collect();
	Ok(normalised(answered, read))
}

pub async fn detail(base: &str, name: &str) -> Result<Option<Application>, ApplicationsError> {
	let url = detail_endpoint(&parsed(base)?, name)?;
	match read::<Entry>(&client()?, url).await {
		Ok(entry) => Ok(descriptor(entry.server).ok()),
		Err(ApplicationsError::RegistryRefused { status }) if status == StatusCode::NOT_FOUND => {
			Ok(None)
		}
		Err(failure) => Err(failure),
	}
}

pub(super) fn parsed(base: &str) -> Result<Url, ApplicationsError> {
	Url::parse(base)
		.map_err(|error| ApplicationsError::RegistryUnreached { detail: error.to_string() })
}

fn detail_endpoint(base: &Url, name: &str) -> Result<Url, ApplicationsError> {
	endpoint(base, &[API_VERSION, "servers", name, "versions", LATEST])
}

fn distinct(entries: Vec<Entry>) -> Vec<Server> {
	let mut seen = HashSet::new();
	entries
		.into_iter()
		.map(|entry| entry.server)
		.filter(|server| seen.insert(server.name.clone()))
		.collect()
}

pub(super) fn client() -> Result<Client, ApplicationsError> {
	installed_tls_provider();
	let mut headers = HeaderMap::new();
	headers.insert(USER_AGENT, HeaderValue::from_static(AGENT));
	Client::builder().timeout(TIMEOUT).default_headers(headers).build().map_err(|error| {
		ApplicationsError::RegistryUnreached {
			detail: format!("the http client was not built: {error}"),
		}
	})
}

pub(super) fn endpoint(base: &Url, segments: &[&str]) -> Result<Url, ApplicationsError> {
	let mut url = base.clone();
	url.path_segments_mut()
		.map_err(|()| ApplicationsError::RegistryUnreached {
			detail: format!("{base} cannot hold a path"),
		})?
		.pop_if_empty()
		.extend(segments);
	Ok(url)
}

pub(super) async fn read<T: DeserializeOwned>(
	client: &Client,
	url: Url,
) -> Result<T, ApplicationsError> {
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

fn descriptor(server: Server) -> Result<Application, Dropped> {
	let served = match transport(&server)? {
		Transport::Remote(remote, host) => remote_served(remote, host),
		Transport::Package(package) => package_served(package),
	};
	Ok(Application {
		title: server.title.unwrap_or_else(|| server.name.clone()),
		name: server.name,
		description: server.description,
		config: served.config,
		tools: None,
		logo: None,
		logo_url: server.icons.first().map(|icon| icon.src.clone()),
		use_count: None,
		verified: None,
		hosted_by: served.hosted_by,
		categories: Vec::new(),
		auth_posture: None,
		install: served.install,
	})
}

fn normalised(answered: usize, read: Vec<Result<Application, Dropped>>) -> Vec<Application> {
	let unread = read.iter().filter(|held| matches!(held, Err(Dropped::Unread))).count();
	if let Some(line) = drift(answered, unread) {
		eprintln!("{line}");
	}
	read.into_iter().flatten().collect()
}

fn drift(answered: usize, unread: usize) -> Option<String> {
	(unread > 0).then(|| {
		format!(
			"{OFFICIAL_SOURCE} answered {answered} rows and {unread} carried no transport this reader reads"
		)
	})
}

fn elsewhere(endpoint: &Url) -> Result<String, Dropped> {
	let Some(host) = endpoint.host_str().map(str::to_lowercase) else {
		return Err(Dropped::Unread);
	};
	if SMITHERY_HOSTS.iter().any(|root| under(&host, root)) {
		return Err(Dropped::HostedBySmithery);
	}
	Ok(last_labels(&host))
}

fn under(host: &str, root: &str) -> bool {
	host == root || host.ends_with(&format!(".{root}"))
}

fn last_labels(host: &str) -> String {
	let labels: Vec<&str> = host.split('.').collect();
	labels[labels.len().saturating_sub(LABELS)..].join(".")
}

fn remote_served(remote: &Remote, host: String) -> Served {
	let hosted_by = Some(host);
	let (headers, fields) = classified(&remote.headers);
	if fields.is_empty() {
		return Served { config: remote_config(remote), install: Install::Oauth, hosted_by };
	}
	let config = headed_config(remote, headers);
	let install = Install::asking(fields).covering(&config);
	Served { config, install, hosted_by }
}

fn package_served(package: &Package) -> Served {
	let (env, fields) = classified(&package.environment_variables);
	let config = package_config(package, env);
	let asking = if fields.is_empty() { Install::Nothing } else { Install::asking(fields) };
	let install = asking.covering(&config);
	Served { config, install, hosted_by: None }
}

fn transport(server: &Server) -> Result<Transport<'_>, Dropped> {
	if let Some(package) = server.packages.iter().find(|package| runs_locally(package)) {
		return Ok(Transport::Package(package));
	}
	let mut dropped = Dropped::Unread;
	for remote in ordered(server) {
		let Ok(endpoint) = Url::parse(&remote.url) else {
			return Err(Dropped::Unread);
		};
		match elsewhere(&endpoint) {
			Ok(host) => return Ok(Transport::Remote(remote, host)),
			Err(Dropped::HostedBySmithery) => dropped = Dropped::HostedBySmithery,
			Err(Dropped::Unread) => return Err(Dropped::Unread),
		}
	}
	Err(dropped)
}

fn ordered(server: &Server) -> impl Iterator<Item = &Remote> {
	[STREAMABLE_HTTP, SSE]
		.into_iter()
		.flat_map(|kind| server.remotes.iter().filter(move |remote| remote.kind == kind))
}

fn runs_locally(package: &Package) -> bool {
	matches!(package.registry_type.as_str(), NPM | PYPI)
}

fn remote_config(remote: &Remote) -> Value {
	json!({ "type": "http", "url": remote.url })
}

fn headed_config(remote: &Remote, headers: Map<String, Value>) -> Value {
	let mut config = remote_config(remote);
	config["headers"] = Value::Object(headers);
	config
}

fn substituted(template: &str, reference: &str) -> Option<String> {
	let (before, opened) = template.split_once('{')?;
	let (_, after) = opened.split_once('}')?;
	let rest = substituted(after, reference).unwrap_or_else(|| after.to_owned());
	Some(format!("{before}{reference}{rest}"))
}

fn package_config(package: &Package, env: Map<String, Value>) -> Value {
	let (command, args) = launched(package);
	let mut config = json!({ "type": "stdio", "command": command, "args": args });
	if !env.is_empty() {
		config["env"] = Value::Object(env);
	}
	config
}

fn launched(package: &Package) -> (&'static str, Vec<&str>) {
	match package.registry_type.as_str() {
		PYPI => (UVX, vec![package.identifier.as_str()]),
		_ => (NPX, vec!["-y", package.identifier.as_str()]),
	}
}

pub(super) fn reference(declared: &str) -> String {
	format!("${{{}}}", variable(declared))
}

enum Filling {
	Asked(String),
	Fixed(String),
	Absent,
}

fn classified(inputs: &[Input]) -> (Map<String, Value>, Vec<InstallField>) {
	let mut served = Map::new();
	let mut asked = Vec::new();
	for input in inputs {
		match filling(input) {
			Filling::Asked(value) => {
				served.insert(input.name.clone(), Value::String(value));
				asked.push(asked_field(input));
			}
			Filling::Fixed(value) => {
				served.insert(input.name.clone(), Value::String(value));
			}
			Filling::Absent => {}
		}
	}
	(served, asked)
}

fn filling(input: &Input) -> Filling {
	if let Some(templated) = templated(input) {
		return Filling::Asked(templated);
	}
	if input.is_required && input.is_secret {
		return Filling::Asked(reference(&input.name));
	}
	if let Some(value) = input.value.as_deref() {
		return Filling::Fixed(value.to_owned());
	}
	if let Some(held) = input.default.as_ref().and_then(Value::as_str) {
		return Filling::Fixed(held.to_owned());
	}
	if input.is_required {
		return Filling::Asked(reference(&input.name));
	}
	Filling::Absent
}

fn templated(input: &Input) -> Option<String> {
	substituted(input.value.as_deref()?, &reference(&input.name))
}

fn asked_field(input: &Input) -> InstallField {
	InstallField {
		name: input.name.clone(),
		secret: variable(&input.name),
		description: input.description.clone(),
		concealed: input.is_secret,
	}
}

pub(super) fn variable(declared: &str) -> String {
	let named: String = declared
		.chars()
		.map(|held| if held.is_ascii_alphanumeric() { held.to_ascii_uppercase() } else { '_' })
		.collect();
	if named.starts_with(|held: char| held.is_ascii_digit()) {
		return format!("_{named}");
	}
	named
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

	const BROKEN: &str = "io.test/broken";

	fn described(body: Value) -> Application {
		let server: Server = serde_json::from_value(body).expect("the fixture is a server.json");
		descriptor(server).expect("the fixture offers a transport")
	}

	fn a_remote_without_headers() -> Value {
		json!({
			"name": "com.notion/mcp",
			"title": "Notion",
			"description": "Notion workspace.",
			"remotes": [{ "type": "streamable-http", "url": "https://mcp.notion.test/mcp" }],
		})
	}

	fn a_remote_asking_a_required_secret_header() -> Value {
		json!({
			"name": "ai.hosted/hosted-notion",
			"description": "Notion through a gateway.",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://server.hosted.test/notion/mcp",
				"headers": [{
					"name": "Authorization",
					"description": "Bearer token for the gateway authentication",
					"isRequired": true,
					"isSecret": true,
					"value": "Bearer {gateway_api_key}",
				}],
			}],
		})
	}

	fn an_npm_package_declaring(variables: Value) -> Application {
		described(an_npm_package_entry(variables))
	}

	fn an_npm_package_entry(variables: Value) -> Value {
		json!({
			"name": "io.github.Digital-Defiance/mcp-filesystem",
			"description": "A filesystem server.",
			"packages": [{
				"registryType": "npm",
				"identifier": "@digital-defiance/mcp-filesystem",
				"version": "1.0.0",
				"transport": { "type": "stdio" },
				"environmentVariables": variables,
			}],
		})
	}

	#[test]
	fn a_remote_with_no_header_answers_oauth() {
		let application = described(a_remote_without_headers());

		assert_eq!(application.install, Install::Oauth);
		assert_eq!(
			application.config,
			json!({ "type": "http", "url": "https://mcp.notion.test/mcp" })
		);
		assert_eq!(application.title, "Notion");
		assert_eq!(application.logo, None);
		assert_eq!(application.logo_url, None);
	}

	#[test]
	fn a_registry_server_answers_no_tool_list_at_all() {
		assert_eq!(described(a_remote_without_headers()).tools, None);
		assert_eq!(described(a_godot_npm_server_asking_nothing()).tools, None);
	}

	#[test]
	fn a_required_secret_header_answers_the_key_case_naming_it() {
		let application = described(a_remote_asking_a_required_secret_header());

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "Authorization".to_owned(),
					secret: "AUTHORIZATION".to_owned(),
					description: Some("Bearer token for the gateway authentication".to_owned()),
					concealed: true,
				}],
			}
		);
		assert_eq!(
			application.config,
			json!({
				"type": "http",
				"url": "https://server.hosted.test/notion/mcp",
				"headers": { "Authorization": "Bearer ${AUTHORIZATION}" },
			})
		);
		assert_eq!(application.title, "ai.hosted/hosted-notion");
	}

	#[test]
	fn a_required_secret_header_answers_the_key_case_whatever_its_declared_value() {
		let application = described(json!({
			"name": "io.test/fixed",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://fixed.test/mcp",
				"headers": [{ "name": "X-Api-Key", "isRequired": true, "isSecret": true, "value": "fixed" }],
			}],
		}));

		assert!(
			matches!(application.install, Install::Key { .. }),
			"got {:?}",
			application.install
		);
		assert_eq!(application.config["headers"], json!({ "X-Api-Key": "${X_API_KEY}" }));
	}

	fn a_remote_declaring(header: Value) -> Application {
		described(json!({
			"name": "ai.bowmark/bowmark",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://bowmark.test/mcp",
				"headers": [header],
			}],
		}))
	}

	#[test]
	fn a_header_value_carrying_a_placeholder_answers_the_key_case_without_any_flag() {
		let application =
			a_remote_declaring(json!({ "name": "Authorization", "value": "Bearer {api_key}" }));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "Authorization".to_owned(),
					secret: "AUTHORIZATION".to_owned(),
					description: None,
					concealed: false,
				}],
			}
		);
		assert_eq!(
			application.config["headers"],
			json!({ "Authorization": "Bearer ${AUTHORIZATION}" })
		);
	}

	fn a_remote_declaring_headers(headers: Value) -> Application {
		described(json!({
			"name": "io.test/headed",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://headed.test/mcp",
				"headers": headers,
			}],
		}))
	}

	#[test]
	fn a_header_neither_required_secret_nor_filled_is_left_out_beside_an_asked_header() {
		let application = a_remote_declaring_headers(json!([
			{ "name": "Authorization", "isRequired": true, "isSecret": true },
			{ "name": "X-Trace", "isSecret": true },
		]));

		assert_eq!(application.config["headers"], json!({ "Authorization": "${AUTHORIZATION}" }));
	}

	#[test]
	fn a_plain_text_header_value_is_served_verbatim_beside_an_asked_header() {
		let application = a_remote_declaring_headers(json!([
			{ "name": "Authorization", "isRequired": true, "isSecret": true },
			{ "name": "X-Client", "value": "kiroshi" },
		]));

		assert_eq!(
			application.config["headers"],
			json!({ "Authorization": "${AUTHORIZATION}", "X-Client": "kiroshi" })
		);
		let Install::Key { fields } = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(fields.len(), 1);
		assert_eq!(fields[0].name, "Authorization");
	}

	#[test]
	fn a_required_plain_header_is_asked_for_and_serves_its_reference() {
		let application = a_remote_declaring_headers(json!([
			{ "name": "X-Account", "isRequired": true, "description": "The account." },
		]));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "X-Account".to_owned(),
					secret: "X_ACCOUNT".to_owned(),
					description: Some("The account.".to_owned()),
					concealed: false,
				}],
			}
		);
		assert_eq!(application.config["headers"], json!({ "X-Account": "${X_ACCOUNT}" }));
	}

	#[test]
	fn a_static_header_value_without_any_flag_answers_oauth_and_writes_no_header() {
		let application = a_remote_declaring(json!({ "name": "X-Client", "value": "kiroshi" }));

		assert_eq!(application.install, Install::Oauth);
		assert!(application.config.get("headers").is_none(), "got {}", application.config);
	}

	#[test]
	fn a_required_plain_variable_carrying_a_default_serves_that_default_and_asks_for_nothing() {
		let application = an_npm_package_declaring(json!([
			{ "name": "ALLOWED_ROOT", "isRequired": true, "default": "/srv/data" },
			{ "name": "LOG_LEVEL", "isRequired": false },
		]));

		assert_eq!(application.install, Install::Nothing);
		assert_eq!(
			application.config,
			json!({
				"type": "stdio",
				"command": "npx",
				"args": ["-y", "@digital-defiance/mcp-filesystem"],
				"env": { "ALLOWED_ROOT": "/srv/data" },
			})
		);
	}

	#[test]
	fn a_required_plain_variable_carrying_no_default_is_asked_for_and_serves_its_reference() {
		let application = an_npm_package_declaring(json!([
			{ "name": "ALLOWED_ROOT", "isRequired": true, "description": "The served root." },
		]));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "ALLOWED_ROOT".to_owned(),
					secret: "ALLOWED_ROOT".to_owned(),
					description: Some("The served root.".to_owned()),
					concealed: false,
				}],
			}
		);
		assert_eq!(application.config["env"], json!({ "ALLOWED_ROOT": "${ALLOWED_ROOT}" }));
	}

	#[test]
	fn a_default_that_is_a_number_reads_as_absent_and_the_entry_still_describes() {
		let application = an_npm_package_declaring(json!([
			{ "name": "PORT", "isRequired": true, "default": 8080 },
			{ "name": "DEBUG", "default": false },
		]));

		assert_eq!(application.name, "io.github.Digital-Defiance/mcp-filesystem");
		assert!(
			matches!(application.install, Install::Key { .. }),
			"got {:?}",
			application.install
		);
		assert_eq!(application.config["env"], json!({ "PORT": "${PORT}" }));
	}

	#[test]
	fn a_secret_header_whose_requirement_is_absent_answers_oauth() {
		let application = described(json!({
			"name": "io.github.github/github-mcp-server",
			"description": "GitHub.",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://api.github.test/mcp/",
				"headers": [{ "name": "Authorization", "isSecret": true }],
			}],
		}));

		assert_eq!(application.install, Install::Oauth);
		assert_eq!(
			application.config,
			json!({ "type": "http", "url": "https://api.github.test/mcp/" })
		);
		assert!(application.config.get("headers").is_none());
	}

	#[test]
	fn every_required_variable_is_asked_for_in_order_and_an_optional_one_is_left_out() {
		let application = described(json!({
			"name": "io.test/keyed",
			"packages": [{
				"registryType": "npm",
				"identifier": "keyed-mcp",
				"environmentVariables": [
					{ "name": "OPTIONAL_TOKEN", "isSecret": true },
					{ "name": "api-key", "isRequired": true, "isSecret": true, "description": "The key." },
					{ "name": "OTHER_KEY", "isRequired": true, "isSecret": true },
				],
			}],
		}));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![
					InstallField {
						name: "api-key".to_owned(),
						secret: "API_KEY".to_owned(),
						description: Some("The key.".to_owned()),
						concealed: true,
					},
					InstallField {
						name: "OTHER_KEY".to_owned(),
						secret: "OTHER_KEY".to_owned(),
						description: None,
						concealed: true,
					},
				],
			}
		);
		assert_eq!(
			application.config["env"],
			json!({ "api-key": "${API_KEY}", "OTHER_KEY": "${OTHER_KEY}" })
		);
	}

	#[test]
	fn every_required_secret_header_is_asked_for_and_every_placeholder_is_resolved() {
		let application = described(json!({
			"name": "io.test/two-headers",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://two.test/mcp",
				"headers": [
					{
						"name": "Authorization",
						"description": "The key.",
						"isRequired": true,
						"isSecret": true,
						"value": "Bearer {api_key}",
					},
					{ "name": "X-Tenant", "isRequired": true, "isSecret": true },
				],
			}],
		}));

		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![
					InstallField {
						name: "Authorization".to_owned(),
						secret: "AUTHORIZATION".to_owned(),
						description: Some("The key.".to_owned()),
						concealed: true,
					},
					InstallField {
						name: "X-Tenant".to_owned(),
						secret: "X_TENANT".to_owned(),
						description: None,
						concealed: true,
					},
				],
			}
		);
		assert_eq!(
			application.config["headers"],
			json!({ "Authorization": "Bearer ${AUTHORIZATION}", "X-Tenant": "${X_TENANT}" })
		);
	}

	#[test]
	fn two_required_headers_answering_one_variable_refuse_the_install_and_keep_the_config() {
		let application = described(json!({
			"name": "io.test/collapsed",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://collapsed.test/mcp",
				"headers": [
					{ "name": "api-key", "isRequired": true, "isSecret": true },
					{ "name": "api_key", "isRequired": true, "isSecret": true },
				],
			}],
		}));

		let Install::Refused(refusal) = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(refusal.field, "api_key");
		assert!(refusal.reason.contains("api-key"), "got {}", refusal.reason);
		assert!(refusal.reason.contains("api_key"), "got {}", refusal.reason);
		assert!(refusal.reason.contains("API_KEY"), "got {}", refusal.reason);
		assert_eq!(
			application.config,
			json!({
				"type": "http",
				"url": "https://collapsed.test/mcp",
				"headers": { "api-key": "${API_KEY}", "api_key": "${API_KEY}" },
			})
		);
	}

	fn a_godot_pypi_server() -> Value {
		json!({
			"name": "io.github.DiegoBr4nd/godot-gut-mcp",
			"description": "Servidor MCP que permite ejecutar tests de Godot con GUT desde cualquier IA",
			"repository": { "url": "https://github.com/DiegoBr4nd/godot-gut-mcp", "source": "github" },
			"version": "0.1.2",
			"packages": [{
				"registryType": "pypi",
				"identifier": "godot-gut-mcp",
				"version": "0.1.2",
				"transport": { "type": "stdio" },
				"environmentVariables": [
					{
						"description": "Ruta al ejecutable de Godot (por ejemplo C:/ruta/a/godot.exe)",
						"isRequired": true,
						"format": "string",
						"name": "GODOT_PATH",
					},
					{
						"description": "Ruta a la carpeta del proyecto de Godot (la que contiene project.godot)",
						"isRequired": true,
						"format": "string",
						"name": "GODOT_PROJECT_PATH",
					},
				],
			}],
		})
	}

	fn a_godot_npm_server_asking_a_secret() -> Value {
		json!({
			"name": "io.github.FunplayAI/funplay-godot-mcp",
			"description": "stdio bridge for the local Godot Editor MCP server.",
			"title": "Funplay Godot MCP",
			"version": "0.10.0",
			"packages": [{
				"registryType": "npm",
				"identifier": "funplay-godot-mcp",
				"version": "0.10.0",
				"transport": { "type": "stdio" },
				"environmentVariables": [
					{
						"description": "Optional Godot MCP HTTP endpoint. Defaults to http://127.0.0.1:8765/.",
						"format": "string",
						"name": "FUNPLAY_GODOT_MCP_URL",
					},
					{
						"description": "Compatibility endpoint variable used when FUNPLAY_GODOT_MCP_URL is not set.",
						"format": "string",
						"name": "GODOT_MCP_URL",
					},
					{
						"description": "Godot MCP local auth token from the Funplay MCP dock.",
						"isRequired": true,
						"format": "string",
						"isSecret": true,
						"name": "FUNPLAY_GODOT_MCP_TOKEN",
					},
					{
						"description": "Compatibility token variable used when FUNPLAY_GODOT_MCP_TOKEN is not set.",
						"format": "string",
						"isSecret": true,
						"name": "GODOT_MCP_TOKEN",
					},
				],
			}],
		})
	}

	fn a_godot_npm_server_asking_nothing() -> Value {
		json!({
			"name": "io.github.TomasLucasUTN/godot-mcp-bridge",
			"description": "MCP server for Godot game engine integration",
			"version": "1.2.1",
			"packages": [{
				"registryType": "npm",
				"identifier": "godot-mcp-bridge",
				"version": "1.2.1",
				"transport": { "type": "stdio" },
			}],
		})
	}

	#[test]
	fn the_godot_pypi_server_runs_through_uvx_and_asks_for_its_two_plain_variables() {
		let application = described(a_godot_pypi_server());

		assert_eq!(
			application.config,
			json!({
				"type": "stdio",
				"command": "uvx",
				"args": ["godot-gut-mcp"],
				"env": {
					"GODOT_PATH": "${GODOT_PATH}",
					"GODOT_PROJECT_PATH": "${GODOT_PROJECT_PATH}",
				},
			})
		);
		let Install::Key { fields } = &application.install else {
			panic!("got {:?}", application.install);
		};
		assert_eq!(
			fields.iter().map(|held| (held.name.as_str(), held.concealed)).collect::<Vec<_>>(),
			[("GODOT_PATH", false), ("GODOT_PROJECT_PATH", false)]
		);
		assert_eq!(
			fields[0].description.as_deref(),
			Some("Ruta al ejecutable de Godot (por ejemplo C:/ruta/a/godot.exe)")
		);
	}

	#[test]
	fn the_godot_npm_server_runs_through_npx_and_asks_for_its_one_concealed_variable() {
		let application = described(a_godot_npm_server_asking_a_secret());

		assert_eq!(
			application.config,
			json!({
				"type": "stdio",
				"command": "npx",
				"args": ["-y", "funplay-godot-mcp"],
				"env": { "FUNPLAY_GODOT_MCP_TOKEN": "${FUNPLAY_GODOT_MCP_TOKEN}" },
			})
		);
		assert_eq!(
			application.install,
			Install::Key {
				fields: vec![InstallField {
					name: "FUNPLAY_GODOT_MCP_TOKEN".to_owned(),
					secret: "FUNPLAY_GODOT_MCP_TOKEN".to_owned(),
					description: Some(
						"Godot MCP local auth token from the Funplay MCP dock.".to_owned()
					),
					concealed: true,
				}],
			}
		);
	}

	#[test]
	fn the_godot_npm_server_declaring_no_variable_runs_through_npx_and_asks_for_nothing() {
		let application = described(a_godot_npm_server_asking_nothing());

		assert_eq!(
			application.config,
			json!({ "type": "stdio", "command": "npx", "args": ["-y", "godot-mcp-bridge"] })
		);
		assert_eq!(application.install, Install::Nothing);
	}

	#[test]
	fn the_first_icon_of_an_entry_answers_its_logo_url() {
		let application = described(json!({
			"name": "com.notion/mcp",
			"remotes": [{ "type": "streamable-http", "url": "https://mcp.notion.test/mcp" }],
			"icons": [
				{ "src": "https://icons.test/notion.png" },
				{ "src": "https://icons.test/notion.svg" },
			],
		}));

		assert_eq!(application.logo_url.as_deref(), Some("https://icons.test/notion.png"));
	}

	#[test]
	fn a_package_is_preferred_over_every_remote_and_streamable_http_over_sse() {
		let npm = json!({ "registryType": "npm", "identifier": "an-mcp" });
		let image = json!({ "registryType": "oci", "identifier": "docker.io/owner/an-mcp" });
		let sse = json!({ "type": "sse", "url": "https://sse.test/mcp" });
		let streamable = json!({ "type": "streamable-http", "url": "https://streamable.test/mcp" });

		let packaged =
			described(json!({ "name": "a", "remotes": [sse, streamable], "packages": [npm] }));
		let remote =
			described(json!({ "name": "a", "remotes": [sse, streamable], "packages": [image] }));
		let no_streamable = described(json!({ "name": "a", "remotes": [sse] }));

		assert_eq!(
			packaged.config,
			json!({ "type": "stdio", "command": "npx", "args": ["-y", "an-mcp"] })
		);
		assert_eq!(packaged.install, Install::Nothing);
		assert_eq!(packaged.hosted_by, None);
		assert_eq!(remote.config["url"], "https://streamable.test/mcp");
		assert_eq!(no_streamable.config, json!({ "type": "http", "url": "https://sse.test/mcp" }));
	}

	fn dropped(body: Value) -> Dropped {
		let server: Server = serde_json::from_value(body).expect("the fixture is a server.json");
		match descriptor(server) {
			Err(held) => held,
			Ok(application) => panic!("{} answered a listing", application.name),
		}
	}

	#[test]
	fn a_remote_hosted_by_smithery_answers_no_listing_whatever_its_subdomain() {
		for url in [
			"https://server.smithery.ai/notion/mcp",
			"https://smithery.ai/mcp",
			"https://slack.run.tools",
			"https://run.tools/mcp",
		] {
			let held = dropped(json!({
				"name": "io.test/hosted",
				"remotes": [{ "type": "streamable-http", "url": url }],
			}));

			assert!(matches!(held, Dropped::HostedBySmithery), "{url} answered {held:?}");
		}
	}

	#[test]
	fn a_remote_hosted_elsewhere_is_read_though_the_one_before_it_is_hosted_by_smithery() {
		let application = described(json!({
			"name": "io.test/two-remotes",
			"remotes": [
				{ "type": "streamable-http", "url": "https://io-test.run.tools/mcp" },
				{ "type": "sse", "url": "https://mcp.io.test/sse" },
			],
		}));

		assert_eq!(application.config, json!({ "type": "http", "url": "https://mcp.io.test/sse" }));
		assert_eq!(application.hosted_by.as_deref(), Some("io.test"));
	}

	#[test]
	fn an_entry_whose_every_remote_is_hosted_by_smithery_answers_no_listing() {
		let held = dropped(json!({
			"name": "io.test/hosted",
			"remotes": [
				{ "type": "streamable-http", "url": "https://io-test.run.tools/mcp" },
				{ "type": "sse", "url": "https://server.smithery.ai/io-test/sse" },
			],
		}));

		assert!(matches!(held, Dropped::HostedBySmithery), "got {held:?}");
	}

	#[test]
	fn a_remote_hosted_outside_smithery_carries_the_last_two_labels_of_its_host() {
		let application = described(a_remote_without_headers());

		assert_eq!(application.hosted_by.as_deref(), Some("notion.test"));
	}

	#[tokio::test]
	async fn a_detail_read_by_name_on_a_smithery_deployment_answers_no_application() {
		let hosted = json!({
			"name": "io.test/hosted",
			"remotes": [{ "type": "streamable-http", "url": "https://server.smithery.ai/mcp" }],
		});
		let (base, _) = serving(holding(Vec::new()).also(hosted)).await;

		assert_eq!(detail(&base, "io.test/hosted").await, Ok(None));
		let found = detail(&base, "com.notion/mcp").await.expect("the detail answers");
		assert_eq!(found.map(|held| held.name), Some("com.notion/mcp".to_owned()));
	}

	#[test]
	fn an_entry_offering_no_remote_and_no_package_a_runner_reads_is_left_out() {
		let server: Server = serde_json::from_value(json!({
			"name": "io.test/image-only",
			"remotes": [{ "type": "websocket", "url": "wss://ws.test/mcp" }],
			"packages": [
				{ "registryType": "oci", "identifier": "docker.io/owner/an-mcp:latest" },
				{ "registryType": "nuget", "identifier": "Owner.AnMcp" },
			],
		}))
		.expect("the fixture is a server.json");

		assert!(matches!(descriptor(server), Err(Dropped::Unread)));
	}

	#[test]
	fn a_read_whose_every_row_carried_a_transport_says_nothing() {
		assert_eq!(drift(10, 0), None);
	}

	#[test]
	fn a_read_carrying_a_row_no_transport_was_read_in_names_its_source_and_its_count() {
		let line = drift(10, 2).expect("the drift is named");

		assert!(line.contains(OFFICIAL_SOURCE), "got {line}");
		assert!(line.contains("10"), "got {line}");
	}

	#[test]
	fn a_read_answers_its_applications_and_leaves_out_every_dropped_row() {
		let read = vec![
			Ok(described(a_remote_without_headers())),
			Err(Dropped::HostedBySmithery),
			Err(Dropped::Unread),
		];

		let kept: Vec<String> = normalised(3, read).into_iter().map(|held| held.name).collect();

		assert_eq!(kept, ["com.notion/mcp"]);
	}

	pub(crate) struct Held {
		list_status: StatusCode,
		list_body: Option<Value>,
		listed: Vec<&'static str>,
		details: HashMap<String, Value>,
		pub(crate) asked: Mutex<Vec<String>>,
		pub(crate) detailed: Mutex<Vec<String>>,
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
			.route("/v0.1/servers", get(list_of))
			.route("/v0.1/servers/{name}/versions/latest", get(detail_of))
			.with_state(held.clone());
		tokio::spawn(async move { axum::serve(listener, router).await.expect("the stub serves") });
		(format!("http://{address}"), held)
	}

	impl Held {
		pub(crate) fn also(mut self, detail: Value) -> Self {
			let name = detail["name"].as_str().expect("named").to_owned();
			self.details.insert(name, detail);
			self
		}

		fn served(&self, name: &str) -> Value {
			self.details.get(name).cloned().unwrap_or_else(|| json!({ "name": name }))
		}
	}

	async fn list_of(Extracted(held): Extracted<Arc<Held>>, uri: Uri) -> Answered {
		held.asked.lock().expect("the stub records").push(uri.to_string());
		if held.list_status != StatusCode::OK {
			return held.list_status.into_response();
		}
		if let Some(body) = &held.list_body {
			return as_json(body);
		}
		let servers: Vec<Value> =
			held.listed.iter().map(|name| json!({ "server": held.served(name) })).collect();
		as_json(&json!({ "servers": servers, "metadata": { "count": servers.len() } }))
	}

	async fn detail_of(
		Extracted(held): Extracted<Arc<Held>>,
		AxumPath(name): AxumPath<String>,
	) -> Answered {
		held.detailed.lock().expect("the stub records").push(name.clone());
		match held.details.get(&name) {
			Some(detail) => as_json(&json!({ "server": detail })),
			None if held.listed.contains(&name.as_str()) => {
				StatusCode::INTERNAL_SERVER_ERROR.into_response()
			}
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

	pub(crate) fn holding(listed: Vec<&'static str>) -> Held {
		let package =
			an_npm_package_entry(json!([{ "name": "ALLOWED_ROOT", "default": "/srv/data" }]));
		let details = [a_remote_without_headers(), package]
			.into_iter()
			.map(|detail| (detail["name"].as_str().expect("named").to_owned(), detail))
			.collect();
		Held {
			list_status: StatusCode::OK,
			list_body: None,
			listed,
			details,
			asked: Mutex::new(Vec::new()),
			detailed: Mutex::new(Vec::new()),
		}
	}

	#[tokio::test]
	async fn a_search_builds_every_application_from_the_one_list_answer() {
		let (base, held) =
			serving(holding(vec!["com.notion/mcp", "io.github.Digital-Defiance/mcp-filesystem"]))
				.await;

		let found = search(&base, "notion files").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.name.as_str()).collect();
		assert_eq!(names, ["com.notion/mcp", "io.github.Digital-Defiance/mcp-filesystem"]);
		assert_eq!(found[0].install, Install::Oauth);
		assert_eq!(found[1].install, Install::Nothing);
		let asked = held.asked.lock().expect("the stub records").clone();
		assert_eq!(asked, ["/v0.1/servers?search=notion+files&limit=10&version=latest"]);
		assert!(held.detailed.lock().expect("the stub records").is_empty(), "a detail was read");
	}

	#[tokio::test]
	async fn a_row_offering_no_transport_is_left_out_and_the_rows_around_it_answered() {
		let (base, _) = serving(holding(vec![
			"com.notion/mcp",
			BROKEN,
			"io.github.Digital-Defiance/mcp-filesystem",
		]))
		.await;

		let found = search(&base, "notion files").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.name.as_str()).collect();
		assert_eq!(names, ["com.notion/mcp", "io.github.Digital-Defiance/mcp-filesystem"]);
	}

	#[tokio::test]
	async fn a_server_listed_twice_is_answered_once_at_the_rank_of_its_first_row() {
		let (base, _) = serving(holding(vec![
			"com.notion/mcp",
			"io.github.Digital-Defiance/mcp-filesystem",
			"com.notion/mcp",
		]))
		.await;

		let found = search(&base, "notion").await.expect("the search answers");

		let names: Vec<&str> = found.iter().map(|held| held.name.as_str()).collect();
		assert_eq!(names, ["com.notion/mcp", "io.github.Digital-Defiance/mcp-filesystem"]);
	}

	#[tokio::test]
	async fn a_list_whose_every_row_carries_no_transport_answers_an_empty_list_and_no_error() {
		let (base, _) = serving(holding(vec![BROKEN, "io.test/also-broken"])).await;

		assert!(search(&base, "broken").await.expect("the search answers").is_empty());
	}

	#[tokio::test]
	async fn a_list_body_that_is_not_a_list_of_servers_answers_the_unreadable_case() {
		let mut garbled = holding(vec!["com.notion/mcp"]);
		garbled.list_body = Some(json!({ "servers": "none" }));
		let (base, _) = serving(garbled).await;

		let answered = search(&base, "notion").await.err();

		assert!(
			matches!(answered, Some(ApplicationsError::RegistryUnreadable { .. })),
			"got {answered:?}"
		);
	}

	#[tokio::test]
	async fn a_query_matching_nothing_answers_an_empty_list() {
		let (base, _) = serving(holding(Vec::new())).await;

		assert!(search(&base, "nothing").await.expect("the search answers").is_empty());
	}

	#[tokio::test]
	async fn a_refused_list_answers_an_error_and_not_an_empty_list() {
		let mut refusing = holding(vec!["com.notion/mcp"]);
		refusing.list_status = StatusCode::SERVICE_UNAVAILABLE;
		let (base, _) = serving(refusing).await;

		assert_eq!(
			search(&base, "notion").await.err(),
			Some(ApplicationsError::RegistryRefused { status: 503 })
		);
	}

	#[tokio::test]
	async fn an_unreached_registry_answers_an_error_and_not_an_empty_list() {
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
		let address = listener.local_addr().expect("the port is named");
		drop(listener);

		let answered = search(&format!("http://{address}"), "notion").await.err();

		assert!(
			matches!(answered, Some(ApplicationsError::RegistryUnreached { .. })),
			"got {answered:?}"
		);
	}
}
