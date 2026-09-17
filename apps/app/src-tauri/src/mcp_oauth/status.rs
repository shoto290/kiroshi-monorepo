use serde::Serialize;

use super::credentials;
use super::reports::Standing;
use crate::environment::contract::{EnvScope, Values, OAUTH_ACCESS_TOKEN, OAUTH_REFRESH_TOKEN};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationRow {
	pub name: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub scope: Option<EnvScope>,
	#[serde(flatten)]
	pub status: ApplicationStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ApplicationStatus {
	Connected,
	NeedsAuthorization {
		#[serde(skip_serializing_if = "Option::is_none")]
		reason: Option<String>,
	},
	Connecting,
	Failed {
		#[serde(skip_serializing_if = "Option::is_none")]
		reason: Option<String>,
	},
	Unknown,
}

pub struct Evidence {
	pub is_authorizing: bool,
	pub refusal: Option<String>,
	pub reported: Option<Standing>,
	pub held: Values,
	pub declares_url: bool,
}

pub fn status(evidence: Evidence, now: i64) -> ApplicationStatus {
	if evidence.is_authorizing {
		return ApplicationStatus::Connecting;
	}
	if evidence.refusal.is_some() {
		return ApplicationStatus::NeedsAuthorization { reason: evidence.refusal };
	}
	match evidence.reported {
		Some(Standing::Holding) => ApplicationStatus::Connected,
		Some(Standing::NeedsAuth) => ApplicationStatus::NeedsAuthorization { reason: None },
		Some(Standing::LeftOut { reason }) => ApplicationStatus::Failed {
			reason: reason.map(|reason| credentials::scrubbed(reason, &evidence.held)),
		},
		None => stored_status(&evidence.held, evidence.declares_url, now),
	}
}

fn stored_status(held: &Values, declares_url: bool, now: i64) -> ApplicationStatus {
	match (holds_a_usable_grant(held, now), declares_url) {
		(true, _) => ApplicationStatus::Connected,
		(false, true) => ApplicationStatus::NeedsAuthorization { reason: None },
		(false, false) => ApplicationStatus::Unknown,
	}
}

fn holds_a_usable_grant(held: &Values, now: i64) -> bool {
	held.contains_key(OAUTH_ACCESS_TOKEN) && (is_live(held, now) || is_renewable(held))
}

fn is_live(held: &Values, now: i64) -> bool {
	credentials::expires_at(held).is_none_or(|expires_at| expires_at > now)
}

fn is_renewable(held: &Values) -> bool {
	held.get(OAUTH_REFRESH_TOKEN).is_some_and(|token| !token.is_empty())
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::environment::contract::{OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_EXPIRES_AT};

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

	fn holding_no_refresh_token(expires_at: Option<i64>) -> Values {
		let mut held = a_grant(expires_at);
		held.insert(OAUTH_REFRESH_TOKEN.to_owned(), String::new());
		held
	}

	fn unreported(held: Values, declares_url: bool) -> Evidence {
		Evidence { is_authorizing: false, refusal: None, reported: None, held, declares_url }
	}

	fn reported(standing: Standing) -> Evidence {
		Evidence {
			is_authorizing: false,
			refusal: None,
			reported: Some(standing),
			held: a_grant(Some(NOW + 1)),
			declares_url: true,
		}
	}

	#[test]
	fn a_running_flow_reads_as_connecting_over_every_other_answer() {
		let evidence = Evidence { is_authorizing: true, ..reported(Standing::NeedsAuth) };

		assert_eq!(status(evidence, NOW), ApplicationStatus::Connecting);
	}

	#[test]
	fn the_last_state_a_session_reported_decides_the_answer() {
		assert_eq!(status(reported(Standing::Holding), NOW), ApplicationStatus::Connected);
		assert_eq!(
			status(reported(Standing::NeedsAuth), NOW),
			ApplicationStatus::NeedsAuthorization { reason: None }
		);
		assert_eq!(
			status(reported(Standing::LeftOut { reason: Some("it read failed".to_owned()) }), NOW),
			ApplicationStatus::Failed { reason: Some("it read failed".to_owned()) }
		);
	}

	#[test]
	fn with_no_report_a_live_token_reads_as_connected() {
		assert_eq!(status(unreported(a_grant(None), true), NOW), ApplicationStatus::Connected);
		assert_eq!(
			status(unreported(a_grant(Some(NOW + 1)), false), NOW),
			ApplicationStatus::Connected
		);
	}

	#[test]
	fn with_no_report_an_expired_token_a_refresh_token_can_renew_reads_as_connected() {
		assert_eq!(status(unreported(a_grant(Some(NOW)), true), NOW), ApplicationStatus::Connected);
		assert_eq!(
			status(unreported(a_grant(Some(NOW - 86_400_000)), true), NOW),
			ApplicationStatus::Connected
		);
	}

	#[test]
	fn with_no_report_a_url_server_holding_no_usable_grant_needs_authorization() {
		assert_eq!(
			status(unreported(Values::new(), true), NOW),
			ApplicationStatus::NeedsAuthorization { reason: None }
		);
		assert_eq!(
			status(unreported(holding_no_refresh_token(Some(NOW)), true), NOW),
			ApplicationStatus::NeedsAuthorization { reason: None }
		);
	}

	#[test]
	fn with_no_report_a_server_declaring_no_url_and_holding_no_usable_grant_is_unknown() {
		assert_eq!(status(unreported(Values::new(), false), NOW), ApplicationStatus::Unknown);
		assert_eq!(
			status(unreported(holding_no_refresh_token(Some(NOW)), false), NOW),
			ApplicationStatus::Unknown
		);
	}

	#[test]
	fn a_refused_renewal_needs_authorization_and_carries_the_reason_over_every_stored_value() {
		let refused = Evidence {
			refusal: Some("invalid_grant".to_owned()),
			..unreported(a_grant(None), true)
		};

		assert_eq!(
			status(refused, NOW),
			ApplicationStatus::NeedsAuthorization { reason: Some("invalid_grant".to_owned()) }
		);
	}

	#[test]
	fn a_row_names_no_access_token_no_refresh_token_and_no_client_secret() {
		let quoting = Standing::LeftOut {
			reason: Some("it answered held-access, held-refresh and held-secret".to_owned()),
		};
		let rows = [
			ApplicationRow {
				name: "granola".to_owned(),
				scope: None,
				status: status(reported(quoting), NOW),
			},
			ApplicationRow {
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
