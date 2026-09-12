
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use super::contract::{Account, AgentCommand};
use crate::environment::contract::{ResolvedEnv, Values};

fn null_as_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
	D: Deserializer<'de>,
	T: Default + Deserialize<'de>,
{
	Ok(Option::<T>::deserialize(deserializer)?.unwrap_or_default())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ready {
	pub provider: String,
	pub version: String,
	#[serde(default)]
	pub sdk_version: Option<String>,
	#[serde(default)]
	pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Envelope {
	pub session: String,
	pub frame: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
	pub cwd: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub resume: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub plugin_path: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub system_plugin_path: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub user_plugin_path: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub space_plugin_path: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub agent: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub identity: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub output_style: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub settings_path: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub app_data_dir: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub conversation_id: Option<String>,
	pub partial_messages: bool,
	#[serde(skip_serializing_if = "std::collections::BTreeMap::is_empty")]
	pub env: std::collections::BTreeMap<String, String>,
	#[serde(skip_serializing_if = "ResolvedEnv::is_untouched")]
	pub server_env: ResolvedEnv,
	#[serde(skip_serializing_if = "std::collections::BTreeMap::is_empty")]
	pub connection: Values,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub output_schema: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Frame {
	Opened,
	Closed(ClosedFrame),
	System(SystemFrame),
	StreamEvent(StreamEventFrame),
	Assistant(MessageFrame),
	User(MessageFrame),
	Result(ResultFrame),
	Commands(CommandsFrame),
	ControlRequest(ControlRequestFrame),
	HostRequest(HostRequestFrame),
	ControlResponse(ControlResponseFrame),
	SettingsRejected(RejectionFrame),
	ServerEnvRejected(RejectionFrame),
	#[serde(other)]
	Ignored,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClosedFrame {
	#[serde(default)]
	pub detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RejectionFrame {
	#[serde(default)]
	pub detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SystemFrame {
	#[serde(default)]
	pub subtype: Option<String>,
	#[serde(default)]
	pub session_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CommandsFrame {
	#[serde(default, deserialize_with = "null_as_default")]
	pub commands: Vec<AgentCommand>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamEventFrame {
	#[serde(default)]
	pub event: Option<StreamEvent>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
	MessageStart {
		#[serde(default)]
		message: Option<StreamMessageHeader>,
	},
	ContentBlockStart {
		#[serde(default)]
		content_block: Option<ContentBlock>,
	},
	ContentBlockDelta {
		#[serde(default)]
		delta: Option<ContentDelta>,
	},
	#[serde(other)]
	Ignored,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamMessageHeader {
	#[serde(default)]
	pub id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentDelta {
	TextDelta {
		#[serde(default, deserialize_with = "null_as_default")]
		text: String,
	},
	#[serde(other)]
	Ignored,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageFrame {
	#[serde(default)]
	pub message: Option<MessageBody>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageBody {
	#[serde(default)]
	pub id: Option<String>,
	#[serde(default, deserialize_with = "null_as_default")]
	pub content: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
	Text {
		#[serde(default, deserialize_with = "null_as_default")]
		text: String,
	},
	ToolUse {
		id: String,
		name: String,
		#[serde(default)]
		input: Value,
	},
	ToolResult {
		tool_use_id: String,
		#[serde(default, deserialize_with = "null_as_default")]
		is_error: bool,
	},
	#[serde(other)]
	Ignored,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResultFrame {
	#[serde(default)]
	pub subtype: Option<String>,
	#[serde(default)]
	pub session_id: Option<String>,
	#[serde(default, deserialize_with = "null_as_default")]
	pub is_error: bool,
	#[serde(default)]
	pub structured_output: Option<Value>,
	#[serde(default)]
	pub total_cost_usd: Option<f64>,
	#[serde(default, rename = "modelUsage")]
	pub model_usage: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ControlRequestFrame {
	pub request_id: String,
	pub request: ControlRequestBody,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "subtype", rename_all = "snake_case")]
pub enum ControlRequestBody {
	CanUseTool {
		tool_name: String,
		#[serde(default)]
		display_name: Option<String>,
		#[serde(default)]
		description: Option<String>,
		#[serde(default)]
		input: Value,
	},
	#[serde(other)]
	Ignored,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRequestFrame {
	pub request_id: String,
	pub request: Value,
}

pub type HostAnswer = Result<Value, Value>;

#[derive(Debug, Clone, Deserialize)]
pub struct ControlResponseFrame {
	pub response: ControlResponseBody,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ControlResponseBody {
	#[serde(default)]
	pub subtype: Option<String>,
	#[serde(default)]
	pub request_id: Option<String>,
	#[serde(default)]
	pub error: Option<String>,
}

fn command(kind: &str, session: &str, body: Value) -> Value {
	let mut frame = serde_json::json!({ "type": kind, "session": session });
	if let (Some(frame), Some(body)) = (frame.as_object_mut(), body.as_object()) {
		frame.extend(body.clone());
	}
	frame
}

pub fn open_command(session: &str, request: &OpenRequest) -> Value {
	command(
		"open",
		session,
		serde_json::to_value(request).unwrap_or_else(|_| serde_json::json!({})),
	)
}

pub fn prompt_command(session: &str, text: &str) -> Value {
	command("prompt", session, serde_json::json!({ "text": text }))
}

pub fn interrupt_command(session: &str) -> Value {
	command("interrupt", session, Value::Null)
}

pub fn close_command(session: &str) -> Value {
	command("close", session, Value::Null)
}

pub fn allow_command(session: &str, request_id: &str, input: &Value) -> Value {
	command(
		"permission",
		session,
		serde_json::json!({
			"requestId": request_id,
			"decision": { "behavior": "allow", "updatedInput": input }
		}),
	)
}

pub fn deny_command(session: &str, request_id: &str, message: &str) -> Value {
	command(
		"permission",
		session,
		serde_json::json!({
			"requestId": request_id,
			"decision": { "behavior": "deny", "message": message }
		}),
	)
}

pub fn host_response_command(session: &str, request_id: &str, answer: &HostAnswer) -> Value {
	let body = match answer {
		Ok(result) => serde_json::json!({ "requestId": request_id, "result": result }),
		Err(error) => serde_json::json!({ "requestId": request_id, "error": error }),
	};
	command("host_response", session, body)
}

pub const CHECK: &str = "check";
pub const MODELS: &str = "models";
pub const TOOLS: &str = "tools";
pub const TITLE: &str = "title";
pub const SIGN_IN: &str = "sign_in";
pub const SIGN_IN_STARTED: &str = "sign_in_started";
pub const SIGN_IN_CODE: &str = "sign_in_code";
pub const SIGN_IN_CANCEL: &str = "sign_in_cancel";

pub fn sign_in_code_command(text: &str) -> Value {
	serde_json::json!({ "type": SIGN_IN_CODE, "text": text })
}

pub fn sign_in_cancel_command() -> Value {
	serde_json::json!({ "type": SIGN_IN_CANCEL })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignInFailureKind {
	Busy,
	Cancelled,
	TimedOut,
	#[serde(other)]
	Failed,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInFailure {
	pub kind: SignInFailureKind,
	#[serde(default)]
	pub detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedIn {
	#[serde(default, deserialize_with = "null_as_default")]
	pub signed_in: bool,
	#[serde(default)]
	pub error: Option<SignInFailure>,
}

pub fn ask_command(kind: &str, connection: &Values) -> Value {
	serde_json::json!({ "type": kind, "connection": connection })
}

pub fn title_command(text: &str, connection: &Values) -> Value {
	serde_json::json!({ "type": TITLE, "text": text, "connection": connection })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checked {
	#[serde(default, deserialize_with = "null_as_default")]
	pub authenticated: bool,
	#[serde(default)]
	pub detail: Option<String>,
	#[serde(default)]
	pub account: Option<Account>,
	#[serde(default)]
	pub auth_method: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalogue {
	#[serde(default, deserialize_with = "null_as_default")]
	pub models: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCatalogue {
	#[serde(default, deserialize_with = "null_as_default")]
	pub tools: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Titled {
	#[serde(default)]
	pub title: Option<String>,
}

pub const OAUTH_AUTHORIZE: &str = "mcp_oauth_authorize";
pub const OAUTH_STARTED: &str = "oauth_started";
pub const OAUTH_CANCEL: &str = "mcp_oauth_cancel";
pub const OAUTH_REVOKE: &str = "mcp_oauth_revoke";
pub const OAUTH_REFRESH: &str = "mcp_oauth_refresh";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevocationRequest {
	pub url: String,
	pub token: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub refresh_token: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub client_id: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub client_secret: Option<String>,
}

pub fn oauth_authorize_command(url: &str) -> Value {
	serde_json::json!({ "type": OAUTH_AUTHORIZE, "url": url })
}

pub fn oauth_cancel_command() -> Value {
	serde_json::json!({ "type": OAUTH_CANCEL })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequest {
	pub url: String,
	pub refresh_token: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub client_id: Option<String>,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub client_secret: Option<String>,
}

pub fn oauth_revoke_command(request: &RevocationRequest) -> Value {
	command_carrying(OAUTH_REVOKE, request)
}

pub fn oauth_refresh_command(request: &RefreshRequest) -> Value {
	command_carrying(OAUTH_REFRESH, request)
}

fn command_carrying(kind: &str, request: &impl Serialize) -> Value {
	let mut frame = serde_json::json!({ "type": kind });
	if let (Some(frame), Ok(Value::Object(body))) =
		(frame.as_object_mut(), serde_json::to_value(request))
	{
		frame.extend(body);
	}
	frame
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthStarted {
	pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OauthFailureKind {
	Busy,
	Cancelled,
	TimedOut,
	Denied,
	Rejected,
	#[serde(other)]
	Failed,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthFailure {
	pub kind: OauthFailureKind,
	#[serde(default)]
	pub detail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthCredentials {
	pub access_token: String,
	#[serde(default)]
	pub refresh_token: Option<String>,
	#[serde(default)]
	pub expires_at: Option<i64>,
	pub client_id: String,
	#[serde(default)]
	pub client_secret: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Authorized {
	#[serde(default)]
	pub credentials: Option<OauthCredentials>,
	#[serde(default)]
	pub error: Option<OauthFailure>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Revoked {
	#[serde(default, deserialize_with = "null_as_default")]
	pub revoked: bool,
	#[serde(default)]
	pub detail: Option<String>,
}
