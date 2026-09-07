use std::collections::HashMap;

use rusqlite::{Connection, Row};
use serde_json::Value;
use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

use super::missions::{mission, MISSION_COLUMNS};
use crate::db::{Access, DatabaseError};
use crate::missions::contract::Mission;
use crate::search::contract::{
	Catalogue, CatalogueChat, CatalogueError, CatalogueMission, CatalogueRoutine, CatalogueScope,
	ChatKind, MAX_MATCHES_PER_LIST, MAX_QUERY_LENGTH, MAX_RECENT_CHATS,
};

const PRESENT_SEAT: &str = "conversation_participants.left_at IS NULL AND bots.deleted_at IS NULL";

const CHAT_ORDER: &str = "ORDER BY spoken_at DESC, id";

const RECENT_CHATS_OF_SPACE: &str = "WHERE kind <> 'mission' AND space_id = ?1";

fn chats() -> String {
	format!(
		"WITH chat AS (
	SELECT conversations.id AS id, conversations.kind AS kind, conversations.title AS title,
		COALESCE(conversations.space_id, (SELECT bots.space_id FROM conversation_participants
			JOIN bots ON bots.id = conversation_participants.bot_id
			WHERE conversation_participants.conversation_id = conversations.id AND {PRESENT_SEAT}
			ORDER BY conversation_participants.join_seq LIMIT 1)) AS space_id,
		COALESCE((SELECT messages.created_at FROM messages
			WHERE messages.conversation_id = conversations.id
			ORDER BY messages.seq DESC LIMIT 1),
			conversations.created_at) AS spoken_at
	FROM conversations WHERE conversations.archived_at IS NULL)
	SELECT id, kind, title, space_id FROM chat"
	)
}

fn participants() -> String {
	format!(
		"SELECT conversation_participants.conversation_id, bots.id, bots.name
	FROM conversation_participants
	JOIN bots ON bots.id = conversation_participants.bot_id
	JOIN conversations ON conversations.id = conversation_participants.conversation_id
	WHERE conversations.archived_at IS NULL AND {PRESENT_SEAT}
	ORDER BY conversation_participants.conversation_id, conversation_participants.join_seq"
	)
}

const BOT_SPACES: &str = "SELECT id, space_id FROM bots";

const ROUTINES: &str = "SELECT id, conversation_id, bot_id, title, trigger_source_id,
	trigger_config, is_enabled FROM routines ORDER BY created_at DESC, id";

struct ChatRow {
	conversation_id: String,
	kind: ChatKind,
	title: String,
	space_id: Option<String>,
}

struct RoutineRow {
	id: String,
	conversation_id: String,
	bot_id: String,
	title: String,
	trigger_source_id: String,
	trigger_config: Value,
	is_enabled: bool,
}

type Seated = HashMap<String, Vec<(String, String)>>;

pub struct CatalogueRepository {
	access: Access,
}

impl CatalogueRepository {
	pub(in crate::db) fn new(access: Access) -> Self {
		Self { access }
	}

	pub async fn search(&self, scope: CatalogueScope) -> Result<Catalogue, CatalogueError> {
		if scope.query.chars().count() > MAX_QUERY_LENGTH {
			return Err(CatalogueError::QueryTooLong { limit: MAX_QUERY_LENGTH });
		}
		let needle = folded(scope.query.trim());
		if needle.is_empty() {
			return Ok(Catalogue { chats: vec![], missions: vec![], routines: vec![] });
		}
		self.access.call(move |connection| Ok(searched(connection, &scope, &needle))).await?
	}

	pub async fn recent(&self, space_id: String) -> Result<Vec<CatalogueChat>, CatalogueError> {
		self.access.call(move |connection| Ok(recent_chats(connection, &space_id))).await?
	}
}

fn searched(
	connection: &Connection,
	scope: &CatalogueScope,
	needle: &str,
) -> Result<Catalogue, CatalogueError> {
	let seated = seated_bots(connection)?;
	let spaces = bot_spaces(connection)?;
	Ok(Catalogue {
		chats: matching_chats(connection, scope, needle, &seated)?,
		missions: matching_missions(connection, scope, needle, &spaces)?,
		routines: matching_routines(connection, scope, needle, &spaces)?,
	})
}

fn recent_chats(
	connection: &Connection,
	space_id: &str,
) -> Result<Vec<CatalogueChat>, CatalogueError> {
	let seated = seated_bots(connection)?;
	let mut statement =
		connection.prepare_cached(&format!("{} {RECENT_CHATS_OF_SPACE} {CHAT_ORDER}", chats()))?;
	let rows = statement.query_map([space_id], chat_row)?;
	Ok(rows
		.collect::<rusqlite::Result<Vec<_>>>()?
		.into_iter()
		.filter_map(|row| chat_of(row, &seated))
		.take(MAX_RECENT_CHATS)
		.collect())
}

fn matching_chats(
	connection: &Connection,
	scope: &CatalogueScope,
	needle: &str,
	seated: &Seated,
) -> Result<Vec<CatalogueChat>, CatalogueError> {
	let mut statement = connection.prepare_cached(&format!("{} {CHAT_ORDER}", chats()))?;
	let rows = statement.query_map([], chat_row)?;
	Ok(rows
		.collect::<rusqlite::Result<Vec<_>>>()?
		.into_iter()
		.filter(|row| in_scope(scope, row.space_id.as_deref()))
		.filter_map(|row| chat_of(row, seated))
		.filter(|chat| chat_matches(chat, needle))
		.take(MAX_MATCHES_PER_LIST)
		.collect())
}

fn matching_missions(
	connection: &Connection,
	scope: &CatalogueScope,
	needle: &str,
	spaces: &HashMap<String, String>,
) -> Result<Vec<CatalogueMission>, CatalogueError> {
	let mut statement =
		connection.prepare_cached(&format!("{MISSION_COLUMNS} ORDER BY opened_at DESC, id"))?;
	let rows = statement.query_map([], mission)?;
	let mut held = Vec::new();
	for mission in rows.collect::<rusqlite::Result<Vec<_>>>()? {
		if held.len() == MAX_MATCHES_PER_LIST {
			break;
		}
		let space_id = space_of(spaces, &mission.bot_id)?;
		if !in_scope(scope, Some(&space_id)) || !mission_matches(&mission, needle) {
			continue;
		}
		held.push(CatalogueMission {
			id: mission.id,
			thread_conversation_id: mission.thread_conversation_id,
			objective: mission.objective,
			ticket_platform: mission.ticket.platform,
			ticket_external_id: mission.ticket.external_id,
			ticket_title: mission.ticket.title,
			state: mission.state,
			bot_id: mission.bot_id,
			space_id,
		});
	}
	Ok(held)
}

fn matching_routines(
	connection: &Connection,
	scope: &CatalogueScope,
	needle: &str,
	spaces: &HashMap<String, String>,
) -> Result<Vec<CatalogueRoutine>, CatalogueError> {
	let mut statement = connection.prepare_cached(ROUTINES)?;
	let rows = statement.query_map([], routine_row)?;
	let mut held = Vec::new();
	for row in rows.collect::<rusqlite::Result<Vec<_>>>()? {
		if held.len() == MAX_MATCHES_PER_LIST {
			break;
		}
		let space_id = space_of(spaces, &row.bot_id)?;
		if !in_scope(scope, Some(&space_id)) || !folded(&row.title).contains(needle) {
			continue;
		}
		held.push(CatalogueRoutine {
			id: row.id,
			conversation_id: row.conversation_id,
			bot_id: row.bot_id,
			title: row.title,
			trigger_source_id: row.trigger_source_id,
			is_enabled: row.is_enabled,
			expression: expression_of(&row.trigger_config),
			space_id,
		});
	}
	Ok(held)
}

fn chat_of(row: ChatRow, seated: &Seated) -> Option<CatalogueChat> {
	let bots = seated.get(&row.conversation_id).map(Vec::as_slice).unwrap_or_default();
	Some(match row.kind {
		ChatKind::Main => {
			let (bot_id, name) = bots.first()?;
			CatalogueChat {
				conversation_id: row.conversation_id,
				kind: row.kind,
				title: name.clone(),
				bot_id: Some(bot_id.clone()),
				participants: vec![],
				space_id: row.space_id,
			}
		}
		ChatKind::Topic => CatalogueChat {
			conversation_id: row.conversation_id,
			kind: row.kind,
			title: row.title,
			bot_id: None,
			participants: bots.iter().map(|(_, name)| name.clone()).collect(),
			space_id: row.space_id,
		},
		ChatKind::Mission => CatalogueChat {
			conversation_id: row.conversation_id,
			kind: row.kind,
			title: row.title,
			bot_id: None,
			participants: vec![],
			space_id: row.space_id,
		},
	})
}

fn chat_matches(chat: &CatalogueChat, needle: &str) -> bool {
	folded(&chat.title).contains(needle)
		|| chat.participants.iter().any(|name| folded(name).contains(needle))
}

fn mission_matches(mission: &Mission, needle: &str) -> bool {
	folded(&mission.objective).contains(needle)
		|| folded(&mission.ticket.external_id).contains(needle)
		|| folded(&mission.ticket.title).contains(needle)
}

fn in_scope(scope: &CatalogueScope, space_id: Option<&str>) -> bool {
	scope.all_spaces || space_id == Some(scope.space_id.as_str())
}

fn space_of(spaces: &HashMap<String, String>, bot_id: &str) -> Result<String, CatalogueError> {
	spaces.get(bot_id).cloned().ok_or_else(|| CatalogueError::UnknownBot { id: bot_id.to_owned() })
}

fn expression_of(trigger_config: &Value) -> Option<String> {
	trigger_config
		.get("expression")
		.and_then(Value::as_str)
		.filter(|held| !held.trim().is_empty())
		.map(str::to_owned)
}

fn seated_bots(connection: &Connection) -> Result<Seated, DatabaseError> {
	let mut statement = connection.prepare_cached(&participants())?;
	let rows = statement.query_map([], |row| {
		Ok((row.get::<_, String>(0)?, (row.get::<_, String>(1)?, row.get::<_, String>(2)?)))
	})?;
	let mut seated: Seated = HashMap::new();
	for held in rows {
		let (conversation_id, bot) = held?;
		seated.entry(conversation_id).or_default().push(bot);
	}
	Ok(seated)
}

fn bot_spaces(connection: &Connection) -> Result<HashMap<String, String>, DatabaseError> {
	let mut statement = connection.prepare_cached(BOT_SPACES)?;
	let rows =
		statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
	Ok(rows.collect::<rusqlite::Result<HashMap<_, _>>>()?)
}

fn chat_row(row: &Row<'_>) -> rusqlite::Result<ChatRow> {
	Ok(ChatRow {
		conversation_id: row.get(0)?,
		kind: chat_kind(row, 1)?,
		title: row.get(2)?,
		space_id: row.get(3)?,
	})
}

fn chat_kind(row: &Row<'_>, index: usize) -> rusqlite::Result<ChatKind> {
	match row.get::<_, String>(index)?.as_str() {
		"main" => Ok(ChatKind::Main),
		"topic" => Ok(ChatKind::Topic),
		"mission" => Ok(ChatKind::Mission),
		held => Err(rusqlite::Error::FromSqlConversionFailure(
			index,
			rusqlite::types::Type::Text,
			format!("{held} names no chat kind").into(),
		)),
	}
}

fn routine_row(row: &Row<'_>) -> rusqlite::Result<RoutineRow> {
	Ok(RoutineRow {
		id: row.get(0)?,
		conversation_id: row.get(1)?,
		bot_id: row.get(2)?,
		title: row.get(3)?,
		trigger_source_id: row.get(4)?,
		trigger_config: serde_json::from_str(&row.get::<_, String>(5)?).map_err(|error| {
			rusqlite::Error::FromSqlConversionFailure(5, rusqlite::types::Type::Text, error.into())
		})?,
		is_enabled: row.get(6)?,
	})
}

fn folded(text: &str) -> String {
	text.nfd().filter(|held| !is_combining_mark(*held)).collect::<String>().to_lowercase()
}

#[cfg(test)]
mod tests {
	use std::path::PathBuf;

	use rusqlite::params;
	use uuid::Uuid;

	use super::*;
	use crate::db::connection::temp_dir;
	use crate::db::{open, Database};
	use crate::missions::contract::{MissionDraft, MissionState, Ticket};

	const PERSONAL: &str = "personal";
	const WORK: &str = "work";

	const A_CATALOGUE: &str = "
		INSERT INTO spaces (id, name, colour, position, created_at)
			VALUES ('work', 'Work', 'blue', 1, 1);
		INSERT INTO bots (id, space_id, name, model, created_at)
			VALUES ('b1', 'personal', 'Amélie', 'sonnet', 1),
				('b2', 'work', 'Basile', 'sonnet', 1);
		INSERT INTO conversations (id, kind, space_id, title, created_at, updated_at, archived_at)
			VALUES ('main-1', 'main', NULL, 'Chat', 1, 1, NULL),
				('main-2', 'main', NULL, 'Chat', 2, 2, NULL),
				('topic-1', 'topic', 'personal', 'Roadmap review', 3, 3, NULL),
				('topic-2', 'topic', 'work', 'Roadmap of the other space', 4, 4, NULL),
				('topic-3', 'topic', 'personal', 'Archived roadmap', 5, 5, 6);
		INSERT INTO conversation_participants
				(conversation_id, bot_id, role, joined_at, join_seq)
			VALUES ('main-1', 'b1', 'lead', 1, 0),
				('main-2', 'b2', 'lead', 2, 0),
				('topic-1', 'b1', 'lead', 3, 0),
				('topic-2', 'b2', 'lead', 4, 0),
				('topic-3', 'b1', 'lead', 5, 0);
		INSERT INTO turns (id, conversation_id, seq, started_at)
			VALUES ('t1', 'topic-1', 0, 10), ('t2', 'main-1', 0, 11);
		INSERT INTO messages
				(id, conversation_id, turn_id, seq, role, content, completion_state, created_at)
			VALUES ('m1', 'topic-1', 't1', 0, 'user', 'Where is the roadmap', 'complete', 100),
				('m2', 'main-1', 't2', 0, 'user', 'Good morning', 'complete', 200);
		INSERT INTO routines (id, conversation_id, bot_id, trigger_source_id, event_filter,
				trigger_config, trigger_key, created_at, title, instruction)
			VALUES ('r1', 'topic-1', 'b1', 'schedule', '[]', '{\"expression\":\"0 9 * * *\"}',
					'k1', 7, 'Nightly réport', 'Read the log'),
				('r2', 'topic-2', 'b2', 'webhook', '[]', '{\"expression\":\"   \"}',
					'k2', 8, 'Nightly digest', 'Read the log');
	";

	fn a_draft(
		origin_conversation_id: &str,
		bot_id: &str,
		objective: &str,
		ticket: Ticket,
	) -> MissionDraft {
		MissionDraft {
			origin_conversation_id: origin_conversation_id.to_owned(),
			bot_id: bot_id.to_owned(),
			objective: objective.to_owned(),
			ticket,
			tools: vec![],
			source: "bot".to_owned(),
			workspace_path: None,
		}
	}

	fn a_ticket(external_id: &str, title: &str) -> Ticket {
		Ticket {
			platform: "github".to_owned(),
			external_id: external_id.to_owned(),
			url: format!("https://kiroshi.test/tickets/{external_id}"),
			title: title.to_owned(),
		}
	}

	async fn planted() -> (Database, PathBuf) {
		let dir = temp_dir();
		let database = open(&dir);
		database
			.call_mut(|connection| Ok(connection.execute_batch(A_CATALOGUE)?))
			.await
			.expect("the catalogue is planted");
		for draft in [
			a_draft("topic-1", "b1", "Fix the crash on open", a_ticket("OPE-42", "Crash on open")),
			a_draft(
				"main-1",
				"b1",
				"Rename the sidecar",
				a_ticket("OPE-7", "The binary keeps its old name"),
			),
			a_draft(
				"topic-2",
				"b2",
				"Rename the sidecar of the other space",
				a_ticket("OPE-9", "A binary of its own"),
			),
		] {
			database
				.missions()
				.open(draft, Uuid::new_v4().to_string())
				.await
				.expect("the mission opens");
		}
		(database, dir)
	}

	fn scope(query: &str, space_id: &str, all_spaces: bool) -> CatalogueScope {
		CatalogueScope { query: query.to_owned(), space_id: space_id.to_owned(), all_spaces }
	}

	fn objectives(missions: &[CatalogueMission]) -> Vec<&str> {
		let mut held =
			missions.iter().map(|mission| mission.objective.as_str()).collect::<Vec<_>>();
		held.sort_unstable();
		held
	}

	fn named(chats: &[CatalogueChat]) -> Vec<(&str, ChatKind, &str)> {
		chats
			.iter()
			.map(|chat| (chat.conversation_id.as_str(), chat.kind, chat.title.as_str()))
			.collect()
	}

	#[tokio::test]
	async fn a_query_reaches_the_title_of_a_topic_and_leaves_the_archived_one_behind() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("roadmap", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(
			named(&held.chats),
			vec![
				("topic-1", ChatKind::Topic, "Roadmap review"),
				("topic-2", ChatKind::Topic, "Roadmap of the other space"),
			],
			"the chats lost the spoken order, or kept the archived conversation"
		);
		assert_eq!(held.chats[0].participants, vec!["Amélie".to_owned()]);
		assert_eq!(held.chats[0].space_id, Some(PERSONAL.to_owned()));
		assert_eq!(held.chats[0].bot_id, None);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_folds_the_diacritics_and_the_case_of_a_bot_and_of_a_participant() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("AMELIE", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(
			named(&held.chats),
			vec![
				("main-1", ChatKind::Main, "Amélie"),
				("topic-1", ChatKind::Topic, "Roadmap review")
			],
			"the fold did not reach the name of the bot behind its main chat"
		);
		assert_eq!(held.chats[0].bot_id, Some("b1".to_owned()));
		assert_eq!(held.chats[0].space_id, Some(PERSONAL.to_owned()));
		assert_eq!(held.chats[0].participants, Vec::<String>::new());

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_reaches_a_mission_by_its_objective_and_its_thread_by_its_title() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("crash", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		let mission = held.missions.first().expect("the mission is answered");
		assert_eq!(mission.objective, "Fix the crash on open");
		assert_eq!(mission.ticket_platform, "github");
		assert_eq!(mission.ticket_external_id, "OPE-42");
		assert_eq!(mission.ticket_title, "Crash on open");
		assert_eq!(mission.state, MissionState::Working);
		assert_eq!(mission.bot_id, "b1");
		assert_eq!(mission.space_id, PERSONAL);
		assert_eq!(
			named(&held.chats),
			vec![(
				mission.thread_conversation_id.as_str(),
				ChatKind::Mission,
				"Fix the crash on open"
			)],
			"the mission thread did not answer as a chat of its own space"
		);
		assert_eq!(held.chats[0].space_id, Some(PERSONAL.to_owned()));

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_reaches_a_routine_by_its_title_and_carries_the_expression_it_holds() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("nightly", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(
			held.routines
				.iter()
				.map(|routine| (
					routine.id.as_str(),
					routine.space_id.as_str(),
					routine.expression.clone()
				))
				.collect::<Vec<_>>(),
			vec![("r2", WORK, None), ("r1", PERSONAL, Some("0 9 * * *".to_owned()))],
			"the routines lost their creation order, their space or their expression"
		);
		let first = held.routines.last().expect("the routine is answered");
		assert_eq!(first.conversation_id, "topic-1");
		assert_eq!(first.bot_id, "b1");
		assert_eq!(first.trigger_source_id, "schedule");
		assert!(first.is_enabled);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn one_space_leaves_out_every_row_of_another() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("nightly", PERSONAL, false))
			.await
			.expect("the catalogue reads");
		let wide = database
			.catalogue()
			.search(scope("roadmap", PERSONAL, false))
			.await
			.expect("the catalogue reads");

		assert_eq!(
			held.routines.iter().map(|routine| routine.id.as_str()).collect::<Vec<_>>(),
			vec!["r1"],
			"a routine of another space crossed the scope"
		);
		assert_eq!(
			named(&wide.chats),
			vec![("topic-1", ChatKind::Topic, "Roadmap review")],
			"a chat of another space crossed the scope"
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	const GONE_SEATS: &str = "
		INSERT INTO bots (id, space_id, name, model, created_at, deleted_at)
			VALUES ('b3', 'personal', 'Clément', 'sonnet', 1, NULL),
				('b4', 'personal', 'Damien', 'sonnet', 1, 9);
		INSERT INTO conversations (id, kind, space_id, title, created_at, updated_at)
			VALUES ('topic-4', 'topic', 'personal', 'Departed room', 20, 20),
				('topic-5', 'topic', 'personal', 'Tombstone room', 21, 21),
				('topic-6', 'topic', NULL, 'Orphan room', 22, 22),
				('main-3', 'main', NULL, 'Chat', 23, 23);
		INSERT INTO conversation_participants
				(conversation_id, bot_id, role, joined_at, join_seq, left_at)
			VALUES ('topic-4', 'b3', 'member', 20, 0, 30),
				('topic-5', 'b4', 'member', 21, 0, NULL),
				('topic-6', 'b3', 'member', 22, 0, 30),
				('main-3', 'b3', 'member', 23, 0, 30);
	";

	async fn a_crowd_of_topics(database: &Database, count: usize) {
		database
			.call_mut(move |connection| {
				let transaction = connection.transaction()?;
				for index in 0..count {
					transaction.execute(
						"INSERT INTO conversations (id, kind, space_id, title, created_at,
								updated_at)
							VALUES (?1, 'topic', 'personal', ?2, ?3, ?3)",
						params![
							format!("crowd-{index}"),
							format!("Crowd {index}"),
							40 + index as i64
						],
					)?;
				}
				transaction.commit()?;
				Ok(())
			})
			.await
			.expect("the topics are planted");
	}

	async fn a_crowd_of_routines(database: &Database, count: usize) {
		database
			.call_mut(move |connection| {
				let transaction = connection.transaction()?;
				for index in 0..count {
					transaction.execute(
						"INSERT INTO routines (id, conversation_id, bot_id, trigger_source_id,
								event_filter, trigger_config, trigger_key, created_at, title,
								instruction)
							VALUES (?1, 'topic-1', 'b1', 'schedule', '[]', '{}', ?1, ?2, ?3, '')",
						params![
							format!("crowd-{index}"),
							40 + index as i64,
							format!("Crowd {index}")
						],
					)?;
				}
				transaction.commit()?;
				Ok(())
			})
			.await
			.expect("the routines are planted");
	}

	#[tokio::test]
	async fn a_seat_a_bot_left_or_a_tombstone_names_no_chat_and_lends_no_space() {
		let (database, dir) = planted().await;
		database
			.call_mut(|connection| Ok(connection.execute_batch(GONE_SEATS)?))
			.await
			.expect("the gone seats are planted");

		for query in ["clement", "damien"] {
			let held = database
				.catalogue()
				.search(scope(query, PERSONAL, true))
				.await
				.expect("the catalogue reads");

			assert_eq!(named(&held.chats), vec![], "{query:?} reached a chat through a gone seat");
		}

		let rooms = database
			.catalogue()
			.search(scope("room", PERSONAL, true))
			.await
			.expect("the catalogue reads");
		assert!(
			rooms.chats.iter().all(|chat| chat.participants.is_empty()),
			"a gone seat was listed among the participants: {:?}",
			rooms.chats
		);

		let scoped = database
			.catalogue()
			.search(scope("orphan room", PERSONAL, false))
			.await
			.expect("the catalogue reads");
		assert_eq!(
			named(&scoped.chats),
			vec![],
			"a space-less room lent itself the space of a seat that left it"
		);

		let recent = database.catalogue().recent(PERSONAL.to_owned()).await.expect("recent reads");
		assert!(
			!recent.iter().any(|chat| chat.conversation_id == "main-3"),
			"a solo chat no present seat names answered as recent"
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_search_stops_at_the_bound_of_every_list_it_answers() {
		let (database, dir) = planted().await;
		a_crowd_of_topics(&database, MAX_MATCHES_PER_LIST + 3).await;
		a_crowd_of_routines(&database, MAX_MATCHES_PER_LIST + 3).await;

		let held = database
			.catalogue()
			.search(scope("crowd", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(held.chats.len(), MAX_MATCHES_PER_LIST, "the chats ran past their bound");
		assert_eq!(held.routines.len(), MAX_MATCHES_PER_LIST, "the routines ran past their bound");

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn the_recent_chats_stop_at_their_bound() {
		let (database, dir) = planted().await;
		a_crowd_of_topics(&database, MAX_RECENT_CHATS + 3).await;

		let held =
			database.catalogue().recent(PERSONAL.to_owned()).await.expect("the recent reads");

		assert_eq!(held.len(), MAX_RECENT_CHATS, "the recent chats ran past their bound");

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn the_chats_read_their_last_message_through_an_index() {
		let (database, dir) = planted().await;

		let (plan, opcodes) = database
			.call(|connection| {
				let mut plan =
					connection.prepare(&format!("EXPLAIN QUERY PLAN {} {CHAT_ORDER}", chats()))?;
				let steps = plan
					.query_map([], |row| row.get::<_, String>(3))?
					.collect::<rusqlite::Result<Vec<_>>>()?;
				let mut bytecode =
					connection.prepare(&format!("EXPLAIN {} {CHAT_ORDER}", chats()))?;
				let opcodes = bytecode
					.query_map([], |row| row.get::<_, String>(1))?
					.collect::<rusqlite::Result<Vec<_>>>()?;
				Ok((steps, opcodes))
			})
			.await
			.expect("the plan reads");

		assert!(
			!plan.iter().any(|step| step.starts_with("SCAN") && step.contains("messages")),
			"the chats read every message row: {plan:?}"
		);
		assert!(
			!opcodes.iter().any(|opcode| opcode.starts_with("Agg")),
			"the chats fold their last message through an aggregate: {opcodes:?}"
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn the_blanks_around_a_query_answer_what_the_query_alone_answers() {
		let (database, dir) = planted().await;

		let padded = database
			.catalogue()
			.search(scope("  roadmap  ", PERSONAL, true))
			.await
			.expect("the catalogue reads");
		let bare = database
			.catalogue()
			.search(scope("roadmap", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(padded, bare, "the blanks around a query changed what it reaches");
		assert_eq!(
			named(&bare.chats),
			vec![
				("topic-1", ChatKind::Topic, "Roadmap review"),
				("topic-2", ChatKind::Topic, "Roadmap of the other space"),
			]
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_of_nothing_but_blanks_answers_three_empty_lists() {
		let (database, dir) = planted().await;

		let empty = Catalogue { chats: vec![], missions: vec![], routines: vec![] };
		for query in ["", " "] {
			let held = database
				.catalogue()
				.search(scope(query, PERSONAL, true))
				.await
				.expect("the catalogue reads");

			assert_eq!(held, empty, "{query:?} reached the catalogue");
		}

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_mission_opened_from_a_solo_chat_answers_with_its_thread_inside_its_space() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope("rename the sidecar", PERSONAL, false))
			.await
			.expect("the catalogue reads");

		let mission = held.missions.first().expect("the mission is answered");
		assert_eq!(mission.space_id, PERSONAL);
		assert_eq!(
			named(&held.chats),
			vec![(
				mission.thread_conversation_id.as_str(),
				ChatKind::Mission,
				"Rename the sidecar"
			)],
			"the thread of a mission opened from a solo chat fell out of its own space"
		);
		assert_eq!(held.chats[0].space_id, Some(PERSONAL.to_owned()));

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_mission_of_another_space_answers_only_once_the_search_widens() {
		let (database, dir) = planted().await;

		let scoped = database
			.catalogue()
			.search(scope("rename the sidecar", PERSONAL, false))
			.await
			.expect("the catalogue reads");
		let wide = database
			.catalogue()
			.search(scope("rename the sidecar", PERSONAL, true))
			.await
			.expect("the catalogue reads");

		assert_eq!(
			objectives(&scoped.missions),
			vec!["Rename the sidecar"],
			"a mission whose bot sits in another space crossed the scope"
		);
		assert_eq!(
			objectives(&wide.missions),
			vec!["Rename the sidecar", "Rename the sidecar of the other space"],
			"the wide search lost a mission of another space"
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_reaches_a_mission_by_its_ticket_and_carries_the_title_it_matched() {
		let (database, dir) = planted().await;

		for (query, objective, ticket_title) in [
			("ope-42", "Fix the crash on open", "Crash on open"),
			("keeps its old", "Rename the sidecar", "The binary keeps its old name"),
		] {
			let held = database
				.catalogue()
				.search(scope(query, PERSONAL, true))
				.await
				.expect("the catalogue reads");

			assert_eq!(
				held.missions
					.iter()
					.map(|mission| (mission.objective.as_str(), mission.ticket_title.as_str()))
					.collect::<Vec<_>>(),
				vec![(objective, ticket_title)],
				"{query:?} did not reach the ticket it names"
			);
		}

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn a_query_over_the_limit_is_refused_by_the_limit_it_names() {
		let (database, dir) = planted().await;

		let held = database
			.catalogue()
			.search(scope(&"a".repeat(MAX_QUERY_LENGTH + 1), PERSONAL, true))
			.await;

		assert_eq!(held, Err(CatalogueError::QueryTooLong { limit: MAX_QUERY_LENGTH }));

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}

	#[tokio::test]
	async fn the_recent_chats_of_a_space_answer_the_spoken_first_and_leave_the_threads_out() {
		let (database, dir) = planted().await;

		let held =
			database.catalogue().recent(PERSONAL.to_owned()).await.expect("the recent reads");

		assert_eq!(
			named(&held),
			vec![
				("main-1", ChatKind::Main, "Amélie"),
				("topic-1", ChatKind::Topic, "Roadmap review"),
			],
			"the recent chats lost the last message order, or kept a mission thread"
		);

		std::fs::remove_dir_all(&dir).expect("cleanup");
	}
}
