use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Runtime};

use super::reach::{self, Reach};

use crate::host_api::invoke::names_an_app_command;
use crate::missions::github::installed_tls_provider;

const INVOKE_BOUND: Duration = Duration::from_secs(300);

const HOST_ONLY_REFUSAL: &str = "this command belongs to the host";

const OTHER_SPACE_REFUSAL: &str = "this command reaches outside the shared space";

pub(crate) const SHARED_SPACE_COMMAND: &str = "relay_shared_space";

#[derive(Clone)]
pub struct LocalApi {
	origin: String,
	token: String,
	client: Client,
}

impl LocalApi {
	pub fn new(origin: String, token: String) -> Result<Self, String> {
		installed_tls_provider();
		let client = Client::builder()
			.timeout(INVOKE_BOUND)
			.build()
			.map_err(|error| format!("the local host api client could not be built: {error}"))?;
		Ok(Self { origin, token, client })
	}
}

#[derive(Debug, PartialEq)]
pub(super) struct MemberCall {
	id: Value,
	command: String,
	args: Value,
}

pub(super) fn member_call(text: &str) -> Result<MemberCall, String> {
	let frame: Value = serde_json::from_str(text).unwrap_or(Value::Null);
	let id = frame.get("id").filter(|id| id.is_string() || id.is_number()).cloned();
	let command = frame
		.get("command")
		.and_then(Value::as_str)
		.filter(|command| names_an_app_command(command));
	let args = match frame.get("args") {
		None => Some(Value::Object(Map::new())),
		Some(args) => Some(args.clone()).filter(Value::is_object),
	};
	match (id, command, args) {
		(Some(id), Some(command), Some(args)) if belongs_to_the_host(command, &args) => {
			Err(answer(id, StatusCode::FORBIDDEN, json!({ "error": HOST_ONLY_REFUSAL })))
		}
		(Some(id), Some(command), Some(args)) => {
			Ok(MemberCall { id, command: command.to_owned(), args })
		}
		(id, _, _) => Err(refused(id)),
	}
}

pub(super) fn shared_space_answer(text: &str, shared_space_id: &str) -> Option<String> {
	let frame: Value = serde_json::from_str(text).ok()?;
	if frame.get("command").and_then(Value::as_str) != Some(SHARED_SPACE_COMMAND) {
		return None;
	}
	let id = frame.get("id").filter(|id| id.is_string() || id.is_number())?.clone();
	Some(answer(id, StatusCode::OK, json!({ "spaceId": shared_space_id })))
}

pub(super) fn belongs_to_the_host(command: &str, args: &Value) -> bool {
	matches!(reach::reach_of(command), None | Some(Reach::HostOnly))
		|| (command.starts_with("plugin_") && args["scope"]["kind"] == "user")
}

pub(super) fn refused(id: Option<Value>) -> String {
	answer(
		id.unwrap_or(Value::Null),
		StatusCode::BAD_REQUEST,
		json!({ "error": "a member frame is {\"id\", \"command\", \"args\"}" }),
	)
}

pub(super) fn forwarded(frame: &str) -> String {
	format!("{{\"event\":{frame}}}")
}

pub(super) async fn bridged<R: Runtime>(
	app: AppHandle<R>,
	local: LocalApi,
	shared_space_id: String,
	call: MemberCall,
) -> String {
	if !reach::stays_in_the_shared_space(&app, &shared_space_id, &call.command, &call.args).await {
		return answer(call.id, StatusCode::FORBIDDEN, json!({ "error": OTHER_SPACE_REFUSAL }));
	}
	match invoked(&local, &call).await {
		Ok((status, body)) => answer(call.id, status, body),
		Err(reason) => answer(call.id, StatusCode::BAD_GATEWAY, json!({ "error": reason })),
	}
}

async fn invoked(local: &LocalApi, call: &MemberCall) -> Result<(StatusCode, Value), String> {
	let answered = local
		.client
		.post(format!("{}/api/invoke/{}", local.origin, call.command))
		.bearer_auth(&local.token)
		.json(&call.args)
		.send()
		.await
		.map_err(|error| {
			format!("the local host api could not be reached: {}", error.without_url())
		})?;
	let status = answered.status();
	let body = answered
		.bytes()
		.await
		.map_err(|error| format!("the local host api answer was cut: {}", error.without_url()))?;
	Ok((status, body_of(&body)))
}

fn body_of(body: &[u8]) -> Value {
	if body.is_empty() {
		return Value::Null;
	}
	serde_json::from_slice(body)
		.unwrap_or_else(|_| Value::String(String::from_utf8_lossy(body).into_owned()))
}

fn answer(id: Value, status: StatusCode, body: Value) -> String {
	json!({ "id": id, "status": status.as_u16(), "body": body }).to_string()
}

#[cfg(test)]
mod tests {
	use std::path::Path;

	use super::*;

	fn status_of(answer: &str) -> (Value, Value) {
		let answer: Value = serde_json::from_str(answer).expect("a json answer");
		(answer["id"].clone(), answer["status"].clone())
	}

	#[test]
	fn a_call_without_args_invokes_with_none() {
		assert_eq!(
			member_call(r#"{"id": 3, "command": "agent_models"}"#),
			Ok(MemberCall { id: json!(3), command: "agent_models".to_owned(), args: json!({}) })
		);
	}

	#[test]
	fn the_shared_space_frame_is_answered_with_the_shared_space_and_others_are_left_alone() {
		assert_eq!(
			shared_space_answer(r#"{"id": 4, "command": "relay_shared_space"}"#, "s1")
				.map(|answer| serde_json::from_str::<Value>(&answer).expect("a json answer")),
			Some(json!({ "id": 4, "status": 200, "body": { "spaceId": "s1" } }))
		);
		assert_eq!(shared_space_answer(r#"{"id": 4, "command": "space_list"}"#, "s1"), None);
		assert_eq!(shared_space_answer(r#"{"command": "relay_shared_space"}"#, "s1"), None);
		assert_eq!(shared_space_answer("not json", "s1"), None);
	}

	#[test]
	fn a_frame_of_another_shape_is_refused_with_the_id_it_carried() {
		for (frame, id) in [
			("not json", Value::Null),
			(r#"{"command": "space_list"}"#, Value::Null),
			(r#"{"id": {}, "command": "space_list"}"#, Value::Null),
			(r#"{"id": "a", "command": "../events"}"#, json!("a")),
			(r#"{"id": "b", "command": "space_list", "args": [1]}"#, json!("b")),
			(r#"{"id": 9}"#, json!(9)),
		] {
			let refusal = member_call(frame).expect_err(frame);
			assert_eq!(status_of(&refusal), (id, json!(400)), "{frame}");
		}
	}

	#[test]
	fn a_member_command_of_the_host_or_one_left_unclassified_is_refused_with_403() {
		let host_only = reach::REACHES
			.iter()
			.filter(|(_, reach)| *reach == Reach::HostOnly)
			.map(|(command, _)| *command);
		for command in host_only.chain(["a_command_nobody_classified"]) {
			let frame = json!({ "id": "m", "command": command, "args": { "spaceId": "s" } });
			let refusal = member_call(&frame.to_string()).expect_err(command);
			assert_eq!(
				serde_json::from_str::<Value>(&refusal).expect("a json answer"),
				json!({ "id": "m", "status": 403, "body": { "error": HOST_ONLY_REFUSAL } }),
				"{command}"
			);
		}
	}

	fn registered_commands() -> Vec<String> {
		let bindings =
			std::env::temp_dir().join(format!("kiroshi-host-only-{}.ts", uuid::Uuid::new_v4()));
		crate::commands::builder()
			.dangerously_cast_bigints_to_number()
			.export(specta_typescript::Typescript::default(), &bindings)
			.expect("the command surface exports");
		let surface = std::fs::read_to_string(&bindings).expect("the bindings read back");
		std::fs::remove_file(&bindings).expect("the bindings are cleaned up");
		surface
			.split("__TAURI_INVOKE")
			.skip(1)
			.filter_map(|invoked| invoked.split("(\"").nth(1)?.split('"').next())
			.map(str::to_owned)
			.collect()
	}

	#[test]
	fn the_reach_table_classifies_every_registered_command_once_and_nothing_else() {
		let mut registered = registered_commands();
		let mut classified: Vec<String> =
			reach::REACHES.iter().map(|(command, _)| (*command).to_owned()).collect();
		registered.sort();
		classified.sort();

		assert_eq!(classified, registered);
	}

	fn declared_event_name(line: &str) -> Option<&str> {
		let (declared, value) =
			line.trim_start_matches("pub ").strip_prefix("const ")?.split_once(": &str = \"")?;
		let is_an_event = declared.ends_with("_EVENT") || declared.ends_with("_CHANNEL");
		let name = value.strip_suffix("\";")?;
		(is_an_event && !name.contains(char::is_whitespace)).then_some(name)
	}

	#[test]
	fn the_audience_table_classifies_every_published_event_once_and_nothing_else() {
		let sources =
			crate::events::tests::rust_files(&Path::new(env!("CARGO_MANIFEST_DIR")).join("src"));
		let mut published: Vec<String> = sources
			.iter()
			.flat_map(|path| {
				let source = std::fs::read_to_string(path).expect("the file reads");
				source
					.lines()
					.filter_map(|line| declared_event_name(line.trim()))
					.map(str::to_owned)
					.collect::<Vec<_>>()
			})
			.collect();
		let mut classified: Vec<String> =
			reach::AUDIENCES.iter().map(|(event, _)| (*event).to_owned()).collect();
		published.sort();
		classified.sort();

		assert_eq!(classified, published);
	}

	#[test]
	fn an_event_name_is_read_from_its_constant_only() {
		assert_eq!(
			declared_event_name(r#"pub const CHANGED_EVENT: &str = "a://b";"#),
			Some("a://b")
		);
		assert_eq!(declared_event_name(r#"const EVENT_CHANNEL: &str = "a://c";"#), Some("a://c"));
		assert_eq!(declared_event_name(r#"const INSERT_EVENT: &str = "INSERT INTO x"#), None);
		assert_eq!(declared_event_name(r#"const LINK: &str = "a://d";"#), None);
	}

	#[test]
	fn a_plugin_command_on_the_host_person_plugin_is_refused_and_on_a_space_or_bot_forwarded() {
		let plugin_commands: Vec<String> = registered_commands()
			.into_iter()
			.filter(|command| command.starts_with("plugin_"))
			.collect();
		assert!(!plugin_commands.is_empty());

		for command in &plugin_commands {
			let person =
				json!({ "id": "m", "command": command, "args": { "scope": { "kind": "user" } } });
			let refusal = member_call(&person.to_string()).expect_err(command);
			assert_eq!(status_of(&refusal), (json!("m"), json!(403)), "{command}");
			for scope in
				[json!({ "kind": "space", "id": "s" }), json!({ "kind": "bot", "id": "b" })]
			{
				let frame = json!({ "id": "m", "command": command, "args": { "scope": scope } });
				assert!(member_call(&frame.to_string()).is_ok(), "{command} {scope}");
			}
		}
	}

	#[test]
	fn an_event_is_wrapped_untouched() {
		assert_eq!(
			forwarded(r#"{"event":"a://b","payload":1}"#),
			r#"{"event":{"event":"a://b","payload":1}}"#
		);
	}

	#[test]
	fn a_body_that_is_not_json_crosses_as_its_text() {
		assert_eq!(body_of(b"no command bears this name"), json!("no command bears this name"));
		assert_eq!(body_of(b""), Value::Null);
		assert_eq!(body_of(br#"{"a":1}"#), json!({ "a": 1 }));
	}
}
