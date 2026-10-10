use std::io::ErrorKind;
use std::ops::Deref;
use std::path::PathBuf;
use std::time::Duration;

use tauri::test::{mock_context, noop_assets, MockRuntime};
use tauri::{App, Builder, Manager};

const REMOVALS_WHILE_A_LATE_WRITE_LANDS: usize = 10;

const PAUSE_FOR_A_LATE_WRITE: Duration = Duration::from_millis(50);

pub struct AppOfItsOwn {
	app: App<MockRuntime>,
	_folder: FolderOfItsOwn,
}

struct FolderOfItsOwn(PathBuf);

impl Deref for AppOfItsOwn {
	type Target = App<MockRuntime>;

	fn deref(&self) -> &Self::Target {
		&self.app
	}
}

impl Drop for FolderOfItsOwn {
	fn drop(&mut self) {
		let mut removal = std::fs::remove_dir_all(&self.0);
		for _ in 1..REMOVALS_WHILE_A_LATE_WRITE_LANDS {
			match &removal {
				Err(failure) if failure.kind() == ErrorKind::DirectoryNotEmpty => {
					std::thread::sleep(PAUSE_FOR_A_LATE_WRITE);
					removal = std::fs::remove_dir_all(&self.0);
				}
				_ => break,
			}
		}
		if let Err(failure) = removal {
			if failure.kind() != ErrorKind::NotFound {
				eprintln!("the test data folder was not removed: {failure}");
			}
		}
	}
}

pub fn an_app_of_its_own(name: &str, builder: Builder<MockRuntime>) -> AppOfItsOwn {
	let mut context = mock_context(noop_assets());
	context.config_mut().identifier = format!("com.kiroshi.{name}-{}", uuid::Uuid::new_v4());
	let app = builder.build(context).expect("the app builds");
	let folder = FolderOfItsOwn(app.path().app_data_dir().expect("the data folder resolves"));
	AppOfItsOwn { app, _folder: folder }
}
