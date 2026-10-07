use serde::Serialize;

pub const CHANGED_EVENT: &str = "hosting://changed";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum HostingState {
	#[default]
	Off,
	Connecting,
	Online,
	#[serde(rename_all = "camelCase")]
	Failed {
		reason: String,
	},
	NeedsSignIn,
}

impl HostingState {
	pub fn is_running(&self) -> bool {
		matches!(self, HostingState::Connecting | HostingState::Online)
	}
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HostingChanged {
	pub space_id: String,
	pub state: HostingState,
}

#[cfg(test)]
mod tests {
	use serde_json::{json, to_value};

	use super::*;

	#[test]
	fn a_change_crosses_with_the_space_and_its_state_tagged_on_kind() {
		let changed = HostingChanged {
			space_id: "personal".to_owned(),
			state: HostingState::Failed { reason: "replaced".to_owned() },
		};

		assert_eq!(
			to_value(changed).expect("the change serializes"),
			json!({ "spaceId": "personal", "state": { "kind": "failed", "reason": "replaced" } })
		);
		assert_eq!(
			to_value(HostingState::NeedsSignIn).expect("the state serializes"),
			json!({ "kind": "needsSignIn" })
		);
	}
}
