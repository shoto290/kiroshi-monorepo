use std::time::Duration;

use reqwest::{Client, RequestBuilder, StatusCode};
use serde_json::json;

use super::contract::KiroshiAccount;
use crate::missions::github::installed_tls_provider;

pub const PRODUCTION_API_URL: &str = "https://kiroshi-cloud-api.onrender.com";

const API_URL_OVERRIDE: &str = "KIROSHI_API_URL";

const MAGIC_LINK_PATH: &str = "/api/auth/sign-in/magic-link";

const ME_PATH: &str = "/me";

const SIGN_OUT_PATH: &str = "/api/auth/sign-out";

const REQUEST_BOUND: Duration = Duration::from_secs(20);

pub fn api_url() -> String {
	match std::env::var(API_URL_OVERRIDE) {
		Ok(overridden) if cfg!(debug_assertions) => overridden,
		_ => PRODUCTION_API_URL.to_owned(),
	}
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MeError {
	Revoked,
	Unreachable(String),
}

#[derive(Debug, Clone)]
pub struct Cloud {
	base: String,
}

impl Cloud {
	pub fn new(base: &str) -> Self {
		Self { base: base.trim_end_matches('/').to_owned() }
	}

	pub async fn request_magic_link(&self, email: &str, callback_url: &str) -> Result<(), String> {
		let body = json!({ "email": email, "callbackURL": callback_url });
		self.sent(|client| client.post(self.at(MAGIC_LINK_PATH)).json(&body)).await.map(drop)
	}

	pub async fn me(&self, bearer: &str) -> Result<KiroshiAccount, MeError> {
		let answered = self
			.answered(|client| client.get(self.at(ME_PATH)).bearer_auth(bearer))
			.await
			.map_err(MeError::Unreachable)?;
		if answered.status() == StatusCode::UNAUTHORIZED {
			return Err(MeError::Revoked);
		}
		let answered = successful(answered).map_err(MeError::Unreachable)?;
		answered.json::<KiroshiAccount>().await.map_err(|error| {
			MeError::Unreachable(format!(
				"the account answered by the cloud did not parse: {error}"
			))
		})
	}

	pub async fn sign_out(&self, bearer: &str) -> Result<(), String> {
		self.sent(|client| client.post(self.at(SIGN_OUT_PATH)).bearer_auth(bearer)).await.map(drop)
	}

	fn at(&self, path: &str) -> String {
		format!("{}{path}", self.base)
	}

	async fn sent(
		&self,
		request: impl FnOnce(&Client) -> RequestBuilder,
	) -> Result<reqwest::Response, String> {
		successful(self.answered(request).await?)
	}

	async fn answered(
		&self,
		request: impl FnOnce(&Client) -> RequestBuilder,
	) -> Result<reqwest::Response, String> {
		installed_tls_provider();
		let client = Client::builder()
			.timeout(REQUEST_BOUND)
			.build()
			.map_err(|error| format!("the cloud client could not be built: {error}"))?;
		request(&client)
			.send()
			.await
			.map_err(|error| format!("the cloud could not be reached: {}", error.without_url()))
	}
}

fn successful(answered: reqwest::Response) -> Result<reqwest::Response, String> {
	let status = answered.status();
	if status.is_success() {
		return Ok(answered);
	}
	Err(format!("the cloud answered {status}"))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn the_base_url_loses_its_trailing_slash() {
		assert_eq!(Cloud::new("http://127.0.0.1:9/").at(ME_PATH), "http://127.0.0.1:9/me");
	}
}
