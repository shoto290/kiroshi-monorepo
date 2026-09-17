use serde::Deserialize;

use super::contract::{Application, ApplicationsError, Install};
use crate::bundles::system;

#[derive(Deserialize)]
struct Curated {
	name: String,
	title: String,
	description: String,
	config: serde_json::Value,
	tools: Vec<String>,
	#[serde(default)]
	logo: Option<String>,
	install: Install,
}

pub fn curated() -> Result<Vec<Application>, ApplicationsError> {
	let bytes = embedded(system::APPLICATIONS)?;
	let entries: Vec<Curated> = serde_json::from_slice(bytes).map_err(|error| {
		unreadable(format!("{} is not a catalogue: {error}", system::APPLICATIONS))
	})?;
	entries.into_iter().map(application).collect()
}

fn application(entry: Curated) -> Result<Application, ApplicationsError> {
	let logo = entry.logo.as_deref().map(logo).transpose()?;
	Ok(Application {
		name: entry.name,
		title: entry.title,
		description: entry.description,
		config: entry.config,
		tools: Some(entry.tools),
		logo,
		logo_url: None,
		use_count: None,
		verified: None,
		hosted_by: None,
		categories: Vec::new(),
		auth_posture: None,
		install: entry.install,
	})
}

fn logo(path: &str) -> Result<String, ApplicationsError> {
	String::from_utf8(embedded(path)?.to_vec())
		.map_err(|error| unreadable(format!("the logo {path} is not text: {error}")))
}

fn embedded(path: &str) -> Result<&'static [u8], ApplicationsError> {
	system::file(path).ok_or_else(|| unreadable(format!("{path} is not embedded")))
}

fn unreadable(detail: String) -> ApplicationsError {
	ApplicationsError::CatalogueUnreadable { detail }
}

#[cfg(test)]
mod tests {
	use std::path::PathBuf;

	use serde_json::json;

	use super::*;

	fn the_catalogue() -> Vec<Application> {
		curated().expect("the embedded catalogue reads")
	}

	fn entry(name: &str) -> Application {
		the_catalogue()
			.into_iter()
			.find(|held| held.name == name)
			.unwrap_or_else(|| panic!("{name} is curated"))
	}

	fn icons() -> String {
		let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
			.join("../../../packages/ui/src/components/icons.tsx");
		std::fs::read_to_string(path).expect("the icons read")
	}

	fn drawn_paths(svg: &str) -> Vec<&str> {
		svg.split("d=\"").skip(1).filter_map(|rest| rest.split('"').next()).collect()
	}

	#[test]
	fn two_applications_are_curated_in_order() {
		let names: Vec<String> = the_catalogue().into_iter().map(|held| held.name).collect();

		assert_eq!(names, ["superset", "paper"]);
	}

	#[test]
	fn every_application_carries_a_title_a_one_line_description_a_config_and_its_tools() {
		for application in the_catalogue() {
			let name = &application.name;
			assert!(!application.title.is_empty(), "{name} has no title");
			assert!(!application.description.is_empty(), "{name} has no description");
			assert!(!application.description.contains('\n'), "{name} spans lines");
			assert_eq!(application.config["type"], "http", "got {name}");
			assert!(application.config["url"].is_string(), "{name} has no url");
			let tools = application.tools.as_deref();
			assert!(tools.is_some_and(|named| !named.is_empty()), "{name} names no tool");
		}
	}

	#[test]
	fn each_application_answers_its_install_case() {
		assert!(matches!(entry("superset").install, Install::Key { .. }));
		assert_eq!(entry("paper").install, Install::Nothing);
	}

	#[test]
	fn superset_asks_for_its_api_key_as_a_bearer_placeholder() {
		let superset = entry("superset");

		assert_eq!(
			superset.config["headers"],
			json!({ "Authorization": "Bearer ${SUPERSET_API_KEY}" })
		);
		let Install::Key { fields } = superset.install else {
			panic!("superset asks for a key");
		};
		assert_eq!(fields.len(), 1);
		assert_eq!(fields[0].secret, "SUPERSET_API_KEY");
	}

	#[test]
	fn every_reference_of_every_curated_config_is_named_by_a_field_of_its_install() {
		for application in the_catalogue() {
			assert_eq!(
				application.install.clone().covering(&application.config),
				application.install,
				"got {}",
				application.name
			);
		}
	}

	#[test]
	fn every_curated_logo_is_a_mark_of_the_design_system() {
		let icons = icons();

		for application in the_catalogue() {
			let name = application.name;
			let logo = application.logo.unwrap_or_else(|| panic!("{name} has a logo"));
			assert!(logo.starts_with("<svg"), "got {logo}");
			let paths = drawn_paths(&logo);
			assert!(!paths.is_empty(), "{name} draws nothing");
			for path in paths {
				assert!(icons.contains(path), "the {name} logo is not a mark of the design system");
			}
		}
	}

	#[test]
	fn an_entry_naming_a_logo_that_is_not_embedded_is_unreadable() {
		let named = "applications/logos/dropped.svg";
		let entry: Curated = serde_json::from_value(json!({
			"name": "dropped",
			"title": "Dropped",
			"description": "An entry whose logo left the bundle.",
			"config": { "type": "http", "url": "https://dropped.test/mcp" },
			"tools": ["read"],
			"logo": named,
			"install": { "kind": "nothing" },
		}))
		.expect("the entry reads");

		let refusal = application(entry).expect_err("the logo is not embedded");

		assert_eq!(
			refusal,
			ApplicationsError::CatalogueUnreadable { detail: format!("{named} is not embedded") }
		);
	}
}
