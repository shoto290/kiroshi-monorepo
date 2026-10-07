use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde_json::{json, Map, Value};

use crate::host_api::invoke::names_an_app_command;
use crate::missions::github::installed_tls_provider;

const INVOKE_BOUND: Duration = Duration::from_secs(300);

const HOST_ONLY_COMMANDS: [&str; 4] = [
	"hosting_members",
	"hosting_invite_member",
	"hosting_withdraw_invitation",
	"hosting_remove_member",
];

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
		(Some(id), Some(command), Some(_)) if HOST_ONLY_COMMANDS.contains(&command) => Err(answer(
			id,
			StatusCode::FORBIDDEN,
			json!({ "error": "this command belongs to the host" }),
		)),
		(Some(id), Some(command), Some(args)) => {
			Ok(MemberCall { id, command: command.to_owned(), args })
		}
		(id, _, _) => Err(refused(id)),
	}
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

pub(super) async fn bridged(local: LocalApi, call: MemberCall) -> String {
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
	use super::*;

	fn status_of(answer: &str) -> (Value, Value) {
		let answer: Value = serde_json::from_str(answer).expect("a json answer");
		(answer["id"].clone(), answer["status"].clone())
	}

	#[test]
	fn a_call_without_args_invokes_with_none() {
		assert_eq!(
			member_call(r#"{"id": 3, "command": "space_list"}"#),
			Ok(MemberCall { id: json!(3), command: "space_list".to_owned(), args: json!({}) })
		);
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
	fn a_member_command_of_the_host_is_refused_with_403() {
		for command in HOST_ONLY_COMMANDS {
			let frame = json!({ "id": "m", "command": command, "args": { "spaceId": "s" } });
			let refusal = member_call(&frame.to_string()).expect_err(command);
			assert_eq!(status_of(&refusal), (json!("m"), json!(403)), "{command}");
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
