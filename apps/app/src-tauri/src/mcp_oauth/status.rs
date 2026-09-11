use serde::Serialize;

use super::credentials;
use super::reports::Standing;
use crate::environment::contract::{
	EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN,
};

const REDACTED: &str = "[redacted]";

const SECRET_NAMES: [&str; 3] = [OAUTH_ACCESS_TOKEN, OAUTH_REFRESH_TOKEN, OAUTH_CLIENT_SECRET];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorRow {
	pub name: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub scope: Option<EnvScope>,
	#[serde(flatten)]
	pub status: ConnectorStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ConnectorStatus {
	Connected,
	NeedsAuthorization,
	Connecting,
	Failed {
		#[serde(skip_serializing_if = "Option::is_none")]
		reason: Option<String>,
	},
	Unknown,
}

pub struct Evidence {
	pub is_authorizing: bool,
	pub reported: Option<Standing>,
	pub held: Values,
	pub declares_url: bool,
}

pub fn status(evidence: Evidence, now: i64) -> ConnectorStatus {
	if evidence.is_authorizing {
		return ConnectorStatus::Connecting;
	}
	match evidence.reported {
		Some(Standing::Holding) => ConnectorStatus::Connected,
		Some(Standing::NeedsAuth) => ConnectorStatus::NeedsAuthorization,
		Some(Standing::LeftOut { reason }) => ConnectorStatus::Failed {
			reason: reason.map(|reason| scrubbed(reason, &evidence.held)),
		},
		None => stored_status(&evidence.held, evidence.declares_url, now),
	}
}

fn stored_status(held: &Values, declares_url: bool, now: i64) -> ConnectorStatus {
	let holds_a_live_token = held.contains_key(OAUTH_ACCESS_TOKEN)
		&& credentials::expires_at(held).is_none_or(|expires_at| expires_at > now);
	match (holds_a_live_token, declares_url) {
		(true, _) => ConnectorStatus::Connected,
		(false, true) => ConnectorStatus::NeedsAuthorization,
		(false, false) => ConnectorStatus::Unknown,
	}
}

fn scrubbed(reason: String, held: &Values) -> String {
	SECRET_NAMES
		.iter()
		.filter_map(|name| held.get(*name))
		.filter(|secret| !secret.is_empty())
		.fold(reason, |reason, secret| reason.replace(secret.as_str(), REDACTED))
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::environment::contract::{OAUTH_CLIENT_ID, OAUTH_EXPIRES_AT};

	const NOW: i64 = 1_800_000_000_000;

	fn a_grant(expires_at: Option<i64>) -> Values {
		let mut held: Values = [
			(OAUTH_ACCESS_TOKEN.to_owned(), "held-access".to_owned()),
			(OAUTH_REFRESH_TOKEN.to_owned(), "held-refresh".to_owned()),
			(OAUTH_CLIENT_ID.to_owned(), "registered".to_owned()),
			(OAUTH_CLIENT_SECRET.to_owned(), "held-secret".to_owned()),
		]
		.into();
		if let Some(at) = expires_at {
			held.insert(OAUTH_EXPIRES_AT.to_owned(), at.to_string());
		}
		held
	}

	fn unreported(held: Values, declares_url: bool) -> Evidence {
		Evidence { is_authorizing: false, reported: None, held, declares_url }
	}

	fn reported(standing: Standing) -> Evidence {
		Evidence {
			is_authorizing: false,
			reported: Some(standing),
			held: a_grant(Some(NOW + 1)),
			declares_url: true,
		}
	}

	#[test]
	fn a_running_flow_reads_as_connecting_over_every_other_answer() {
		let evidence = Evidence { is_authorizing: true, ..reported(Standing::NeedsAuth) };

		assert_eq!(status(evidence, NOW), ConnectorStatus::Connecting);
	}

	#[test]
	fn the_last_state_a_session_reported_decides_the_answer() {
		assert_eq!(status(reported(Standing::Holding), NOW), ConnectorStatus::Connected);
		assert_eq!(status(reported(Standing::NeedsAuth), NOW), ConnectorStatus::NeedsAuthorization);
		assert_eq!(
			status(reported(Standing::LeftOut { reason: Some("it read failed".to_owned()) }), NOW),
			ConnectorStatus::Failed { reason: Some("it read failed".to_owned()) }
		);
	}

	#[test]
	fn with_no_report_a_live_token_reads_as_connected() {
		assert_eq!(status(unreported(a_grant(None), true), NOW), ConnectorStatus::Connected);
		assert_eq!(
			status(unreported(a_grant(Some(NOW + 1)), false), NOW),
			ConnectorStatus::Connected
		);
	}

	#[test]
	fn with_no_report_a_url_server_holding_no_live_token_needs_authorization() {
		assert_eq!(
			status(unreported(Values::new(), true), NOW),
			ConnectorStatus::NeedsAuthorization
		);
		assert_eq!(
			status(unreported(a_grant(Some(NOW)), true), NOW),
			ConnectorStatus::NeedsAuthorization
		);
	}

	#[test]
	fn with_no_report_a_server_declaring_no_url_and_holding_no_live_token_is_unknown() {
		assert_eq!(status(unreported(Values::new(), false), NOW), ConnectorStatus::Unknown);
		assert_eq!(status(unreported(a_grant(Some(NOW)), false), NOW), ConnectorStatus::Unknown);
	}

	#[test]
	fn a_row_names_no_access_token_no_refresh_token_and_no_client_secret() {
		let quoting = Standing::LeftOut {
			reason: Some("it answered held-access, held-refresh and held-secret".to_owned()),
		};
		let rows = [
			ConnectorRow {
				name: "granola".to_owned(),
				scope: None,
				status: status(reported(quoting), NOW),
			},
			ConnectorRow {
				name: "notion".to_owned(),
				scope: None,
				status: status(unreported(a_grant(None), true), NOW),
			},
		];

		let crossed = serde_json::to_string(&rows).expect("the rows serialize");

		assert_eq!(
			serde_json::to_value(&rows[0]).expect("the row serializes"),
			serde_json::json!({
				"name": "granola",
				"status": "failed",
				"reason": "it answered [redacted], [redacted] and [redacted]"
			})
		);
		assert_eq!(
			serde_json::to_value(&rows[1]).expect("the row serializes"),
			serde_json::json!({ "name": "notion", "status": "connected" })
		);
		for secret in ["held-access", "held-refresh", "held-secret"] {
			assert!(!crossed.contains(secret));
		}
	}
}
