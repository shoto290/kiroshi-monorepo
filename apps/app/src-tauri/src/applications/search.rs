use std::collections::HashSet;

use reqwest::Url;

use super::contract::{Application, ApplicationSearch, ApplicationsError, Install};
use super::{registry, smithery};

const SHORTEST_TERM: usize = 3;

const OFFERS: usize = 9;

const GITHUB: &str = "github.com";

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
	if query.trim().is_empty() {
		return offered(registries).await;
	}
	let (semantic, official) = tokio::join!(
		smithery::search(&registries.smithery, query),
		registry::search(&registries.official, query)
	);
	let (semantic, semantic_failure) = answered("the Smithery registry", query, semantic);
	let (official, official_failure) = answered("the official registry", query, official);
	let applications = deduplicated(semantic, official);
	match official_failure.or(semantic_failure) {
		Some(failure) if applications.is_empty() => Err(failure),
		registry_failure => Ok(ApplicationSearch { applications, registry_failure }),
	}
}

async fn offered(registries: &Registries) -> Result<ApplicationSearch, ApplicationsError> {
	let mut offers: Vec<Application> = smithery::offered(&registries.smithery)
		.await?
		.into_iter()
		.map(|listing| listing.application)
		.filter(installable)
		.collect();
	offers.truncate(OFFERS);
	Ok(ApplicationSearch { applications: offers, registry_failure: None })
}

fn installable(application: &Application) -> bool {
	!matches!(application.install, Install::Refused(_))
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
	let kept: Vec<Listing> = official
		.into_iter()
		.filter(|listing| !listing.repository.as_ref().is_some_and(|held| named.contains(held)))
		.collect();
	interleaved(semantic, kept).into_iter().map(|listing| listing.application).collect()
}

fn interleaved(semantic: Vec<Listing>, official: Vec<Listing>) -> Vec<Listing> {
	let mut semantic = semantic.into_iter();
	let mut official = official.into_iter();
	let mut taken = Vec::new();
	loop {
		match (semantic.next(), official.next()) {
			(None, None) => return taken,
			(first, second) => taken.extend(first.into_iter().chain(second)),
		}
	}
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
	use serde_json::json;

	use super::super::contract::Install;
	use std::sync::Arc;

	use super::*;
	use crate::applications::registry::tests as official_stub;
	use crate::applications::registry::tests::unreached;
	use crate::applications::smithery::tests as smithery_stub;

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

	const A_SMITHERY_PAGE: [&str; 12] =
		["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

	async fn a_smithery_offering(page: &[&str]) -> (String, Arc<smithery_stub::Held>) {
		smithery_stub::serving(smithery_stub::holding(
			page.iter().map(|name| smithery_stub::a_row(name, name, 1)).collect(),
			page.iter()
				.map(|name| smithery_stub::a_detail(name, &format!("https://{name}.run.tools")))
				.collect(),
		))
		.await
	}

	async fn offering(smithery: String, official: String) -> ApplicationSearch {
		search(&Registries { official, smithery }, "   ").await.expect("the offers answer")
	}

	#[tokio::test]
	async fn an_empty_query_answers_nine_smithery_rows_and_asks_the_official_registry_nothing() {
		let (smithery, semantic) = a_smithery_offering(&A_SMITHERY_PAGE).await;
		let (official, listed) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = offering(smithery, official).await;

		assert_eq!(names(answered.applications), ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
		assert_eq!(answered.registry_failure, None);
		assert_eq!(
			*semantic.asked.lock().expect("the stub records"),
			["/servers?page=1&pageSize=12"]
		);
		assert!(listed.asked.lock().expect("the stub records").is_empty(), "the official was read");
	}

	#[tokio::test]
	async fn an_empty_query_leaves_out_a_row_whose_install_is_refused_and_fills_its_place() {
		let (smithery, _) = smithery_stub::serving(smithery_stub::holding(
			A_SMITHERY_PAGE.iter().map(|name| smithery_stub::a_row(name, name, 1)).collect(),
			A_SMITHERY_PAGE
				.iter()
				.map(|name| match *name {
					"b" => smithery_stub::an_uncarried_detail("b", "https://b.run.tools"),
					held => smithery_stub::a_detail(held, &format!("https://{held}.run.tools")),
				})
				.collect(),
		))
		.await;
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = offering(smithery, official).await;

		assert_eq!(names(answered.applications), ["a", "c", "d", "e", "f", "g", "h", "i", "j"]);
	}

	#[tokio::test]
	async fn a_smithery_listing_that_fails_on_an_empty_query_answers_its_failure() {
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = search(&Registries { official, smithery: unreached().await }, "").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.map(|held| names(held.applications))
		);
	}

	#[tokio::test]
	#[ignore = "it reads the live registries"]
	async fn the_live_registries_answer_an_empty_query_and_a_godot_query() {
		for query in ["", "godot"] {
			let answered =
				search(&Registries::default(), query).await.expect("the live search answers");
			println!("{query:?} answered {:?}", names(answered.applications));
		}
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
	fn an_official_row_naming_a_kept_smithery_repository_is_left_out_before_the_interleaving() {
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

	fn bare(names: &[&str]) -> Vec<Listing> {
		names.iter().map(|name| listed(name, None)).collect()
	}

	#[test]
	fn the_two_sources_answer_in_turn_and_the_longer_one_answers_its_tail_alone() {
		let kept = deduplicated(
			bare(&["@owner/one", "@owner/two"]),
			bare(&["io.test/one", "io.test/two", "io.test/three", "io.test/four"]),
		);

		assert_eq!(
			names(kept),
			[
				"@owner/one",
				"io.test/one",
				"@owner/two",
				"io.test/two",
				"io.test/three",
				"io.test/four",
			]
		);
	}

	#[test]
	fn a_source_answering_nothing_leaves_the_other_in_its_own_order() {
		assert_eq!(
			names(deduplicated(bare(&["@owner/one", "@owner/two"]), Vec::new())),
			["@owner/one", "@owner/two"]
		);
		assert_eq!(names(deduplicated(Vec::new(), bare(&["io.test/one"]))), ["io.test/one"]);
	}

	#[test]
	fn the_recorded_answers_for_godot_name_a_godot_server_in_the_first_two_rows() {
		let smithery = bare(&[
			"gripforgeai/gripforge-mcp",
			"cod-gb2l/StudioMeyer-Crew",
			"rabauer-dev/fxgl-skills",
			"daniel-yarmoluk/ckg-nvidia-ai",
			"ianewsfr/ergonia",
			"zeintesit/forkit",
			"roundtable/roundtable",
			"eldesh/random-mcp",
			"evozim-hv/3d-meshweaver",
			"comms-717a/sparxx-io",
		]);
		let official = bare(&[
			"io.github.Erodenn/godot-mcp-runtime",
			"io.github.FunplayAI/funplay-godot-mcp",
			"io.github.TomasLucasUTN/godot-mcp-bridge",
		]);

		let answered = names(deduplicated(smithery, official));

		assert!(
			answered[..2].iter().any(|name| name.to_lowercase().contains("godot")),
			"got {:?}",
			&answered[..2]
		);
	}
}
