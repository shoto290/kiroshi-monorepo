use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::mpsc;

use super::contract::{
	AgentEvent, ChatMessage, MessageCompletion, RuntimeScope, SubmittedTurn, TurnOutcome, TurnState,
};
use super::session::EventSink;
use super::translate::now_ms;
use crate::conversations::commands::ready;
use crate::conversations::contract::TranscriptStoreError;
use crate::db;
use crate::db::repositories::conversations::{MISSION_KIND, TOPIC_KIND};
use crate::db::repositories::messages::{NewAssistantMessage, NewTurn, TerminalState};
use crate::db::DatabaseError;

const MENTION_SIGN: char = '@';
const MENTION_OPEN: char = '<';

#[derive(Default)]
pub struct HostWrites {
	turns: Mutex<HashSet<String>>,
	messages: Mutex<HashSet<String>>,
}

impl HostWrites {
	pub fn owns_turn(&self, id: &str) -> bool {
		held(&self.turns).contains(id)
	}

	pub fn owns_message(&self, id: &str) -> bool {
		held(&self.messages).contains(id)
	}

	pub(crate) fn claim_turn(&self, id: &str) {
		held(&self.turns).insert(id.to_owned());
	}

	fn claim_message(&self, id: &str) {
		held(&self.messages).insert(id.to_owned());
	}
}

fn held(ids: &Mutex<HashSet<String>>) -> MutexGuard<'_, HashSet<String>> {
	ids.lock().unwrap_or_else(PoisonError::into_inner)
}

enum Entry {
	Submitted(SubmittedTurn),
	Withdrawn,
	Event(AgentEvent),
}

pub struct ReplyWriter {
	entries: mpsc::UnboundedSender<Entry>,
}

impl ReplyWriter {
	pub fn spawn<R: Runtime>(
		app: AppHandle<R>,
		scope: &RuntimeScope,
		owned: Arc<HostWrites>,
		inner: Arc<dyn EventSink>,
	) -> Self {
		let (entries, queued) = mpsc::unbounded_channel();
		let store = Store {
			app,
			conversation_id: scope.conversation_id.clone(),
			bot_id: scope.bot_id.clone(),
			owned,
		};
		tauri::async_runtime::spawn(write_then_forward(queued, Desk { store, turn: None }, inner));
		Self { entries }
	}

	fn queue(&self, entry: Entry) {
		if self.entries.send(entry).is_err() {
			eprintln!("the reply writer of this run has stopped, an agent event was dropped");
		}
	}
}

impl EventSink for ReplyWriter {
	fn emit(&self, event: AgentEvent) {
		self.queue(Entry::Event(event));
	}

	fn submitted(&self, turn: SubmittedTurn) {
		self.queue(Entry::Submitted(turn));
	}

	fn withdrawn(&self) {
		self.queue(Entry::Withdrawn);
	}
}

async fn write_then_forward<R: Runtime>(
	mut queued: mpsc::UnboundedReceiver<Entry>,
	mut desk: Desk<R>,
	inner: Arc<dyn EventSink>,
) {
	while let Some(entry) = queued.recv().await {
		match entry {
			Entry::Submitted(turn) => desk.open_turn(turn).await,
			Entry::Withdrawn => desk.end(TerminalState::Failed).await,
			Entry::Event(event) => {
				desk.record(&event).await;
				inner.emit(event);
			}
		}
	}
}

struct OpenTurn {
	id: String,
	prompt_id: String,
	held: Option<ChatMessage>,
	streamed: HashMap<String, u64>,
	written: HashMap<String, String>,
	settled: HashSet<String>,
}

impl OpenTurn {
	fn new(turn: SubmittedTurn) -> Self {
		Self {
			id: turn.turn_id,
			prompt_id: turn.prompt_id,
			held: None,
			streamed: HashMap::new(),
			written: HashMap::new(),
			settled: HashSet::new(),
		}
	}

	fn is_unwritten(&self, id: &str) -> bool {
		!self.streamed.contains_key(id) && !self.settled.contains(id)
	}

	fn take_held(&mut self, id: &str) -> Option<ChatMessage> {
		if self.held.as_ref().is_some_and(|held| held.id == id) {
			return self.held.take();
		}
		None
	}
}

struct Desk<R: Runtime> {
	store: Store<R>,
	turn: Option<OpenTurn>,
}

impl<R: Runtime> Desk<R> {
	async fn open_turn(&mut self, turn: SubmittedTurn) {
		self.end(TerminalState::Cancelled).await;
		match self.store.start_turn(&turn.turn_id).await {
			Ok(()) => self.turn = Some(OpenTurn::new(turn)),
			Err(error) => {
				self.store.report(&turn.turn_id, &error);
				self.turn = None;
			}
		}
	}

	async fn record(&mut self, event: &AgentEvent) {
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		match event {
			AgentEvent::MessageStarted { message } => {
				if turn.is_unwritten(&message.id) {
					turn.held = Some(message.clone());
				}
			}
			AgentEvent::MessageDelta { id, seq, text } => self.stream(id, *seq, text).await,
			AgentEvent::MessageCompleted { message } => self.settle_completed(message).await,
			AgentEvent::QuestionRequested { .. } => self.settle_open(TerminalState::Complete).await,
			AgentEvent::TurnEnded { ended } => self.end(ending_of(ended.outcome)).await,
			AgentEvent::TurnChanged { state: TurnState::Failed } => {
				self.end(TerminalState::Failed).await
			}
			_ => {}
		}
	}

	async fn open(&mut self, message: &ChatMessage) {
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		if !turn.is_unwritten(&message.id) {
			return;
		}
		match self.store.open_reply(turn, message).await {
			Ok(()) => {
				turn.streamed.insert(message.id.clone(), 0);
			}
			Err(error) => {
				self.store.report(&message.id, &error);
				turn.settled.insert(message.id.clone());
				return;
			}
		}
		self.append(&message.id, 1, &message.text).await;
	}

	async fn stream(&mut self, id: &str, seq: u64, text: &str) {
		if text.is_empty() {
			return;
		}
		if let Some(held) = self.turn.as_mut().and_then(|turn| turn.take_held(id)) {
			self.open(&held).await;
		}
		self.append(id, seq, text).await;
	}

	async fn append(&mut self, id: &str, seq: u64, text: &str) {
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		if text.is_empty() {
			return;
		}
		match turn.streamed.get(id) {
			Some(written) if seq > *written => {}
			_ => return,
		}
		turn.streamed.insert(id.to_owned(), seq);
		turn.written.entry(id.to_owned()).or_default().push_str(text);
		if let Err(error) = self.store.append_text(id, text).await {
			self.store.report(id, &error);
		}
	}

	async fn settle(&mut self, id: &str, completion: TerminalState) {
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		if turn.streamed.remove(id).is_none() {
			return;
		}
		turn.settled.insert(id.to_owned());
		let written = turn.written.get(id).cloned().unwrap_or_default();
		let settled_text = match self.store.settled_mentions(&written).await {
			Ok(settled) => settled,
			Err(error) => {
				self.store.report(id, &error);
				None
			}
		};
		if let Some(settled) = &settled_text {
			turn.written.insert(id.to_owned(), settled.clone());
		}
		if let Err(error) = self.store.finalize(id, completion, settled_text).await {
			self.store.report(id, &error);
		}
	}

	async fn write_reply(&mut self, message: &ChatMessage, completion: TerminalState) {
		self.open(message).await;
		self.settle(&message.id, completion).await;
	}

	async fn settle_completed(&mut self, message: &ChatMessage) {
		let Some(completion) = ending_for(message.completion) else {
			return;
		};
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		if turn.settled.contains(&message.id) {
			return;
		}
		turn.take_held(&message.id);
		if turn.is_unwritten(&message.id) && !is_worth_keeping(message, completion) {
			return;
		}
		self.write_reply(message, completion).await;
	}

	async fn settle_open(&mut self, completion: TerminalState) {
		let Some(turn) = self.turn.as_mut() else {
			return;
		};
		if let Some(held) = turn.held.take().filter(|held| is_worth_keeping(held, completion)) {
			self.write_reply(&held, completion).await;
		}
		let open: Vec<String> =
			self.turn.iter().flat_map(|turn| turn.streamed.keys().cloned()).collect();
		for id in open {
			self.settle(&id, completion).await;
		}
	}

	async fn end(&mut self, completion: TerminalState) {
		self.settle_open(completion).await;
		let Some(turn) = self.turn.take() else {
			return;
		};
		if let Err(error) = self.store.complete_turn(&turn.id).await {
			self.store.report(&turn.id, &error);
		}
	}
}

struct Store<R: Runtime> {
	app: AppHandle<R>,
	conversation_id: String,
	bot_id: String,
	owned: Arc<HostWrites>,
}

impl<R: Runtime> Store<R> {
	fn database(&self) -> Result<&db::Database, TranscriptStoreError> {
		match self.app.try_state::<db::DatabaseState>() {
			Some(state) => ready(state.inner()),
			None => Err(TranscriptStoreError::Unavailable {
				failure: (&DatabaseError::AppDataDir).into(),
			}),
		}
	}

	fn report(&self, id: &str, error: &TranscriptStoreError) {
		eprintln!(
			"the host could not write {id} of conversation {}: {error:?}",
			self.conversation_id
		);
	}

	async fn start_turn(&self, id: &str) -> Result<(), TranscriptStoreError> {
		let turn = NewTurn {
			id: id.to_owned(),
			conversation_id: self.conversation_id.clone(),
			started_at: now_ms(),
		};
		self.database()?.messages().ensure_turn(turn).await?;
		self.owned.claim_turn(id);
		Ok(())
	}

	async fn open_reply(
		&self,
		turn: &OpenTurn,
		message: &ChatMessage,
	) -> Result<(), TranscriptStoreError> {
		let reply = NewAssistantMessage {
			id: message.id.clone(),
			conversation_id: self.conversation_id.clone(),
			turn_id: turn.id.clone(),
			author_bot_id: Some(self.bot_id.clone()),
			replied_to_message_id: Some(turn.prompt_id.clone()),
			created_at: message.timestamp,
		};
		self.database()?.messages().open_assistant_message(reply).await?;
		self.owned.claim_message(&message.id);
		Ok(())
	}

	async fn append_text(&self, id: &str, text: &str) -> Result<(), TranscriptStoreError> {
		Ok(self.database()?.messages().append_text(id.to_owned(), text.to_owned()).await?)
	}

	async fn finalize(
		&self,
		id: &str,
		completion: TerminalState,
		settled_text: Option<String>,
	) -> Result<(), TranscriptStoreError> {
		Ok(self
			.database()?
			.messages()
			.finalize_message(id.to_owned(), completion, settled_text)
			.await?)
	}

	async fn complete_turn(&self, id: &str) -> Result<(), TranscriptStoreError> {
		Ok(self.database()?.messages().complete_turn(id.to_owned(), now_ms()).await?)
	}

	async fn settled_mentions(
		&self,
		written: &str,
	) -> Result<Option<String>, TranscriptStoreError> {
		if !written.contains(MENTION_SIGN) {
			return Ok(None);
		}
		let conversations = self.database()?.conversations();
		let kind = conversations.kind(self.conversation_id.clone()).await?;
		if !kind.as_deref().is_some_and(|kind| kind == TOPIC_KIND || kind == MISSION_KIND) {
			return Ok(None);
		}
		let seats = conversations.seats(self.conversation_id.clone()).await?;
		let present: Vec<MentionBot<'_>> = seats
			.iter()
			.filter(|seat| seat.left_at.is_none() && !seat.is_deleted)
			.map(|seat| MentionBot { id: &seat.bot_id, name: &seat.name })
			.collect();
		let settled = to_mention_tokens(written, &present);
		Ok((settled != written).then_some(settled))
	}
}

fn ending_for(completion: MessageCompletion) -> Option<TerminalState> {
	match completion {
		MessageCompletion::Streaming => None,
		MessageCompletion::Complete => Some(TerminalState::Complete),
		MessageCompletion::Cancelled => Some(TerminalState::Cancelled),
		MessageCompletion::Failed => Some(TerminalState::Failed),
	}
}

fn ending_of(outcome: TurnOutcome) -> TerminalState {
	match outcome {
		TurnOutcome::Completed => TerminalState::Complete,
		TurnOutcome::Cancelled => TerminalState::Cancelled,
		TurnOutcome::Failed => TerminalState::Failed,
	}
}

fn is_worth_keeping(message: &ChatMessage, completion: TerminalState) -> bool {
	!message.text.is_empty() || completion != TerminalState::Complete
}

struct MentionBot<'a> {
	id: &'a str,
	name: &'a str,
}

fn to_mention_tokens(text: &str, bots: &[MentionBot<'_>]) -> String {
	let chars: Vec<char> = text.chars().collect();
	let mut written = String::new();
	let mut read = 0;
	while let Some(at) = (read..chars.len()).find(|&index| chars[index] == MENTION_SIGN) {
		written.extend(&chars[read..at]);
		let follows_open = at > 0 && chars[at - 1] == MENTION_OPEN;
		match bot_named_at(&chars, at + 1, bots).filter(|_| !follows_open) {
			Some(bot) => {
				written.push_str(&format!("<@{}>", bot.id));
				read = at + 1 + bot.name.chars().count();
			}
			None => {
				written.push(MENTION_SIGN);
				read = at + 1;
			}
		}
	}
	written.extend(&chars[read..]);
	written
}

fn bot_named_at<'a, 'b>(
	chars: &[char],
	from: usize,
	bots: &'a [MentionBot<'b>],
) -> Option<&'a MentionBot<'b>> {
	let mut found: Option<&MentionBot<'_>> = None;
	for bot in bots {
		if bot.name.is_empty() || !is_named_at(chars, from, bot.name) {
			continue;
		}
		if found.is_none_or(|kept| bot.name.chars().count() > kept.name.chars().count()) {
			found = Some(bot);
		}
	}
	found
}

fn is_named_at(chars: &[char], from: usize, name: &str) -> bool {
	let start = from.min(chars.len());
	let end = (from + name.chars().count()).min(chars.len());
	let spelled: String = chars[start..end].iter().collect();
	spelled.to_lowercase() == name.to_lowercase()
}

#[cfg(test)]
mod tests {
	use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
	use tauri::App;

	use super::*;
	use crate::db::repositories::conversations::DEFAULT_BOT_ID;
	use crate::db::repositories::messages::{MessageRole, MessageState, NewUserMessage};

	struct Written {
		app: App<MockRuntime>,
		conversation_id: String,
	}

	impl Written {
		async fn new(name: &str) -> Self {
			let mut context = mock_context(noop_assets());
			context.config_mut().identifier =
				format!("com.kiroshi.reply-writer-{name}-{}", std::process::id());
			let app = mock_builder().build(context).expect("the app builds");
			if let Ok(dir) = app.path().app_data_dir() {
				let _ = std::fs::remove_dir_all(&dir);
			}
			app.manage(db::bootstrap(app.handle()));
			let written = Self { app, conversation_id: String::new() };
			let conversations = written.database().conversations();
			conversations.ensure_default_bot().await.expect("the bot is seeded");
			let chat = conversations
				.ensure_chat(DEFAULT_BOT_ID.to_owned(), None)
				.await
				.expect("the chat is seeded");
			Self { conversation_id: chat.id, ..written }
		}

		fn database(&self) -> &db::Database {
			ready(self.app.state::<db::DatabaseState>().inner()).expect("the database opens")
		}

		fn desk(&self) -> Desk<MockRuntime> {
			let store = Store {
				app: self.app.handle().clone(),
				conversation_id: self.conversation_id.clone(),
				bot_id: DEFAULT_BOT_ID.to_owned(),
				owned: Arc::default(),
			};
			Desk { store, turn: None }
		}

		async fn prompt(&self, turn_id: &str, prompt_id: &str) {
			let messages = self.database().messages();
			let turn = NewTurn {
				id: turn_id.to_owned(),
				conversation_id: self.conversation_id.clone(),
				started_at: 1,
			};
			messages.start_turn(turn).await.expect("the turn starts");
			let said = NewUserMessage {
				id: prompt_id.to_owned(),
				conversation_id: self.conversation_id.clone(),
				turn_id: turn_id.to_owned(),
				author_bot_id: None,
				replied_to_message_id: None,
				content: "hello".to_owned(),
				created_at: 1,
			};
			messages.append_user_message(said).await.expect("the prompt is stored");
		}

		async fn completed_at(&self, turn_id: &'static str) -> Option<i64> {
			self.database()
				.messages()
				.call(move |connection| {
					Ok(connection.query_row(
						"SELECT completed_at FROM turns WHERE id = ?1",
						[turn_id],
						|row| row.get(0),
					)?)
				})
				.await
				.expect("the turn reads")
		}

		fn close(self) {
			if let Ok(dir) = self.app.path().app_data_dir() {
				let _ = std::fs::remove_dir_all(&dir);
			}
		}
	}

	fn submitted(turn_id: &str, prompt_id: &str) -> SubmittedTurn {
		SubmittedTurn { turn_id: turn_id.to_owned(), prompt_id: prompt_id.to_owned() }
	}

	fn streaming(id: &str) -> ChatMessage {
		ChatMessage {
			id: id.to_owned(),
			role: super::super::contract::MessageRole::Assistant,
			text: String::new(),
			completion: MessageCompletion::Streaming,
			timestamp: 2,
		}
	}

	#[tokio::test]
	async fn a_turn_submitted_over_an_open_one_cancels_its_replies_and_completes_it() {
		let written = Written::new("overlap").await;
		written.prompt("t1", "p1").await;
		let mut desk = written.desk();

		desk.open_turn(submitted("t1", "p1")).await;
		desk.record(&AgentEvent::MessageStarted { message: streaming("m1") }).await;
		desk.record(&AgentEvent::MessageDelta { id: "m1".into(), seq: 1, text: "half".into() })
			.await;
		desk.open_turn(submitted("t2", "p2")).await;

		let earlier = written
			.database()
			.messages()
			.message(written.conversation_id.clone(), "m1".into())
			.await
			.expect("the reply reads")
			.expect("the reply is stored");
		assert_eq!(earlier.role, MessageRole::Assistant);
		assert_eq!(earlier.content, "half");
		assert_eq!(earlier.state, MessageState::Cancelled);
		assert!(written.completed_at("t1").await.is_some(), "the earlier turn was left open");
		assert_eq!(written.completed_at("t2").await, None, "the new turn was closed");
		written.close();
	}

	const BOTS: [MentionBot<'static>; 3] = [
		MentionBot { id: "ada", name: "Ada" },
		MentionBot { id: "adam", name: "Adam Smith" },
		MentionBot { id: "nyx", name: "Nyx" },
	];

	#[test]
	fn a_name_behind_an_arobase_becomes_the_token_of_that_companion() {
		assert_eq!(to_mention_tokens("@Ada take the walls", &BOTS), "<@ada> take the walls");
	}

	#[test]
	fn the_longest_name_wins_so_a_shorter_one_does_not_swallow_it() {
		assert_eq!(to_mention_tokens("@Adam Smith and @Ada", &BOTS), "<@adam> and <@ada>");
	}

	#[test]
	fn a_name_reads_whatever_its_case() {
		assert_eq!(to_mention_tokens("@nyx", &BOTS), "<@nyx>");
	}

	#[test]
	fn an_arobase_naming_nobody_and_a_token_already_written_stay_alone() {
		assert_eq!(to_mention_tokens("write to me@example.com", &BOTS), "write to me@example.com");
		assert_eq!(to_mention_tokens("<@ada> again", &BOTS), "<@ada> again");
	}

	#[test]
	fn a_message_ends_worth_keeping_unless_it_completes_empty() {
		let empty = ChatMessage {
			id: "m1".into(),
			role: super::super::contract::MessageRole::Assistant,
			text: String::new(),
			completion: MessageCompletion::Complete,
			timestamp: 1,
		};
		assert!(!is_worth_keeping(&empty, TerminalState::Complete));
		assert!(is_worth_keeping(&empty, TerminalState::Cancelled));
		assert!(is_worth_keeping(
			&ChatMessage { text: "hi".into(), ..empty },
			TerminalState::Complete
		));
	}
}
