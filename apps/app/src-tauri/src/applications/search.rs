use std::collections::HashSet;

use reqwest::Url;

use super::contract::{Application, ApplicationSearch, ApplicationsError};
use super::{registry, smithery};

const SHORTEST_TERM: usize = 3;

const GITHUB: &str = "github.com";

const SMITHERY: &str = "the Smithery registry";

const OFFICIAL: &str = "the official registry";

#[derive(Debug, Clone)]
pub struct Registries {
	pub official: String,
	pub smithery: String,
}

impl Default for Registries {
	fn default() -> Self {
		Self { official: registry::REGISTRY.to_owned(), smithery: smithery::REGISTRY.to_owned() }
	}
}

pub struct Listing {
	pub application: Application,
	pub repository: Option<String>,
}

pub async fn search(
	registries: &Registries,
	query: &str,
) -> Result<ApplicationSearch, ApplicationsError> {
	let (semantic, official) = tokio::join!(
		smithery::search(&registries.smithery, query),
		registry::search(&registries.official, query)
	);
	let (semantic, semantic_failure) = answered(SMITHERY, query, semantic);
	let (official, official_failure) = answered(OFFICIAL, query, official);
	let applications = deduplicated(semantic, official);
	match official_failure.or(semantic_failure) {
		Some(failure) if applications.is_empty() => Err(failure),
		registry_failure => Ok(ApplicationSearch { applications, registry_failure }),
	}
}

fn answered(
	registry: &str,
	query: &str,
	read: Result<Vec<Listing>, ApplicationsError>,
) -> (Vec<Listing>, Option<ApplicationsError>) {
	match read {
		Ok(found) => (found, None),
		Err(failure) => {
			eprintln!("{registry} answered nothing for {query:?}: {failure:?}");
			(Vec::new(), Some(failure))
		}
	}
}

fn deduplicated(semantic: Vec<Listing>, official: Vec<Listing>) -> Vec<Application> {
	let named: HashSet<String> =
		semantic.iter().filter_map(|listing| listing.repository.clone()).collect();
	semantic
		.into_iter()
		.map(|listing| listing.application)
		.chain(
			official
				.into_iter()
				.filter(|listing| {
					!listing.repository.as_ref().is_some_and(|held| named.contains(held))
				})
				.map(|listing| listing.application),
		)
		.collect()
}

pub(super) fn terms(query: &str) -> Vec<String> {
	query
		.split_whitespace()
		.filter(|term| term.chars().count() >= SHORTEST_TERM)
		.map(str::to_lowercase)
		.collect()
}

pub(super) fn repository(url: &str) -> Option<String> {
	let parsed = Url::parse(url).ok()?;
	if parsed.host_str()?.to_lowercase() != GITHUB {
		return None;
	}
	let mut segments = parsed.path_segments()?;
	let owner = segments.next().filter(|held| !held.is_empty())?.to_lowercase();
	let name = segments.next().filter(|held| !held.is_empty())?.to_lowercase();
	let name = name.strip_suffix(".git").unwrap_or(&name);
	Some(format!("{GITHUB}/{owner}/{name}"))
}

#[cfg(test)]
mod tests {
	use std::net::Ipv4Addr;

	use serde_json::json;

	use super::super::contract::Install;
	use super::*;
	use crate::applications::registry::tests as official_stub;
	use crate::applications::smithery::tests as smithery_stub;

	async fn unreached() -> String {
		let listener =
			tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.expect("a port binds");
		let address = listener.local_addr().expect("the port is named");
		drop(listener);
		format!("http://{address}")
	}

	async fn a_smithery_serving_slack() -> String {
		let (base, _) = smithery_stub::serving(smithery_stub::holding(
			vec![smithery_stub::a_row("@owner/slack", "Slack", 900)],
			vec![smithery_stub::a_detail("@owner/slack", "https://slack.run.tools")],
		))
		.await;
		base
	}

	fn listed(name: &str, repository: Option<&str>) -> Listing {
		Listing {
			application: Application {
				name: name.to_owned(),
				title: name.to_owned(),
				description: String::new(),
				config: json!({}),
				tools: Vec::new(),
				logo: None,
				logo_url: None,
				use_count: None,
				verified: None,
				hosted_by: None,
				install: Install::Oauth,
			},
			repository: repository.map(str::to_owned),
		}
	}

	fn names(applications: Vec<Application>) -> Vec<String> {
		applications.into_iter().map(|held| held.name).collect()
	}

	#[test]
	fn a_query_keeps_only_the_terms_of_three_characters_or_more_in_lowercase() {
		assert_eq!(terms("My Issues an"), ["issues"]);
		assert_eq!(terms("an my"), Vec::<String>::new());
		assert_eq!(terms(""), Vec::<String>::new());
	}

	#[test]
	fn a_github_url_reads_down_to_its_host_owner_and_name() {
		let expected = Some("github.com/smithery-ai/notion".to_owned());

		assert_eq!(repository("https://github.com/smithery-ai/notion"), expected);
		assert_eq!(repository("https://github.com/Smithery-AI/Notion/"), expected);
		assert_eq!(repository("https://github.com/smithery-ai/notion.git"), expected);
		assert_eq!(repository("https://github.com/smithery-ai/notion/tree/main"), expected);
	}

	#[test]
	fn a_url_naming_no_github_repository_reads_to_nothing() {
		assert_eq!(repository("https://smithery.ai/server/@owner/notion"), None);
		assert_eq!(repository("https://github.com/smithery-ai"), None);
		assert_eq!(repository("not a url"), None);
	}

	#[tokio::test]
	async fn an_unreached_official_registry_answers_the_smithery_rows_and_carries_the_failure() {
		let registries =
			Registries { official: unreached().await, smithery: a_smithery_serving_slack().await };

		let answered = search(&registries, "slack").await.expect("the search answers");

		assert_eq!(names(answered.applications), ["@owner/slack"]);
		assert!(
			matches!(answered.registry_failure, Some(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.registry_failure
		);
	}

	#[tokio::test]
	async fn a_search_answering_no_row_answers_the_failure_to_its_caller() {
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;
		let registries = Registries { official, smithery: unreached().await };

		let answered = search(&registries, "slack").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.map(|held| names(held.applications))
		);
	}

	#[test]
	fn an_official_row_naming_a_kept_smithery_repository_is_left_out() {
		let kept = deduplicated(
			vec![listed("@owner/notion", Some("github.com/owner/notion"))],
			vec![
				listed("com.notion/mcp", Some("github.com/owner/notion")),
				listed("io.test/other", Some("github.com/owner/other")),
				listed("io.test/bare", None),
			],
		);

		assert_eq!(names(kept), ["@owner/notion", "io.test/other", "io.test/bare"]);
	}
}
