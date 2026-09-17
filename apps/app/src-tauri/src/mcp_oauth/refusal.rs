use super::contract::OauthError;
use super::credentials;
use crate::environment::contract::Values;

const AUTHORITY: &str = "://";

const QUERY_OR_FRAGMENT: [char; 2] = ['?', '#'];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
	ClaimingTheState,
	WritingTheStoreRoot,
	ReachingTheSidecar,
	StartingTheFlow,
	OpeningTheFlow,
	HandingTheUrl,
	OpeningTheBrowser,
	SettlingTheFlow,
	AskingTheAuthorizationServer,
	ReadingTheSettlement,
	StoringTheGrant,
}

impl Step {
	pub fn refused(self, error: OauthError) -> Refused {
		Refused { step: self, error }
	}

	fn named(self) -> &'static str {
		match self {
			Self::ClaimingTheState => "the authorization state could not be claimed",
			Self::WritingTheStoreRoot => "the store root could not be written",
			Self::ReachingTheSidecar => "the sidecar could not be reached",
			Self::StartingTheFlow => "the authorization flow did not start",
			Self::OpeningTheFlow => "the authorization flow did not open",
			Self::HandingTheUrl => "the authorization url may be handed to no browser",
			Self::OpeningTheBrowser => "the browser refused the authorization url",
			Self::SettlingTheFlow => "the authorization flow did not settle",
			Self::AskingTheAuthorizationServer => "the authorization server refused",
			Self::ReadingTheSettlement => "the settlement carried no grant",
			Self::StoringTheGrant => "the grant could not be stored",
		}
	}
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refused {
	pub step: Step,
	pub error: OauthError,
}

pub fn refusal_line(refused: &Refused, held: &Values) -> String {
	let reason = credentials::scrubbed(reason(&refused.error), held);
	format!("{}: {}", refused.step.named(), urls_cut(&reason))
}

fn reason(error: &OauthError) -> String {
	match error {
		OauthError::AlreadyRunning => "a flow is already running".to_owned(),
		OauthError::Cancelled => "it was cancelled".to_owned(),
		OauthError::TimedOut => "it timed out".to_owned(),
		OauthError::Denied { detail } | OauthError::Failed { detail } => detail.clone(),
		OauthError::BrowserRefused { url } | OauthError::RefusedUrl { url } => url.clone(),
		OauthError::FlowTimedOut { timeout_ms } => format!("no answer within {timeout_ms}ms"),
		OauthError::Transport { error } => format!("{error:?}"),
		OauthError::Store { error } => format!("{error:?}"),
	}
}

fn urls_cut(reason: &str) -> String {
	reason.split(' ').map(url_cut).collect::<Vec<_>>().join(" ")
}

fn url_cut(word: &str) -> &str {
	if !word.contains(AUTHORITY) {
		return word;
	}
	word.find(QUERY_OR_FRAGMENT).map_or(word, |at| &word[..at])
}

#[cfg(test)]
mod tests {
	use std::collections::BTreeSet;

	use super::*;
	use crate::agent::contract::TransportError;
	use crate::environment::contract::{
		EnvError, OAUTH_ACCESS_TOKEN, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN,
	};

	const EVERY_STEP: [Step; 11] = [
		Step::ClaimingTheState,
		Step::WritingTheStoreRoot,
		Step::ReachingTheSidecar,
		Step::StartingTheFlow,
		Step::OpeningTheFlow,
		Step::HandingTheUrl,
		Step::OpeningTheBrowser,
		Step::SettlingTheFlow,
		Step::AskingTheAuthorizationServer,
		Step::ReadingTheSettlement,
		Step::StoringTheGrant,
	];

	fn a_grant() -> Values {
		[
			(OAUTH_ACCESS_TOKEN.to_owned(), "held-access".to_owned()),
			(OAUTH_REFRESH_TOKEN.to_owned(), "held-refresh".to_owned()),
			(OAUTH_CLIENT_SECRET.to_owned(), "held-secret".to_owned()),
		]
		.into()
	}

	#[test]
	fn each_step_a_connect_can_be_refused_at_names_itself_and_no_other() {
		let named = EVERY_STEP.map(Step::named);

		assert_eq!(named.iter().collect::<BTreeSet<_>>().len(), EVERY_STEP.len());
		assert!(named.iter().all(|name| !name.is_empty()));
	}

	#[test]
	fn the_line_names_the_step_and_carries_the_reason_it_gave() {
		assert_eq!(
			refusal_line(
				&Step::ReachingTheSidecar
					.refused(OauthError::Transport { error: TransportError::NotStarted }),
				&Values::new()
			),
			"the sidecar could not be reached: NotStarted"
		);
		assert_eq!(
			refusal_line(
				&Step::ClaimingTheState.refused(OauthError::AlreadyRunning),
				&Values::new()
			),
			"the authorization state could not be claimed: a flow is already running"
		);
		assert_eq!(
			refusal_line(
				&Step::AskingTheAuthorizationServer
					.refused(OauthError::Denied { detail: "access_denied".to_owned() }),
				&Values::new()
			),
			"the authorization server refused: access_denied"
		);
		assert_eq!(
			refusal_line(
				&Step::SettlingTheFlow.refused(OauthError::FlowTimedOut { timeout_ms: 310_000 }),
				&Values::new()
			),
			"the authorization flow did not settle: no answer within 310000ms"
		);
		assert_eq!(
			refusal_line(
				&Step::StoringTheGrant.refused(OauthError::Store {
					error: EnvError::Unwritable { detail: "the disk is full".to_owned() }
				}),
				&Values::new()
			),
			"the grant could not be stored: Unwritable { detail: \"the disk is full\" }"
		);
	}

	#[test]
	fn the_line_names_no_value_of_the_grant_in_hand() {
		let line = refusal_line(
			&Step::StoringTheGrant.refused(OauthError::Failed {
				detail: "held-access, held-refresh and held-secret were refused".to_owned(),
			}),
			&a_grant(),
		);

		assert_eq!(
			line,
			"the grant could not be stored: [redacted], [redacted] and [redacted] were refused"
		);
	}

	#[test]
	fn the_line_cuts_every_url_at_the_end_of_its_path() {
		assert_eq!(
			refusal_line(
				&Step::OpeningTheBrowser.refused(OauthError::BrowserRefused {
					url: "https://authority.test/authorize?state=held-state&code=held-code"
						.to_owned()
				}),
				&Values::new()
			),
			"the browser refused the authorization url: https://authority.test/authorize"
		);
		assert_eq!(
			refusal_line(
				&Step::AskingTheAuthorizationServer.refused(OauthError::Failed {
					detail: "https://authority.test/token#held-fragment answered 400".to_owned()
				}),
				&Values::new()
			),
			"the authorization server refused: https://authority.test/token answered 400"
		);
	}

	#[test]
	fn the_line_leaves_a_reason_naming_no_url_whole() {
		assert_eq!(
			refusal_line(
				&Step::HandingTheUrl
					.refused(OauthError::RefusedUrl { url: "javascript:alert(1)".to_owned() }),
				&Values::new()
			),
			"the authorization url may be handed to no browser: javascript:alert(1)"
		);
		assert_eq!(urls_cut("was it refused? it was"), "was it refused? it was");
	}
}
