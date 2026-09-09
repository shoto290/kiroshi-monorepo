use serde::Serialize;

use crate::agent::contract::TransportError;
use crate::agent::protocol::{OauthFailure, OauthFailureKind};
use crate::environment::contract::EnvError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OauthError {
	AlreadyRunning,
	Cancelled,
	TimedOut,
	#[serde(rename_all = "camelCase")]
	Denied {
		detail: String,
	},
	#[serde(rename_all = "camelCase")]
	BrowserRefused {
		url: String,
	},
	#[serde(rename_all = "camelCase")]
	Failed {
		detail: String,
	},
	#[serde(rename_all = "camelCase")]
	Transport {
		error: TransportError,
	},
	#[serde(rename_all = "camelCase")]
	Store {
		error: EnvError,
	},
}

const NO_DETAIL: &str = "the authorization flow named no reason";

impl From<TransportError> for OauthError {
	fn from(error: TransportError) -> Self {
		Self::Transport { error }
	}
}

impl From<EnvError> for OauthError {
	fn from(error: EnvError) -> Self {
		Self::Store { error }
	}
}

impl From<OauthFailure> for OauthError {
	fn from(failure: OauthFailure) -> Self {
		let detail = || failure.detail.clone().unwrap_or_else(|| NO_DETAIL.to_owned());
		match failure.kind {
			OauthFailureKind::Cancelled => Self::Cancelled,
			OauthFailureKind::TimedOut => Self::TimedOut,
			OauthFailureKind::Denied => Self::Denied { detail: detail() },
			OauthFailureKind::Busy => Self::AlreadyRunning,
			OauthFailureKind::Failed => Self::Failed { detail: detail() },
		}
	}
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Disconnected {
	pub revoked: bool,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub detail: Option<String>,
}

#[cfg(test)]
mod tests {
	use serde_json::{json, to_value};

	use super::*;

	#[test]
	fn a_refusal_of_a_second_flow_crosses_as_its_own_kind() {
		assert_eq!(
			to_value(OauthError::AlreadyRunning).expect("the error serializes"),
			json!({ "kind": "alreadyRunning" })
		);
	}

	#[test]
	fn a_browser_that_would_not_open_crosses_with_the_url_the_person_needs() {
		assert_eq!(
			to_value(OauthError::BrowserRefused {
				url: "https://example.test/authorize".to_owned()
			})
			.expect("the error serializes"),
			json!({ "kind": "browserRefused", "url": "https://example.test/authorize" })
		);
	}

	#[test]
	fn a_store_that_refused_the_write_carries_the_store_error_it_gave() {
		assert_eq!(
			to_value(OauthError::Store {
				error: EnvError::Unwritable { detail: "the disk is full".to_owned() }
			})
			.expect("the error serializes"),
			json!({
				"kind": "store",
				"error": { "kind": "unwritable", "detail": "the disk is full" }
			})
		);
	}

	#[test]
	fn every_failure_the_sidecar_names_becomes_a_kind_of_its_own() {
		let refused = |kind| OauthError::from(OauthFailure { kind, detail: None });

		assert_eq!(refused(OauthFailureKind::Cancelled), OauthError::Cancelled);
		assert_eq!(refused(OauthFailureKind::TimedOut), OauthError::TimedOut);
		assert_eq!(refused(OauthFailureKind::Busy), OauthError::AlreadyRunning);
		assert_eq!(
			OauthError::from(OauthFailure {
				kind: OauthFailureKind::Denied,
				detail: Some("access_denied".to_owned())
			}),
			OauthError::Denied { detail: "access_denied".to_owned() }
		);
	}

	#[test]
	fn a_disconnect_that_revoked_nothing_says_why_without_naming_a_token() {
		assert_eq!(
			to_value(Disconnected {
				revoked: false,
				detail: Some(
					"the authorization server advertises no revocation endpoint".to_owned()
				)
			})
			.expect("the answer serializes"),
			json!({
				"revoked": false,
				"detail": "the authorization server advertises no revocation endpoint"
			})
		);
	}
}
