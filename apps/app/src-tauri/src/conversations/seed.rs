use std::path::Path;

use tauri::{AppHandle, Runtime};

use super::commands::create_bundled_bot;
use super::contract::{AvatarAnimal, BotIdentity, TranscriptStoreError};
use crate::avatars;
use crate::bundles;
use crate::bundles::shoto;
use crate::db;
use crate::db::repositories::conversations::DEFAULT_BOT_MODEL;
use crate::db::DatabaseError;

const PERSONAL_SPACE_ID: &str = "personal";

#[derive(Debug)]
enum Refusal {
	NoAvatarsDir,
	NoBundleRoot,
	NoPersonalSpace,
	Picture(avatars::Rejection),
	Bundle(std::io::Error),
	Store(TranscriptStoreError),
	Database(DatabaseError),
}

impl Refusal {
	fn reason(&self) -> String {
		match self {
			Refusal::NoAvatarsDir => "the avatars directory is unknown".to_owned(),
			Refusal::NoBundleRoot => "the bundle root is unknown".to_owned(),
			Refusal::NoPersonalSpace => "the personal space is missing".to_owned(),
			Refusal::Picture(rejection) => format!("its picture was refused: {rejection:?}"),
			Refusal::Bundle(failure) => format!("its bundle was not written: {failure}"),
			Refusal::Store(failure) => format!("the store refused: {failure:?}"),
			Refusal::Database(failure) => format!("the database refused: {failure:?}"),
		}
	}
}

impl From<avatars::Rejection> for Refusal {
	fn from(rejection: avatars::Rejection) -> Self {
		Refusal::Picture(rejection)
	}
}

impl From<std::io::Error> for Refusal {
	fn from(error: std::io::Error) -> Self {
		Refusal::Bundle(error)
	}
}

impl From<TranscriptStoreError> for Refusal {
	fn from(error: TranscriptStoreError) -> Self {
		Refusal::Store(error)
	}
}

impl From<DatabaseError> for Refusal {
	fn from(error: DatabaseError) -> Self {
		Refusal::Database(error)
	}
}

pub(super) async fn plant_first_companion<R: Runtime>(app: &AppHandle<R>, database: &db::Database) {
	match database.user().is_first_companion_seeded().await {
		Ok(true) => return,
		Ok(false) => {}
		Err(failure) => return report(&Refusal::Database(failure)),
	}
	if let Err(refusal) = plant(app, database).await {
		report(&refusal);
	}
}

async fn plant<R: Runtime>(app: &AppHandle<R>, database: &db::Database) -> Result<(), Refusal> {
	let dir = avatars::dir(app).ok_or(Refusal::NoAvatarsDir)?;
	let root = bundles::root(app).ok_or(Refusal::NoBundleRoot)?;
	if !holds_personal_space(database).await? {
		return Err(Refusal::NoPersonalSpace);
	}
	let picture = avatars::picture::normalised(shoto::AVATAR)?;
	let path = avatars::minted_path(&dir);
	avatars::write(&path, &picture)?;

	let created = create_bundled_bot(app, database, identity(&path), space()).await?;
	match furnished(&root, database, &created.id).await {
		Ok(()) => Ok(()),
		Err(refusal) => {
			let _ = database.conversations().delete_bot(created.id).await;
			avatars::sweep_referenced(database, Some(dir.as_path())).await;
			Err(refusal)
		}
	}
}

async fn furnished(root: &Path, database: &db::Database, bot_id: &str) -> Result<(), Refusal> {
	let stored = database
		.conversations()
		.bot(bot_id.to_owned())
		.await
		.map_err(|failure| Refusal::Store(failure.into()))?
		.ok_or_else(|| {
			Refusal::Store(TranscriptStoreError::UnknownBot { id: bot_id.to_owned() })
		})?;
	bundles::write_skills(root, &stored, &shoto::SKILLS)?;
	Ok(database.user().mark_first_companion_seeded().await?)
}

async fn holds_personal_space(database: &db::Database) -> Result<bool, DatabaseError> {
	Ok(database.spaces().list().await?.iter().any(|space| space.id == PERSONAL_SPACE_ID))
}

fn space() -> Option<String> {
	Some(PERSONAL_SPACE_ID.to_owned())
}

fn identity(picture: &Path) -> BotIdentity {
	BotIdentity {
		name: shoto::NAME.to_owned(),
		title: String::new(),
		model: DEFAULT_BOT_MODEL.to_owned(),
		avatar_animal: AvatarAnimal::Cat,
		avatar_blot: None,
		avatar_image_path: Some(picture.to_string_lossy().into_owned()),
		working_dir: None,
		instructions: shoto::persona(),
		denied_tools: Vec::new(),
		permissions: bundles::BotPermissions::default(),
		output_style: bundles::DEFAULT_OUTPUT_STYLE.to_owned(),
	}
}

fn report(refusal: &Refusal) {
	eprintln!("{} was not planted at first launch: {}", shoto::NAME, refusal.reason());
}

#[cfg(test)]
mod tests {
	use std::fs;
	use std::path::PathBuf;

	use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
	use tauri::{App, Manager};

	use super::*;
	use crate::db::repositories::conversations::Bot as StoredBot;

	fn a_host(name: &str) -> App<MockRuntime> {
		let mut context = mock_context(noop_assets());
		context.config_mut().identifier =
			format!("com.kiroshi.conversation-seed-{name}-{}", std::process::id());
		let app = mock_builder().build(context).expect("the app builds");
		if let Ok(dir) = app.path().app_data_dir() {
			let _ = fs::remove_dir_all(&dir);
		}
		app.manage(db::bootstrap(app.handle()));
		app
	}

	fn database_of(app: &App<MockRuntime>) -> &db::Database {
		app.state::<db::DatabaseState>().inner().as_ref().expect("the database opens")
	}

	async fn planted(app: &App<MockRuntime>, database: &db::Database) -> Vec<StoredBot> {
		plant_first_companion(app.handle(), database).await;
		database.conversations().bots(space()).await.expect("the roster reads")
	}

	fn bundle_of(app: &App<MockRuntime>, bot: &StoredBot) -> PathBuf {
		bundles::dir(&bundles::root(app.handle()).expect("the bundle root"), &bot.id)
	}

	fn skill_body(bundle: &Path, id: &str) -> Vec<u8> {
		fs::read(bundle.join("skills").join(id).join("SKILL.md")).expect("the skill reads")
	}

	#[tokio::test]
	async fn a_fresh_install_opens_with_shoto_in_the_personal_space() {
		let app = a_host("fresh");
		let database = database_of(&app);

		let roster = planted(&app, database).await;

		let shoto = roster.first().expect("Shoto is planted");
		assert_eq!(roster.len(), 1);
		assert_eq!(shoto.name, shoto::NAME);
		assert_eq!(shoto.instructions, shoto::persona());
		assert_eq!(shoto.avatar_blot, None);
		assert!(database.user().is_first_companion_seeded().await.expect("the marker"));
	}

	#[tokio::test]
	async fn the_picture_shoto_wears_is_the_embedded_one_the_pipeline_answered() {
		let app = a_host("picture");
		let database = database_of(&app);
		let dir = avatars::dir(app.handle()).expect("the avatars directory");

		let roster = planted(&app, database).await;

		let recorded = roster[0].avatar_image_path.as_deref().expect("a picture is recorded");
		let path = avatars::readable(&dir, recorded).expect("the picture sits in the directory");
		assert_eq!(
			fs::read(path).expect("the picture reads"),
			avatars::picture::normalised(shoto::AVATAR).expect("the picture is accepted")
		);
	}

	#[tokio::test]
	async fn the_bundle_carries_the_four_skills_byte_for_byte_and_an_agent_holding_the_persona() {
		let app = a_host("bundle");
		let database = database_of(&app);

		let roster = planted(&app, database).await;

		let bundle = bundle_of(&app, &roster[0]);
		for (id, body) in shoto::SKILLS {
			assert_eq!(skill_body(&bundle, id), body, "the skill {id} was rewritten");
		}
		let agent = fs::read_to_string(bundle.join("agents").join("agent.md"))
			.expect("the agent file reads");
		assert!(agent.contains(&shoto::persona()), "the agent file lost the persona");
		assert_eq!(bundles::skills_at(&bundle).len(), shoto::SKILLS.len());
	}

	#[tokio::test]
	async fn a_second_launch_plants_nothing_and_a_deleted_shoto_stays_deleted() {
		let app = a_host("again");
		let database = database_of(&app);
		let roster = planted(&app, database).await;

		assert_eq!(planted(&app, database).await.len(), 1, "a second Shoto was planted");

		database.conversations().delete_bot(roster[0].id.clone()).await.expect("the deletion");
		assert_eq!(planted(&app, database).await.len(), 0, "a deleted Shoto came back");
	}

	#[tokio::test]
	async fn without_the_personal_space_nothing_is_planted_and_the_marker_stays_absent() {
		let app = a_host("spaceless");
		let database = database_of(&app);
		database.spaces().create("Work".to_owned()).await.expect("the second space");
		database.spaces().delete(PERSONAL_SPACE_ID.to_owned()).await.expect("the deletion");

		plant_first_companion(app.handle(), database).await;

		assert_eq!(database.conversations().bots(None).await.expect("the roster").len(), 0);
		assert!(!database.user().is_first_companion_seeded().await.expect("the marker"));
	}

	#[tokio::test]
	async fn a_bundle_that_cannot_be_written_leaves_no_row_no_picture_and_no_marker() {
		let app = a_host("unwritable");
		let database = database_of(&app);
		let root = bundles::root(app.handle()).expect("the bundle root");
		fs::create_dir_all(root.parent().expect("a parent")).expect("the data directory stands");
		fs::write(&root, b"not a directory").expect("the file stands where the bundles go");

		plant_first_companion(app.handle(), database).await;

		assert_eq!(database.conversations().bots(None).await.expect("the roster").len(), 0);
		assert!(!database.user().is_first_companion_seeded().await.expect("the marker"));
		let dir = avatars::dir(app.handle()).expect("the avatars directory");
		assert_eq!(fs::read_dir(&dir).expect("the directory reads").count(), 0);
	}
}
