use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use super::contract::{
	Application, ApplicationInstall, ApplicationInstalled, ApplicationCallError, InstallCase,
	InstallOutcome, ApplicationSearch, ApplicationState, Destination, InstallDraft, INSTALLED_EVENT,
};
use super::catalogue;
use super::directory::{Directory, DIRECTORY};
use super::registry::REGISTRY;
use super::runnable::{refusal, Runners};
use super::search::{named, search, terms};
use crate::agent::protocol::HostAnswer;
use crate::agent::session::{Answering, HostRequests};
use crate::conversations::commands::{
	conversation_bot_mcp_servers, conversation_set_bot_mcp_server,
	conversation_set_space_mcp_server, conversation_space_mcp_servers, ready,
};
use crate::bundles::ApplicationMark;
use crate::conversations::contract::McpServer;
use crate::db;
use crate::environment::contract::EnvOwner;
use crate::mcp_oauth::commands::mcp_application_status;
use crate::user::commands::{user_plugin_mcp_servers, user_plugin_set_mcp_server};

const SUBTYPE: &str = "application";

const NO_DATABASE: &str = "the store this session writes to is not open";

#[derive(Debug)]
pub struct ApplicationHost<R: Runtime> {
	app: AppHandle<R>,
	conversation_id: String,
	bot_id: String,
	registry: String,
	runners: Runners,
	directory: Arc<Directory>,
}

impl<R: Runtime> Clone for ApplicationHost<R> {
	fn clone(&self) -> Self {
		Self {
			app: self.app.clone(),
			conversation_id: self.conversation_id.clone(),
			bot_id: self.bot_id.clone(),
			registry: self.registry.clone(),
			runners: self.runners.clone(),
			directory: self.directory.clone(),
		}
	}
}

fn held_directory<R: Runtime>(app: &AppHandle<R>) -> Arc<Directory> {
	match app.try_state::<Arc<Directory>>() {
		Some(state) => state.inner().clone(),
		None => Arc::new(Directory::at(DIRECTORY.to_owned(), None)),
	}
}

impl<R: Runtime> ApplicationHost<R> {
	pub fn new(app: AppHandle<R>, conversation_id: String, bot_id: String) -> Self {
		let directory = held_directory(&app);
		Self {
			app,
			conversation_id,
			bot_id,
			registry: REGISTRY.to_owned(),
			runners: Runners::default(),
			directory,
		}
	}

	pub async fn answer(&self, request: Value) -> HostAnswer {
		self.served(request).await.map_err(refused)
	}

	async fn served(&self, request: Value) -> Result<Value, ApplicationCallError> {
		let Asked::Application { operation, payload } = read(request)?;
		match operation {
			Operation::Search => {
				let asked: Searched = read(payload)?;
				answered(self.search(&asked.query).await?)
			}
			Operation::Install => {
				let asked: Named = read(payload)?;
				answered(self.install(asked).await?)
			}
			Operation::Status => {
				let asked: Named = read(payload)?;
				answered(self.status(asked).await?)
			}
		}
	}

	async fn search(&self, query: &str) -> Result<ApplicationSearch, ApplicationCallError> {
		let curated = matching(catalogue::curated()?, query);
		let (found, registry_failure) = match search(&self.registry, &self.directory, query).await {
			Ok(answered) => (answered.applications, answered.registry_failure),
			Err(failure) => (Vec::new(), Some(failure)),
		};
		Ok(ApplicationSearch {
			applications: curated.into_iter().chain(found).collect(),
			registry_failure,
			read_at: None,
			is_stale: None,
		})
	}

	async fn install(&self, asked: Named) -> Result<InstallOutcome, ApplicationCallError> {
		let scope = destination(&asked.scope)?;
		let owner = self.owner(scope).await?;
		if self.declared(&owner).await?.iter().any(|server| server.name == asked.application) {
			return Ok(InstallOutcome::AlreadyInstalled {
				application: asked.application,
				scope,
			});
		}
		let application = self.application(&asked.application).await?;
		let install = InstallCase::try_from(application.install.clone()).map_err(|refusal| {
			ApplicationCallError::ApplicationRefused {
				application: application.name.clone(),
				reason: refusal.reason,
			}
		})?;
		if let Some(refused) = refusal(&self.runners, &application.config).await {
			return Err(ApplicationCallError::ApplicationRefused {
				application: application.name,
				reason: refused.reason,
			});
		}
		self.declare(&owner, &application).await?;
		let draft = InstallDraft {
			conversation_id: self.conversation_id.clone(),
			application: application.name.clone(),
			title: application.title.clone(),
			logo: application.logo.clone(),
			scope,
			destination_id: destination_id(&owner),
			install: install.clone(),
		};
		self.announce(self.recorded(draft).await)?;
		Ok(InstallOutcome::Installed { application: application.name, scope, install })
	}

	async fn recorded(&self, draft: InstallDraft) -> ApplicationInstalled {
		match self.record(draft.clone()).await {
			Ok(recorded) => recorded.into(),
			Err(failure) => {
				eprintln!(
					"the install of {} in this conversation was not recorded: {failure:?}",
					draft.application
				);
				draft.into()
			}
		}
	}

	async fn record(&self, draft: InstallDraft) -> Result<ApplicationInstall, ApplicationCallError> {
		let state = self.state()?;
		Ok(ready(&state)?.application_installs().record(draft).await?)
	}

	async fn status(&self, asked: Named) -> Result<ApplicationState, ApplicationCallError> {
		let owner = self.owner(destination(&asked.scope)?).await?;
		let rows = mcp_application_status(self.app.clone(), owner).await?;
		Ok(rows
			.into_iter()
			.find(|row| row.name == asked.application)
			.map_or(ApplicationState::NotInstalled, |row| row.status.into()))
	}

	async fn application(&self, name: &str) -> Result<Application, ApplicationCallError> {
		named(&self.registry, &self.directory, name).await?.ok_or_else(|| {
			ApplicationCallError::UnknownApplication { application: name.to_owned() }
		})
	}

	async fn owner(&self, scope: Destination) -> Result<EnvOwner, ApplicationCallError> {
		match scope {
			Destination::User => Ok(EnvOwner::User),
			Destination::Space => Ok(EnvOwner::Space { id: self.space().await? }),
			Destination::Companion => {
				Ok(EnvOwner::Bot { id: self.bot_id.clone(), space_id: self.space().await? })
			}
		}
	}

	async fn declared(&self, owner: &EnvOwner) -> Result<Vec<McpServer>, ApplicationCallError> {
		let app = self.app.clone();
		Ok(match owner {
			EnvOwner::User => user_plugin_mcp_servers(app).await?,
			EnvOwner::Space { id } => conversation_space_mcp_servers(app, id.clone()).await?,
			EnvOwner::Bot { id, .. } => conversation_bot_mcp_servers(app, id.clone()).await?,
		})
	}

	async fn declare(
		&self,
		owner: &EnvOwner,
		application: &Application,
	) -> Result<McpServer, ApplicationCallError> {
		let app = self.app.clone();
		let name = application.name.clone();
		let config = application.config.clone();
		let mark = Some(mark_of(application));
		Ok(match owner {
			EnvOwner::User => user_plugin_set_mcp_server(app, name, config, mark).await?,
			EnvOwner::Space { id } => {
				conversation_set_space_mcp_server(app, id.clone(), name, config, mark).await?
			}
			EnvOwner::Bot { id, .. } => {
				conversation_set_bot_mcp_server(app, self.state()?, id.clone(), name, config, mark)
					.await?
			}
		})
	}

	async fn space(&self) -> Result<String, ApplicationCallError> {
		let state = self.state()?;
		let database = ready(&state)?;
		database.conversations().space(self.conversation_id.clone()).await?.ok_or_else(|| {
			ApplicationCallError::ConversationWithoutSpace {
				conversation_id: self.conversation_id.clone(),
			}
		})
	}

	fn announce(&self, installed: ApplicationInstalled) -> Result<(), ApplicationCallError> {
		self.app
			.emit(INSTALLED_EVENT, installed)
			.map_err(|error| ApplicationCallError::Undeliverable { detail: error.to_string() })
	}

	fn state(&self) -> Result<State<'_, db::DatabaseState>, ApplicationCallError> {
		self.app
			.try_state::<db::DatabaseState>()
			.ok_or_else(|| ApplicationCallError::Unexpected { detail: NO_DATABASE.to_owned() })
	}
}

impl<R: Runtime> HostRequests for ApplicationHost<R> {
	fn subtype(&self) -> &'static str {
		SUBTYPE
	}

	fn serve(&self, request: Value) -> Answering {
		let held = self.clone();
		Box::pin(async move { held.answer(request).await })
	}
}

#[derive(Debug, Deserialize)]
#[serde(tag = "subtype", rename_all = "camelCase")]
enum Asked {
	Application { operation: Operation, payload: Value },
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
enum Operation {
	Search,
	Install,
	Status,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Searched {
	query: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Named {
	application: String,
	scope: String,
}

fn destination(scope: &str) -> Result<Destination, ApplicationCallError> {
	match scope {
		"companion" => Ok(Destination::Companion),
		"space" => Ok(Destination::Space),
		"user" => Ok(Destination::User),
		unknown => Err(ApplicationCallError::UnknownScope { scope: unknown.to_owned() }),
	}
}

fn destination_id(owner: &EnvOwner) -> Option<String> {
	match owner {
		EnvOwner::Bot { id, .. } | EnvOwner::Space { id } => Some(id.clone()),
		EnvOwner::User => None,
	}
}

fn mark_of(application: &Application) -> ApplicationMark {
	ApplicationMark {
		title: Some(application.title.clone()),
		logo: application.logo.clone(),
		logo_url: application.logo_url.clone(),
	}
}

fn matching(curated: Vec<Application>, query: &str) -> Vec<Application> {
	let terms = terms(query);
	curated.into_iter().filter(|held| terms.iter().all(|term| answers_to(held, term))).collect()
}

fn answers_to(application: &Application, term: &str) -> bool {
	[&application.name, &application.title, &application.description]
		.iter()
		.any(|read| read.to_lowercase().contains(term))
}

fn read<T: serde::de::DeserializeOwned>(payload: Value) -> Result<T, ApplicationCallError> {
	serde_json::from_value(payload)
		.map_err(|error| ApplicationCallError::UnreadableRequest { detail: error.to_string() })
}

fn answered<T: Serialize>(answer: T) -> Result<Value, ApplicationCallError> {
	serde_json::to_value(answer)
		.map_err(|error| ApplicationCallError::Unexpected { detail: error.to_string() })
}

fn refused(error: ApplicationCallError) -> Value {
	serde_json::to_value(&error).unwrap_or_else(
		|failure| serde_json::json!({ "kind": "unexpected", "detail": failure.to_string() }),
	)
}

#[cfg(test)]
mod tests {
	use std::fs;
	use std::path::PathBuf;
	use std::sync::mpsc;
	use std::time::Duration;

	use serde_json::json;
	use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
	use tauri::{App, Listener as _};

	use super::*;
	use crate::applications::contract::ApplicationInstall;
	use crate::applications::directory::tests as directory_stub;
	use crate::applications::registry::tests::{holding, serving, unreached};
	use crate::applications::runnable::tests::a_path_carrying;
	use crate::applications::runnable::{NPX, UVX};
	use crate::bundles;
	use crate::mcp_oauth::commands::McpOauthState;
	use crate::mcp_oauth::reports::{ApplicationReports, Standing};

	const A_SPACE: &str = "
		INSERT INTO bots (id, name, model, created_at) VALUES ('b1', 'Shoto', 'sonnet', 1);
		INSERT INTO bot_spaces (bot_id, space_id, joined_at) VALUES ('b1', 'personal', 1);
		INSERT INTO conversations (id, kind, space_id, title, created_at, updated_at)
			VALUES ('c1', 'main', 'personal', 'Chat', 1, 1);
		INSERT INTO conversations (id, kind, title, created_at, updated_at)
			VALUES ('nowhere', 'main', 'Chat', 1, 1);
		INSERT INTO conversation_participants (conversation_id, bot_id, role, joined_at, join_seq)
			VALUES ('c1', 'b1', 'assistant', 1, 0), ('nowhere', 'b1', 'assistant', 1, 0);
	";

	const SCOPES: [&str; 3] = ["companion", "space", "user"];

	const NO_PACKAGE_REGISTRY: &str = "http://127.0.0.1:1";

	const NO_DIRECTORY: &str = "http://127.0.0.1:1";

	async fn a_host(name: &str) -> App<MockRuntime> {
		let mut context = mock_context(noop_assets());
		context.config_mut().identifier =
			format!("com.kiroshi.application-host-{name}-{}", std::process::id());
		let app = mock_builder().build(context).expect("the app builds");
		cleaned(&app);
		app.manage(db::bootstrap(app.handle()));
		app.manage(McpOauthState::default());
		app.manage(ApplicationReports::default());
		ready(&app.state::<db::DatabaseState>())
			.expect("the database opens")
			.call_mut(|connection| Ok(connection.execute_batch(A_SPACE)?))
			.await
			.expect("the space is planted");
		bundles::space::lay_down(app.handle(), "personal").expect("the space plugin lands");
		bundles::user::lay_down(&user_plugin(&app)).expect("the person plugin lands");
		app
	}

	fn cleaned(app: &App<MockRuntime>) {
		if let Ok(dir) = app.path().app_data_dir() {
			let _ = fs::remove_dir_all(&dir);
		}
	}

	fn user_plugin(app: &App<MockRuntime>) -> PathBuf {
		bundles::user::path(app.handle()).expect("the person plugin has a home")
	}

	fn space_plugin(app: &App<MockRuntime>) -> PathBuf {
		bundles::space::path(app.handle(), "personal").expect("the space plugin has a home")
	}

	fn reading(
		app: &App<MockRuntime>,
		conversation_id: &str,
		registry: String,
	) -> ApplicationHost<MockRuntime> {
		ApplicationHost {
			app: app.handle().clone(),
			conversation_id: conversation_id.to_owned(),
			bot_id: "b1".to_owned(),
			registry,
			runners: runners_carrying(&[NPX, UVX]),
			directory: Arc::new(Directory::at(NO_DIRECTORY.to_owned(), None)),
		}
	}

	fn runners_carrying(commands: &[&str]) -> Runners {
		Runners {
			path: a_path_carrying(commands),
			npm: NO_PACKAGE_REGISTRY.to_owned(),
			pypi: NO_PACKAGE_REGISTRY.to_owned(),
		}
	}

	fn a_collapsed_header_server() -> Value {
		json!({
			"name": "io.test/collapsed",
			"remotes": [{
				"type": "streamable-http",
				"url": "https://collapsed.test/mcp",
				"headers": [
					{ "name": "api-key", "isRequired": true, "isSecret": true },
					{ "name": "api_key", "isRequired": true, "isSecret": true },
				],
			}],
		})
	}

	fn asking(operation: &str, payload: Value) -> Value {
		json!({ "subtype": "application", "operation": operation, "payload": payload })
	}

	fn an_install(application: &str, scope: &str) -> Value {
		asking("install", json!({ "application": application, "scope": scope }))
	}

	fn a_status(application: &str, scope: &str) -> Value {
		asking("status", json!({ "application": application, "scope": scope }))
	}

	fn names(answer: &Value) -> Vec<&str> {
		answer["applications"]
			.as_array()
			.expect("the search lists applications")
			.iter()
			.map(|held| held["name"].as_str().expect("an application is named"))
			.collect()
	}

	fn declarations(app: &App<MockRuntime>) -> [Vec<(String, Value)>; 3] {
		let root = bundles::root(app.handle()).expect("the bundles have a root");
		[
			bundles::mcp_servers(&root, "b1"),
			bundles::space::mcp_servers(&space_plugin(app)),
			bundles::user::mcp_servers(&user_plugin(app)),
		]
		.map(|servers| servers.into_iter().map(|server| (server.name, server.config)).collect())
	}

	fn marks(app: &App<MockRuntime>) -> [Vec<(String, ApplicationMark)>; 3] {
		let root = bundles::root(app.handle()).expect("the bundles have a root");
		[
			bundles::mcp_servers(&root, "b1"),
			bundles::space::mcp_servers(&space_plugin(app)),
			bundles::user::mcp_servers(&user_plugin(app)),
		]
		.map(|servers| servers.into_iter().map(|server| (server.name, server.mark)).collect())
	}

	fn curated(name: &str) -> Application {
		catalogue::curated()
			.expect("the catalogue reads")
			.into_iter()
			.find(|held| held.name == name)
			.unwrap_or_else(|| panic!("{name} is curated"))
	}

	fn curated_mark(name: &str) -> ApplicationMark {
		mark_of(&curated(name))
	}

	fn curated_logo(name: &str) -> Option<String> {
		curated(name).logo
	}

	fn curated_config(name: &str) -> Value {
		curated(name).config
	}

	fn heard(app: &App<MockRuntime>) -> mpsc::Receiver<String> {
		let (announced, arriving) = mpsc::channel();
		app.listen(INSTALLED_EVENT, move |event| {
			announced.send(event.payload().to_owned()).expect("the test is listening");
		});
		arriving
	}

	#[tokio::test]
	async fn a_search_answers_the_curated_matches_before_the_directory_ones() {
		let app = a_host("curated-first").await;
		let (base, held) = serving(holding(vec!["com.notion/mcp"])).await;
		let (served, _) =
			directory_stub::serving(vec![directory_stub::a_page(&["superset-notes"])]).await;
		let host = ApplicationHost {
			directory: Arc::new(Directory::at(served, None)),
			..reading(&app, "c1", base)
		};

		let answer = host
			.answer(asking("search", json!({ "query": "superset" })))
			.await
			.expect("the search answers");

		assert_eq!(names(&answer), ["superset", "superset-notes"]);
		assert_eq!(answer["applications"][0]["install"]["kind"], "key");
		assert!(
			answer["applications"][0]["logo"].as_str().is_some_and(|logo| logo.starts_with("<svg")),
			"got {answer}"
		);
		assert!(answer.get("registryFailure").is_none(), "got {answer}");
		assert!(held.asked.lock().expect("the stub records").is_empty(), "the registry was read");
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_search_no_curated_application_matches_answers_the_registry_alone() {
		let app = a_host("registry-alone").await;
		let (base, _) = serving(holding(vec!["io.github.Digital-Defiance/mcp-filesystem"])).await;

		let answer = reading(&app, "c1", base)
			.answer(asking("search", json!({ "query": "filesystem" })))
			.await
			.expect("the search answers");

		assert_eq!(names(&answer), ["io.github.Digital-Defiance/mcp-filesystem"]);
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_search_no_remote_source_answers_gives_the_curated_matches_and_names_the_failure() {
		let app = a_host("registry-down").await;

		let answer = reading(&app, "c1", unreached().await)
			.answer(asking("search", json!({ "query": "superset" })))
			.await
			.expect("the search answers");

		assert_eq!(names(&answer), ["superset"]);
		assert_eq!(answer["registryFailure"]["kind"], "registryUnreached");
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_install_lands_in_the_mcp_json_of_its_scope_and_of_no_other() {
		for (at, scope) in SCOPES.iter().enumerate() {
			let app = a_host(&format!("lands-{scope}")).await;

			let answer = reading(&app, "c1", unreached().await)
				.answer(an_install("paper", scope))
				.await
				.expect("the install answers");

			assert_eq!(
				answer,
				json!({
					"outcome": "installed",
					"application": "paper",
					"scope": scope,
					"install": { "kind": "nothing" },
				})
			);
			for (held_at, declared) in declarations(&app).into_iter().enumerate() {
				let expected = if held_at == at {
					vec![("paper".to_owned(), curated_config("paper"))]
				} else {
					Vec::new()
				};
				assert_eq!(declared, expected, "installing in {scope}");
			}
			cleaned(&app);
		}
	}

	#[tokio::test]
	async fn an_install_keeps_the_mark_of_its_application_and_the_listing_answers_it_back() {
		for scope in SCOPES {
			let app = a_host(&format!("mark-{scope}")).await;

			reading(&app, "c1", unreached().await)
				.answer(an_install("paper", scope))
				.await
				.expect("the install answers");

			let kept: Vec<(String, ApplicationMark)> = marks(&app).into_iter().flatten().collect();

			assert_eq!(kept, [("paper".to_owned(), curated_mark("paper"))], "in {scope}");
			cleaned(&app);
		}
	}

	#[tokio::test]
	async fn a_key_install_answers_the_secret_still_needed_and_nothing_else_about_credentials() {
		let app = a_host("key").await;

		let answer = reading(&app, "c1", unreached().await)
			.answer(an_install("superset", "user"))
			.await
			.expect("the install answers");

		assert_eq!(answer["install"], json!({ "kind": "key", "secrets": ["SUPERSET_API_KEY"] }));
		cleaned(&app);
	}

	async fn recorded_in(app: &App<MockRuntime>, conversation_id: &str) -> Vec<ApplicationInstall> {
		ready(&app.state::<db::DatabaseState>())
			.expect("the database opens")
			.application_installs()
			.of_conversation(conversation_id.to_owned())
			.await
			.expect("the installs read")
	}

	fn without_moments(mut announced: Value) -> Value {
		let held = announced.as_object_mut().expect("the event is an object");
		held.remove("id");
		held.remove("createdAt");
		announced
	}

	#[tokio::test]
	async fn an_install_announces_the_row_it_wrote_and_the_conversation_it_came_from() {
		let app = a_host("announced").await;
		let arriving = heard(&app);
		let host = reading(&app, "c1", unreached().await);

		let mut announced = Vec::new();
		for scope in SCOPES {
			host.answer(an_install("superset", scope)).await.expect("the install answers");
			let payload =
				arriving.recv_timeout(Duration::from_secs(5)).expect("the event is announced");
			announced.push(serde_json::from_str::<Value>(&payload).expect("the event is JSON"));
		}

		let expected = |scope: &str, destination: Value| {
			let mut held = json!({
				"conversationId": "c1",
				"application": "superset",
				"title": "Superset",
				"logo": curated_logo("superset"),
				"scope": scope,
				"install": { "kind": "key", "secrets": ["SUPERSET_API_KEY"] },
				"lastMessageSeq": 0,
			});
			if let Some(id) = destination.as_str() {
				held["destinationId"] = json!(id);
			}
			held
		};
		assert_eq!(
			announced.iter().cloned().map(without_moments).collect::<Vec<_>>(),
			[
				expected("companion", json!("b1")),
				expected("space", json!("personal")),
				expected("user", Value::Null),
			]
		);
		let mut announced_ids = announced
			.iter()
			.map(|event| event["id"].as_str().expect("the event names its row").to_owned())
			.collect::<Vec<_>>();
		announced_ids.sort();
		let mut recorded_ids =
			recorded_in(&app, "c1").await.into_iter().map(|held| held.id).collect::<Vec<_>>();
		recorded_ids.sort();
		assert_eq!(
			announced_ids, recorded_ids,
			"the announced rows are not the rows that were written"
		);
		for event in &announced {
			assert!(event["createdAt"].as_i64().is_some_and(|held| held > 0), "got {event}");
		}
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_install_writes_one_row_carrying_the_application_the_destination_and_the_secret_name(
	) {
		let app = a_host("recorded").await;

		reading(&app, "c1", unreached().await)
			.answer(an_install("superset", "space"))
			.await
			.expect("the install answers");

		let recorded = recorded_in(&app, "c1").await;
		assert_eq!(recorded.len(), 1);
		let held = &recorded[0];
		assert_eq!(held.conversation_id, "c1");
		assert_eq!(held.application, "superset");
		assert_eq!(held.title, "Superset");
		assert_eq!(held.scope, Destination::Space);
		assert_eq!(held.destination_id.as_deref(), Some("personal"));
		assert_eq!(held.install, InstallCase::Key { secrets: vec!["SUPERSET_API_KEY".to_owned()] });
		assert_eq!(held.logo, curated_logo("superset"));
		assert_eq!(held.last_message_seq, 0);
		assert!(held.created_at > 0, "the row holds no moment");
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_install_the_scope_already_declared_writes_no_row() {
		let app = a_host("kept-no-row").await;
		bundles::space::set_mcp_server(
			&space_plugin(&app),
			"superset",
			&json!({ "type": "http", "url": "https://mine.test/mcp" }),
			None,
		)
		.expect("the declaration lands");

		reading(&app, "c1", unreached().await)
			.answer(an_install("superset", "space"))
			.await
			.expect("the install answers");

		assert_eq!(recorded_in(&app, "c1").await, Vec::new());
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_install_whose_row_cannot_be_written_still_answers_installed_and_names_no_row() {
		let app = a_host("unwritable-row").await;
		let arriving = heard(&app);

		let answer = reading(&app, "ghost", unreached().await)
			.answer(an_install("paper", "user"))
			.await
			.expect("the install answers");

		assert_eq!(answer["outcome"], "installed");
		let announced = serde_json::from_str::<Value>(
			&arriving.recv_timeout(Duration::from_secs(5)).expect("the event is announced"),
		)
		.expect("the event is JSON");
		assert_eq!(announced.get("id"), None, "got {announced}");
		assert_eq!(announced.get("lastMessageSeq"), None, "got {announced}");
		assert_eq!(announced["conversationId"], "ghost");
		assert_eq!(announced["application"], "paper");
		assert_eq!(recorded_in(&app, "ghost").await, Vec::new());
		cleaned(&app);
	}

	#[tokio::test]
	async fn every_install_of_a_conversation_is_recorded_and_a_conversation_with_none_reads_empty()
	{
		let app = a_host("read-installs").await;
		let host = reading(&app, "c1", unreached().await);
		for application in ["paper", "superset"] {
			host.answer(an_install(application, "user")).await.expect("the install answers");
		}

		let mut read = recorded_in(&app, "c1")
			.await
			.into_iter()
			.map(|held| held.application)
			.collect::<Vec<_>>();
		read.sort();

		assert_eq!(read, ["paper", "superset"]);
		assert_eq!(recorded_in(&app, "nowhere").await, Vec::new());
		cleaned(&app);
	}

	async fn searched(app: &App<MockRuntime>, query: &str) -> Value {
		let (base, _) = serving(holding(Vec::new())).await;
		reading(app, "c1", base)
			.answer(asking("search", json!({ "query": query })))
			.await
			.expect("the search answers")
	}

	#[tokio::test]
	async fn a_query_naming_what_an_application_does_answers_it_through_its_description() {
		let app = a_host("described").await;

		assert_eq!(names(&searched(&app, "designs").await), ["paper"]);
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_query_answers_only_the_applications_matching_every_term_of_three_characters_or_more()
	{
		let app = a_host("every-term").await;

		assert_eq!(names(&searched(&app, "run workspaces").await), ["superset"]);
		assert_eq!(names(&searched(&app, "write designs").await), ["paper"]);
		assert_eq!(names(&searched(&app, "workspaces designs").await), Vec::<&str>::new());
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_query_whose_every_term_is_discarded_answers_the_whole_catalogue() {
		let app = a_host("all-discarded").await;
		let everything: Vec<String> = catalogue::curated()
			.expect("the catalogue reads")
			.into_iter()
			.map(|held| held.name)
			.collect();

		assert_eq!(names(&searched(&app, "an my").await), everything);
		assert_eq!(names(&searched(&app, "").await), everything);
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_registry_install_reads_the_one_detail_and_runs_no_search() {
		let app = a_host("registry-install").await;
		let (base, held) = serving(holding(Vec::new())).await;

		let answer = reading(&app, "c1", base)
			.answer(an_install("com.notion/mcp", "space"))
			.await
			.expect("the install answers");

		assert_eq!(answer["outcome"], "installed");
		assert_eq!(answer["install"], json!({ "kind": "oauth" }));
		assert_eq!(declarations(&app)[1][0].0, "com.notion/mcp");
		assert!(held.asked.lock().expect("the stub records").is_empty(), "a search ran");
		assert_eq!(*held.detailed.lock().expect("the stub records"), ["com.notion/mcp"]);
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_scope_already_declaring_the_server_keeps_the_config_it_had() {
		let app = a_host("kept").await;
		let mine = json!({ "type": "http", "url": "https://mine.test/mcp" });
		bundles::space::set_mcp_server(&space_plugin(&app), "superset", &mine, None)
			.expect("the declaration lands");
		let arriving = heard(&app);

		let answer = reading(&app, "c1", unreached().await)
			.answer(an_install("superset", "space"))
			.await
			.expect("the install answers");

		assert_eq!(
			answer,
			json!({ "outcome": "alreadyInstalled", "application": "superset", "scope": "space" })
		);
		assert_eq!(declarations(&app)[1], [("superset".to_owned(), mine)]);
		assert!(arriving.recv_timeout(Duration::from_millis(200)).is_err(), "nothing is announced");
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_unknown_scope_is_refused_by_name_and_nothing_is_written() {
		let app = a_host("unknown-scope").await;

		let refusal = reading(&app, "c1", unreached().await)
			.answer(an_install("paper", "team"))
			.await
			.expect_err("the scope is refused");

		assert_eq!(refusal, json!({ "kind": "unknownScope", "scope": "team" }));
		assert_eq!(declarations(&app), [Vec::new(), Vec::new(), Vec::new()]);
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_application_neither_the_catalogue_nor_the_registry_answers_is_refused() {
		let app = a_host("unknown-application").await;
		let (base, held) = serving(holding(vec!["com.notion/mcp"])).await;

		for scope in SCOPES {
			let refusal = reading(&app, "c1", base.clone())
				.answer(an_install("io.test/nowhere", scope))
				.await
				.expect_err("the application is refused");

			assert_eq!(
				refusal,
				json!({ "kind": "unknownApplication", "application": "io.test/nowhere" })
			);
		}
		assert_eq!(declarations(&app), [Vec::new(), Vec::new(), Vec::new()]);
		assert!(held.asked.lock().expect("the stub records").is_empty(), "a search ran");
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_application_whose_install_refuses_it_is_named_and_neither_declared_nor_recorded() {
		let app = a_host("refusing-install").await;
		let (official, _) = serving(holding(Vec::new()).also(a_collapsed_header_server())).await;
		let arriving = heard(&app);

		let refusal = reading(&app, "c1", official)
			.answer(an_install("io.test/collapsed", "space"))
			.await
			.expect_err("the application is refused");

		assert_eq!(refusal["kind"], "applicationRefused");
		assert_eq!(refusal["application"], "io.test/collapsed");
		let reason = refusal["reason"].as_str().expect("the refusal carries a reason");
		assert!(reason.contains("api_key"), "got {reason}");
		assert_eq!(declarations(&app), [Vec::new(), Vec::new(), Vec::new()]);
		assert!(recorded_in(&app, "c1").await.is_empty(), "an install was recorded");
		assert!(arriving.recv_timeout(Duration::from_millis(200)).is_err(), "it was announced");
		cleaned(&app);
	}

	#[tokio::test]
	async fn an_install_of_a_config_no_runner_of_this_machine_runs_is_refused_and_writes_nothing() {
		let app = a_host("no-runner").await;
		let (official, _) = serving(holding(Vec::new())).await;
		let arriving = heard(&app);
		let host = ApplicationHost {
			runners: runners_carrying(&[UVX]),
			..reading(&app, "c1", official)
		};

		let refusal = host
			.answer(an_install("io.github.Digital-Defiance/mcp-filesystem", "space"))
			.await
			.expect_err("the install is refused");

		assert_eq!(refusal["kind"], "applicationRefused");
		assert_eq!(refusal["application"], "io.github.Digital-Defiance/mcp-filesystem");
		let reason = refusal["reason"].as_str().expect("the refusal carries a reason");
		assert!(reason.contains(NPX), "got {reason}");
		assert_eq!(declarations(&app), [Vec::new(), Vec::new(), Vec::new()]);
		assert!(recorded_in(&app, "c1").await.is_empty(), "an install was recorded");
		assert!(arriving.recv_timeout(Duration::from_millis(200)).is_err(), "it was announced");
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_companion_or_space_install_from_a_conversation_in_no_space_is_refused() {
		let app = a_host("no-space").await;

		for scope in ["companion", "space"] {
			let refusal = reading(&app, "nowhere", unreached().await)
				.answer(an_install("paper", scope))
				.await
				.expect_err("the conversation is refused");

			assert_eq!(
				refusal,
				json!({ "kind": "conversationWithoutSpace", "conversationId": "nowhere" })
			);
		}
		assert_eq!(declarations(&app), [Vec::new(), Vec::new(), Vec::new()]);
		cleaned(&app);
	}

	#[tokio::test]
	async fn the_status_tells_apart_not_installed_connected_needs_authorization_and_failed() {
		let app = a_host("status").await;
		let (official, _) = serving(holding(vec!["com.notion/mcp"])).await;
		let host = reading(&app, "c1", official);
		for application in ["superset", "paper"] {
			host.answer(an_install(application, "companion")).await.expect("the install answers");
		}
		let from_the_registry =
			host.answer(an_install("com.notion/mcp", "user")).await.expect("the install answers");
		assert_eq!(from_the_registry["install"], json!({ "kind": "oauth" }));
		let reports = app.state::<ApplicationReports>();
		reports.record("b1", "superset", Standing::Holding);
		reports.record("b1", "paper", Standing::LeftOut { reason: Some("refused".to_owned()) });

		let read = |application: &'static str, scope: &'static str| {
			let host = host.clone();
			async move { host.answer(a_status(application, scope)).await.expect("the status reads") }
		};

		assert_eq!(read("superset", "space").await, json!({ "status": "notInstalled" }));
		assert_eq!(read("superset", "companion").await, json!({ "status": "connected" }));
		assert_eq!(read("com.notion/mcp", "user").await, json!({ "status": "needsAuthorization" }));
		assert_eq!(
			read("paper", "companion").await,
			json!({ "status": "failed", "reason": "refused" })
		);
		cleaned(&app);
	}

	#[tokio::test]
	async fn a_status_in_an_unknown_scope_is_refused_by_name() {
		let app = a_host("status-unknown-scope").await;

		let refusal = reading(&app, "c1", unreached().await)
			.answer(a_status("superset", "team"))
			.await
			.expect_err("the scope is refused");

		assert_eq!(refusal, json!({ "kind": "unknownScope", "scope": "team" }));
		cleaned(&app);
	}
}
