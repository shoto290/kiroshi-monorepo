use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

use super::cors::WEB_ORIGIN;
use crate::private_files;

const HOST_DIR: &str = "host";

const TOKEN_NAME: &str = "token";

const WEB_LINK_NAME: &str = "web-link.txt";

const RANDOM_PARTS: usize = 3;

#[derive(Debug)]
pub enum TokenError {
	NoDataDir,
	Unreadable(std::io::Error),
	Unwritable(std::io::Error),
	Blank,
}

pub struct HostToken(String);

impl HostToken {
	pub fn bearer(&self) -> &str {
		&self.0
	}

	pub fn admits(&self, presented: &str) -> bool {
		let expected = self.0.as_bytes();
		let presented = presented.as_bytes();
		let differing = expected
			.iter()
			.zip(presented)
			.fold(expected.len() ^ presented.len(), |held, (a, b)| held | usize::from(a ^ b));
		std::hint::black_box(differing) == 0
	}
}

fn host_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, TokenError> {
	let data = app.path().app_data_dir().map_err(|_| TokenError::NoDataDir)?;
	Ok(data.join(HOST_DIR))
}

fn path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, TokenError> {
	Ok(host_dir(app)?.join(TOKEN_NAME))
}

pub fn web_link_written<R: Runtime>(
	app: &AppHandle<R>,
	token: &HostToken,
	port: u16,
) -> Result<String, TokenError> {
	let path = host_dir(app)?.join(WEB_LINK_NAME);
	let link = web_link(token, port);
	private_files::replace_atomically(&path, format!("{link}\n").as_bytes())
		.map_err(TokenError::Unwritable)?;
	Ok(link)
}

pub fn web_link_removed<R: Runtime>(app: &AppHandle<R>) -> Result<(), TokenError> {
	match fs::remove_file(host_dir(app)?.join(WEB_LINK_NAME)) {
		Err(missing) if missing.kind() == ErrorKind::NotFound => Ok(()),
		removed => removed.map_err(TokenError::Unwritable),
	}
}

fn web_link(token: &HostToken, port: u16) -> String {
	format!("{WEB_ORIGIN}/#host=http://127.0.0.1:{port}&token={}", token.0)
}

pub fn loaded<R: Runtime>(app: &AppHandle<R>) -> Result<HostToken, TokenError> {
	let path = path(app)?;
	match fs::read_to_string(&path) {
		Ok(held) => held_token(&held),
		Err(missing) if missing.kind() == ErrorKind::NotFound => written(&path),
		Err(failure) => Err(TokenError::Unreadable(failure)),
	}
}

fn held_token(held: &str) -> Result<HostToken, TokenError> {
	match held.trim() {
		"" => Err(TokenError::Blank),
		token => Ok(HostToken(token.to_owned())),
	}
}

fn written(path: &Path) -> Result<HostToken, TokenError> {
	let token = fresh();
	private_files::replace_atomically(path, token.as_bytes()).map_err(TokenError::Unwritable)?;
	Ok(HostToken(token))
}

fn fresh() -> String {
	(0..RANDOM_PARTS).map(|_| Uuid::new_v4().simple().to_string()).collect()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_fresh_token_carries_at_least_32_bytes() {
		assert!(fresh().len() >= 32);
		assert_ne!(fresh(), fresh());
	}

	#[test]
	fn only_the_exact_token_is_admitted() {
		let token = HostToken("abc".to_owned());
		assert!(token.admits("abc"));
		assert!(!token.admits("abd"));
		assert!(!token.admits("ab"));
		assert!(!token.admits("abcd"));
		assert!(!token.admits(""));
	}

	#[test]
	fn the_web_link_names_the_dev_server_the_host_and_the_token() {
		let token = HostToken("abc".to_owned());
		assert_eq!(
			web_link(&token, 45367),
			"http://127.0.0.1:1420/#host=http://127.0.0.1:45367&token=abc"
		);
	}

	#[test]
	fn a_blank_file_holds_no_token() {
		assert!(matches!(held_token(" \n"), Err(TokenError::Blank)));
	}
}
