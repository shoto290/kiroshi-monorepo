use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

use crate::agent::protocol::HostAnswer;
use crate::agent::session::{Answering, HostRequests};

const SUBTYPE: &str = "connector";

const NO_RECORDS: &str = "the record of where servers stand is not held";

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum Standing {
	Holding,
	NeedsAuth,
	LeftOut {
		#[serde(default)]
		reason: Option<String>,
	},
}

#[derive(Debug, Deserialize)]
struct Report {
	name: String,
	#[serde(flatten)]
	standing: Standing,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "subtype", rename_all = "camelCase")]
enum Asked {
	Connector { operation: Operation, payload: Report },
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
enum Operation {
	Report,
}

#[derive(Default)]
pub struct ConnectorReports {
	held: Mutex<HashMap<(String, String), Standing>>,
}

impl ConnectorReports {
	pub fn record(&self, bot_id: &str, name: &str, standing: Standing) {
		self.held
			.lock()
			.unwrap_or_else(PoisonError::into_inner)
			.insert((bot_id.to_owned(), name.to_owned()), standing);
	}

	pub fn forget(&self, name: &str) {
		self.held
			.lock()
			.unwrap_or_else(PoisonError::into_inner)
			.retain(|(_, held), _| held != name);
	}

	pub fn last(&self, bot_id: &str, name: &str) -> Option<Standing> {
		self.held
			.lock()
			.unwrap_or_else(PoisonError::into_inner)
			.get(&(bot_id.to_owned(), name.to_owned()))
			.cloned()
	}
}

#[derive(Debug)]
pub struct ConnectorHost<R: Runtime> {
	app: AppHandle<R>,
	bot_id: String,
}

impl<R: Runtime> ConnectorHost<R> {
	pub fn new(app: AppHandle<R>, bot_id: String) -> Self {
		Self { app, bot_id }
	}

	fn recorded(&self, request: Value) -> HostAnswer {
		let report = read(request)?;
		let reports = self
			.app
			.try_state::<ConnectorReports>()
			.ok_or_else(|| serde_json::json!({ "kind": "unexpected", "detail": NO_RECORDS }))?;
		reports.record(&self.bot_id, &report.name, report.standing);
		Ok(Value::Null)
	}
}

impl<R: Runtime> HostRequests for ConnectorHost<R> {
	fn subtype(&self) -> &'static str {
		SUBTYPE
	}

	fn serve(&self, request: Value) -> Answering {
		let answer = self.recorded(request);
		Box::pin(async move { answer })
	}
}

fn read(request: Value) -> Result<Report, Value> {
	let Asked::Connector { operation: Operation::Report, payload } =
		serde_json::from_value(request).map_err(
			|error| serde_json::json!({ "kind": "unreadableRequest", "detail": error.to_string() }),
		)?;
	Ok(payload)
}

#[cfg(test)]
mod tests {
	use serde_json::json;

	use super::*;

	fn asked(payload: Value) -> Value {
		json!({ "subtype": "connector", "operation": "report", "payload": payload })
	}

	#[test]
	fn a_session_report_reads_as_the_state_it_names() {
		let holding = read(asked(json!({ "name": "superset", "state": "holding" })))
			.expect("the report reads");
		let awaiting = read(asked(json!({ "name": "granola", "state": "needs-auth" })))
			.expect("the report reads");
		let dropped = read(asked(
			json!({ "name": "clock", "state": "left-out", "reason": "TOKEN is defined by no scope" }),
		))
		.expect("the report reads");

		assert_eq!((holding.name.as_str(), holding.standing), ("superset", Standing::Holding));
		assert_eq!((awaiting.name.as_str(), awaiting.standing), ("granola", Standing::NeedsAuth));
		assert_eq!(
			dropped.standing,
			Standing::LeftOut { reason: Some("TOKEN is defined by no scope".to_owned()) }
		);
	}

	#[test]
	fn a_state_no_record_holds_is_refused_by_name() {
		let refused = read(asked(json!({ "name": "superset", "state": "connecting" })))
			.expect_err("a connecting server is not a settled state");

		assert_eq!(refused["kind"], "unreadableRequest");
	}

	#[test]
	fn a_report_replaces_the_one_last_recorded_for_that_bot_and_server() {
		let reports = ConnectorReports::default();
		reports.record("b1", "granola", Standing::NeedsAuth);
		reports.record("b2", "granola", Standing::Holding);

		reports.record("b1", "granola", Standing::Holding);

		assert_eq!(reports.last("b1", "granola"), Some(Standing::Holding));
		assert_eq!(reports.last("b2", "granola"), Some(Standing::Holding));
		assert_eq!(reports.last("b1", "clock"), None);
	}

	#[test]
	fn forgetting_a_server_drops_its_standing_for_every_bot_and_keeps_the_rest() {
		let reports = ConnectorReports::default();
		reports.record("b1", "granola", Standing::NeedsAuth);
		reports.record("b2", "granola", Standing::Holding);
		reports.record("b1", "clock", Standing::Holding);

		reports.forget("granola");

		assert_eq!(reports.last("b1", "granola"), None);
		assert_eq!(reports.last("b2", "granola"), None);
		assert_eq!(reports.last("b1", "clock"), Some(Standing::Holding));
	}
}
