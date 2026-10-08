use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

use crate::db::repositories::space_children::SpaceChild::{
	self, Bot, BotHeldAlone, Conversation, Message, Mission, Routine, RoutineRun, Section, Turn,
};
use crate::db::{DatabaseError, DatabaseState};

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) enum Reach {
	HostOnly,
	Free,
	Scoped(&'static [Held]),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct Held {
	argument: &'static str,
	check: Check,
	is_optional: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Check {
	Space,
	Child(SpaceChild),
	PluginScope(SpaceChild),
	NotAllSpaces,
}

const fn space(argument: &'static str) -> Held {
	Held { argument, check: Check::Space, is_optional: false }
}

const fn child(kind: SpaceChild, argument: &'static str) -> Held {
	Held { argument, check: Check::Child(kind), is_optional: false }
}

const fn optional_child(kind: SpaceChild, argument: &'static str) -> Held {
	Held { argument, check: Check::Child(kind), is_optional: true }
}

const SPACE_ID: &[Held] = &[space("/spaceId")];
const SPACE_FILTER: &[Held] = &[
	space("/spaceId"),
	Held { argument: "/allSpaces", check: Check::NotAllSpaces, is_optional: false },
];
const PLUGIN_SCOPE: &[Held] =
	&[Held { argument: "/scope", check: Check::PluginScope(Bot), is_optional: false }];
const PLUGIN_WRITE_SCOPE: &[Held] =
	&[Held { argument: "/scope", check: Check::PluginScope(BotHeldAlone), is_optional: false }];
const CONVERSATION_ID: &[Held] = &[child(Conversation, "/conversationId")];
const CONVERSATION_AND_BOT: &[Held] =
	&[child(Conversation, "/conversationId"), child(Bot, "/botId")];
const CONVERSATION_AND_MESSAGE: &[Held] =
	&[child(Conversation, "/conversationId"), child(Message, "/messageId")];
const RUNTIME_SCOPE: &[Held] =
	&[child(Conversation, "/scope/conversationId"), child(Bot, "/scope/botId")];
const NEW_MESSAGE: &[Held] = &[
	child(Conversation, "/message/conversationId"),
	child(Turn, "/message/turnId"),
	optional_child(Bot, "/message/authorBotId"),
	optional_child(Message, "/message/repliedToMessageId"),
];
const BOT_ID: &[Held] = &[child(Bot, "/botId")];
const BOT_WRITE_AS_ID: &[Held] = &[child(BotHeldAlone, "/id")];
const BOT_AND_SPACE: &[Held] = &[child(Bot, "/botId"), space("/spaceId")];
const MESSAGE_AS_ID: &[Held] = &[child(Message, "/id")];
const MISSION_ID: &[Held] = &[child(Mission, "/missionId")];
const ROUTINE_AS_ID: &[Held] = &[child(Routine, "/id")];
const ROUTINE_RUN_ID: &[Held] = &[child(RoutineRun, "/runId")];
const SECTION_AS_ID: &[Held] = &[child(Section, "/id")];

pub(super) const REACHES: &[(&str, Reach)] = &[
	("account_state", Reach::Free),
	("account_sign_in", Reach::HostOnly),
	("account_sign_out", Reach::HostOnly),
	("application_catalogue", Reach::Free),
	("application_search", Reach::Free),
	("application_named", Reach::Free),
	("application_installs", Reach::Scoped(CONVERSATION_ID)),
	("application_runnable", Reach::Free),
	("chat_store_attachments", Reach::Scoped(CONVERSATION_ID)),
	(
		"agent_check",
		Reach::Scoped(&[
			optional_child(Conversation, "/scope/conversationId"),
			optional_child(Bot, "/scope/botId"),
		]),
	),
	("agent_sign_in", Reach::HostOnly),
	("agent_sign_in_code", Reach::HostOnly),
	("agent_sign_in_cancel", Reach::HostOnly),
	("agent_models", Reach::Free),
	("agent_tools", Reach::Free),
	("agent_title", Reach::Free),
	("agent_start_or_resume_session", Reach::Scoped(RUNTIME_SCOPE)),
	(
		"agent_submit_prompt",
		Reach::Scoped(&[
			child(Conversation, "/scope/conversationId"),
			child(Bot, "/scope/botId"),
			optional_child(Turn, "/turn/turnId"),
		]),
	),
	("agent_cancel_turn", Reach::Scoped(RUNTIME_SCOPE)),
	("agent_respond_to_permission", Reach::Scoped(RUNTIME_SCOPE)),
	("agent_answer_question", Reach::Scoped(RUNTIME_SCOPE)),
	("agent_shutdown", Reach::HostOnly),
	("agent_live_sessions", Reach::HostOnly),
	("conversation_bots", Reach::Scoped(SPACE_ID)),
	(
		"conversation_bots_by_presence",
		Reach::Scoped(&[
			space("/spaceId"),
			optional_child(Conversation, "/excludedConversationId"),
		]),
	),
	("conversation_create_bot", Reach::Scoped(SPACE_ID)),
	("conversation_create_bot_from_draft", Reach::Scoped(SPACE_ID)),
	("conversation_suggested_bots", Reach::Free),
	("companion_launch_outcome", Reach::Free),
	("window_declare_maximize_button", Reach::HostOnly),
	("conversation_duplicate_bot", Reach::Scoped(BOT_AND_SPACE)),
	("conversation_update_bot", Reach::Scoped(BOT_WRITE_AS_ID)),
	("conversation_delete_bot", Reach::Scoped(BOT_WRITE_AS_ID)),
	("conversation_set_bot_avatar_image", Reach::Scoped(BOT_WRITE_AS_ID)),
	("conversation_set_bot_memory", Reach::Scoped(BOT_WRITE_AS_ID)),
	("conversation_record_bot_commands", Reach::Scoped(&[child(BotHeldAlone, "/botId")])),
	("conversation_bot_commands", Reach::Scoped(BOT_ID)),
	("conversation_main_chat", Reach::Scoped(BOT_AND_SPACE)),
	(
		"conversation_create",
		Reach::Scoped(&[
			space("/spaceId"),
			optional_child(Section, "/sectionId"),
			child(Bot, "/botIds"),
		]),
	),
	("conversation_list", Reach::Scoped(SPACE_ID)),
	(
		"conversation_update",
		Reach::Scoped(&[
			child(Conversation, "/conversationId"),
			optional_child(Section, "/sectionId"),
		]),
	),
	("conversation_delete", Reach::Scoped(CONVERSATION_ID)),
	(
		"conversation_add_participant",
		Reach::Scoped(&[
			child(Conversation, "/conversationId"),
			child(Bot, "/botId"),
			optional_child(Bot, "/invitedByBotId"),
		]),
	),
	("conversation_remove_participant", Reach::Scoped(CONVERSATION_AND_BOT)),
	("conversation_set_lead", Reach::Scoped(CONVERSATION_AND_BOT)),
	("conversation_open_runtime_session", Reach::Scoped(CONVERSATION_AND_BOT)),
	("conversation_record_provider_session", Reach::Scoped(CONVERSATION_AND_BOT)),
	(
		"conversation_bounded_context",
		Reach::Scoped(&[
			child(Conversation, "/conversationId"),
			child(Bot, "/botId"),
			child(Message, "/promptMessageId"),
		]),
	),
	("conversation_roster_block", Reach::Scoped(CONVERSATION_AND_BOT)),
	("conversation_capture_checkpoint", Reach::Scoped(CONVERSATION_AND_BOT)),
	("conversation_message_page", Reach::Scoped(CONVERSATION_ID)),
	("conversation_message_page_around", Reach::Scoped(CONVERSATION_ID)),
	("conversation_message_reference", Reach::Scoped(CONVERSATION_AND_MESSAGE)),
	("conversation_pin_message", Reach::Scoped(CONVERSATION_AND_MESSAGE)),
	("conversation_unpin_message", Reach::Scoped(CONVERSATION_AND_MESSAGE)),
	("conversation_pinned_messages", Reach::Scoped(CONVERSATION_ID)),
	("conversation_start_turn", Reach::Scoped(&[child(Conversation, "/turn/conversationId")])),
	("conversation_complete_turn", Reach::Scoped(&[child(Turn, "/id")])),
	("conversation_append_user_message", Reach::Scoped(NEW_MESSAGE)),
	("conversation_send_user_message", Reach::Scoped(NEW_MESSAGE)),
	("conversation_open_assistant_message", Reach::Scoped(NEW_MESSAGE)),
	("conversation_append_text", Reach::Scoped(MESSAGE_AS_ID)),
	("conversation_finalize_message", Reach::Scoped(MESSAGE_AS_ID)),
	("env_set", Reach::HostOnly),
	("env_delete", Reach::HostOnly),
	("env_list", Reach::HostOnly),
	("connection_set", Reach::HostOnly),
	("host_share_link", Reach::HostOnly),
	("hosting_start", Reach::HostOnly),
	("hosting_stop", Reach::HostOnly),
	("hosting_state", Reach::Scoped(SPACE_ID)),
	("hosting_members", Reach::HostOnly),
	("hosting_invite_member", Reach::HostOnly),
	("hosting_withdraw_invitation", Reach::HostOnly),
	("hosting_remove_member", Reach::HostOnly),
	("joined_spaces_list", Reach::HostOnly),
	("joined_space_add", Reach::HostOnly),
	("joined_space_connect", Reach::HostOnly),
	("joined_space_remove", Reach::HostOnly),
	("mcp_oauth_connect", Reach::HostOnly),
	("mcp_oauth_cancel", Reach::HostOnly),
	("mcp_oauth_disconnect", Reach::HostOnly),
	("mcp_application_status", Reach::HostOnly),
	("mission_close", Reach::Scoped(MISSION_ID)),
	("mission_reopen", Reach::Scoped(MISSION_ID)),
	("mission_list", Reach::Scoped(CONVERSATION_ID)),
	("mission_detail", Reach::Scoped(MISSION_ID)),
	("mission_board", Reach::HostOnly),
	("mission_space_feed", Reach::Scoped(SPACE_ID)),
	("mission_unreported", Reach::HostOnly),
	("mission_reported", Reach::Scoped(&[child(Mission, "/missionId"), child(Turn, "/turnId")])),
	("mission_answered", Reach::Scoped(MISSION_ID)),
	("notification_show", Reach::HostOnly),
	("plugin_skills", Reach::Scoped(PLUGIN_SCOPE)),
	("plugin_create_skill", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_update_skill", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_set_skill_preloaded", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_delete_skill", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_skill_file", Reach::Scoped(PLUGIN_SCOPE)),
	("plugin_write_skill_file", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_delete_skill_file", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_mcp_servers", Reach::Scoped(PLUGIN_SCOPE)),
	("plugin_set_mcp_server", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_delete_mcp_server", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("plugin_history", Reach::Scoped(PLUGIN_SCOPE)),
	("plugin_history_diff", Reach::Scoped(PLUGIN_SCOPE)),
	("plugin_revert", Reach::Scoped(PLUGIN_WRITE_SCOPE)),
	("routine_trigger_sources", Reach::Scoped(BOT_ID)),
	(
		"routine_create",
		Reach::Scoped(&[child(Conversation, "/draft/conversationId"), child(Bot, "/draft/botId")]),
	),
	("routine_update", Reach::Scoped(ROUTINE_AS_ID)),
	("routine_delete", Reach::Scoped(ROUTINE_AS_ID)),
	("routine_list", Reach::Scoped(CONVERSATION_ID)),
	("routine_runs", Reach::Scoped(&[child(Routine, "/routineId")])),
	("routine_reported_runs", Reach::Scoped(CONVERSATION_ID)),
	("routine_run_now", Reach::Scoped(ROUTINE_AS_ID)),
	("routine_renew_lease", Reach::Scoped(ROUTINE_RUN_ID)),
	("routine_close_run", Reach::Scoped(ROUTINE_RUN_ID)),
	("routine_key", Reach::Scoped(ROUTINE_AS_ID)),
	("search_catalogue", Reach::Scoped(SPACE_FILTER)),
	("search_messages", Reach::HostOnly),
	("search_recent", Reach::Scoped(SPACE_FILTER)),
	("section_list", Reach::Scoped(SPACE_ID)),
	("section_create", Reach::Scoped(SPACE_ID)),
	("section_rename", Reach::Scoped(SECTION_AS_ID)),
	("roster_pin", Reach::Scoped(SPACE_ID)),
	("section_delete", Reach::Scoped(SECTION_AS_ID)),
	(
		"bot_move_to_section",
		Reach::Scoped(&[
			child(Bot, "/botId"),
			optional_child(Section, "/sectionId"),
			space("/spaceId"),
		]),
	),
	("space_list", Reach::HostOnly),
	("space_create", Reach::HostOnly),
	("space_update", Reach::Scoped(&[space("/id")])),
	("space_reorder", Reach::HostOnly),
	("space_delete", Reach::HostOnly),
	("space_export", Reach::HostOnly),
	("space_import", Reach::HostOnly),
	("bot_move_to_space", Reach::Scoped(&[child(BotHeldAlone, "/botId"), space("/spaceId")])),
	(
		"bot_add_to_space",
		Reach::Scoped(&[
			child(Bot, "/botId"),
			space("/spaceId"),
			optional_child(Section, "/sectionId"),
		]),
	),
	("bot_remove_from_space", Reach::Scoped(BOT_AND_SPACE)),
	("space_preferences", Reach::Scoped(SPACE_ID)),
	("space_set_preferences", Reach::Scoped(SPACE_ID)),
	("user_preferences", Reach::Free),
	("user_set_preferences", Reach::HostOnly),
	("user_set_profile_picture", Reach::HostOnly),
];

pub(super) fn reach_of(command: &str) -> Option<Reach> {
	REACHES.iter().find(|(name, _)| *name == command).map(|(_, reach)| *reach)
}

pub(super) async fn stays_in_the_shared_space<R: Runtime>(
	app: &AppHandle<R>,
	shared_space_id: &str,
	command: &str,
	args: &Value,
) -> bool {
	let helds = match reach_of(command) {
		Some(Reach::Scoped(helds)) => helds,
		Some(Reach::Free) => return true,
		Some(Reach::HostOnly) | None => return false,
	};
	let lookup = Lookup { app, shared_space_id, command };
	for held in helds {
		if !lookup.holds(held, args.pointer(held.argument)).await {
			return false;
		}
	}
	true
}

struct Lookup<'a, R: Runtime> {
	app: &'a AppHandle<R>,
	shared_space_id: &'a str,
	command: &'a str,
}

impl<R: Runtime> Lookup<'_, R> {
	async fn holds(&self, held: &Held, value: Option<&Value>) -> bool {
		match (held.check, value) {
			(_, None | Some(Value::Null)) => held.is_optional,
			(Check::NotAllSpaces, Some(all_spaces)) => all_spaces == &Value::Bool(false),
			(Check::Space, Some(Value::String(space_id))) => space_id == self.shared_space_id,
			(Check::Child(kind), Some(Value::String(child_id))) => {
				self.holds_child(kind, child_id).await
			}
			(Check::Child(kind), Some(Value::Array(child_ids))) => {
				for child_id in child_ids {
					let Some(child_id) = child_id.as_str() else { return false };
					if !self.holds_child(kind, child_id).await {
						return false;
					}
				}
				true
			}
			(Check::PluginScope(bot_kind), Some(scope)) => {
				match (scope["kind"].as_str(), scope["id"].as_str()) {
					(Some("space"), Some(space_id)) => space_id == self.shared_space_id,
					(Some("bot"), Some(bot_id)) => self.holds_child(bot_kind, bot_id).await,
					_ => false,
				}
			}
			_ => false,
		}
	}

	async fn holds_child(&self, kind: SpaceChild, child_id: &str) -> bool {
		let state = self.app.state::<DatabaseState>();
		let database = match state.as_ref() {
			Ok(database) => database,
			Err(failure) => return self.refused_on_failure(kind, failure),
		};
		let shared_space_id = self.shared_space_id.to_owned();
		match database.space_children().holds(shared_space_id, kind, child_id.to_owned()).await {
			Ok(is_held) => is_held,
			Err(failure) => self.refused_on_failure(kind, &failure),
		}
	}

	fn refused_on_failure(&self, kind: SpaceChild, failure: &DatabaseError) -> bool {
		eprintln!(
			"a relayed {} call was refused: the {kind:?} lookup in shared space {} failed: {failure:?}",
			self.command, self.shared_space_id
		);
		false
	}
}
