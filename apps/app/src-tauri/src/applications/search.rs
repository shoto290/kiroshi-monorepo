use std::collections::HashSet;
use std::future::Future;

use reqwest::Url;

use super::contract::{Application, ApplicationSearch, ApplicationsError, Install};
use super::{catalogue, registry, smithery};

const SHORTEST_TERM: usize = 3;

const OFFERS: usize = 9;

const GITHUB: &str = "github.com";

const OFFICIAL_PREFIX: char = '.';

const SMITHERY_HOSTS: [&str; 2] = ["run.tools", "smithery.ai"];

const LABELS: usize = 2;

pub(super) const OFFICIAL_SOURCE: &str = "the official registry";

pub(super) const SMITHERY_SOURCE: &str = "the Smithery registry";

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

#[derive(Debug)]
pub(super) enum Dropped {
	HostedBySmithery,
	Unread,
}

pub(super) fn elsewhere(endpoint: &Url) -> Result<String, Dropped> {
	let Some(host) = endpoint.host_str().map(str::to_lowercase) else {
		return Err(Dropped::Unread);
	};
	if SMITHERY_HOSTS.iter().any(|root| under(&host, root)) {
		return Err(Dropped::HostedBySmithery);
	}
	Ok(last_labels(&host))
}

fn under(host: &str, root: &str) -> bool {
	host == root || host.ends_with(&format!(".{root}"))
}

fn last_labels(host: &str) -> String {
	let labels: Vec<&str> = host.split('.').collect();
	labels[labels.len().saturating_sub(LABELS)..].join(".")
}

pub(super) fn normalised(
	source: &str,
	answered: usize,
	read: Vec<Result<Listing, Dropped>>,
) -> Vec<Listing> {
	let unread = read.iter().filter(|held| matches!(held, Err(Dropped::Unread))).count();
	if let Some(line) = drift(source, answered, unread) {
		eprintln!("{line}");
	}
	read.into_iter().flatten().collect()
}

fn drift(source: &str, answered: usize, unread: usize) -> Option<String> {
	(unread > 0).then(|| {
		format!(
			"{source} answered {answered} rows and {unread} carried no transport this reader reads"
		)
	})
}

type Sought = Result<Option<Application>, ApplicationsError>;

pub async fn named(registries: &Registries, name: &str) -> Sought {
	if let Some(curated) = catalogue::curated()?.into_iter().find(|held| held.name == name) {
		return Ok(Some(curated));
	}
	let semantic = || smithery::detail(&registries.smithery, name);
	let official = || registry::detail(&registries.official, name);
	if names_a_smithery_server(name) {
		return fallen_back(semantic().await, official()).await;
	}
	fallen_back(official().await, semantic()).await
}

async fn fallen_back(first: Sought, second: impl Future<Output = Sought>) -> Sought {
	match first {
		Ok(Some(found)) => Ok(Some(found)),
		Ok(None) => second.await,
		Err(failure) => match second.await? {
			Some(found) => Ok(Some(found)),
			None => Err(failure),
		},
	}
}

pub(super) fn names_a_smithery_server(name: &str) -> bool {
	!name.split_once('/').map_or(name, |(before, _)| before).contains(OFFICIAL_PREFIX)
}

pub async fn search(
	registries: &Registries,
	query: &str,
) -> Result<ApplicationSearch, ApplicationsError> {
	let (applications, registry_failure) = if query.trim().is_empty() {
		offered(registries).await
	} else {
		queried(registries, query).await
	};
	match registry_failure {
		Some(failure) if applications.is_empty() => Err(failure),
		registry_failure => Ok(ApplicationSearch { applications, registry_failure }),
	}
}

async fn queried(registries: &Registries, query: &str) -> Sourced {
	let (semantic, official) = tokio::join!(
		smithery::search(&registries.smithery, query),
		registry::search(&registries.official, query)
	);
	sourced(query, semantic, official)
}

async fn offered(registries: &Registries) -> Sourced {
	let (semantic, official) = tokio::join!(
		smithery::offered(&registries.smithery),
		registry::search(&registries.official, "")
	);
	let (mut offers, failure) = sourced("", semantic, official);
	offers.retain(installable);
	offers.truncate(OFFERS);
	(offers, failure)
}

type Sourced = (Vec<Application>, Option<ApplicationsError>);

fn sourced(
	query: &str,
	semantic: Result<Vec<Listing>, ApplicationsError>,
	official: Result<Vec<Listing>, ApplicationsError>,
) -> Sourced {
	let (semantic, semantic_failure) = answered(SMITHERY_SOURCE, query, semantic);
	let (official, official_failure) = answered(OFFICIAL_SOURCE, query, official);
	(deduplicated(semantic, official), official_failure.or(semantic_failure))
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
			vec![smithery_stub::a_detail("@owner/slack", "https://slack.example")],
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
				tools: None,
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
				.map(|name| smithery_stub::a_detail(name, &format!("https://{name}.example")))
				.collect(),
		))
		.await
	}

	async fn offering(smithery: String, official: String) -> ApplicationSearch {
		search(&Registries { official, smithery }, "   ").await.expect("the offers answer")
	}

	#[tokio::test]
	async fn an_empty_query_answers_nine_rows_and_reads_both_registries() {
		let (smithery, semantic) = a_smithery_offering(&A_SMITHERY_PAGE).await;
		let (official, listed) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = offering(smithery, official).await;

		assert_eq!(names(answered.applications), ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
		assert_eq!(answered.registry_failure, None);
		assert_eq!(
			*semantic.asked.lock().expect("the stub records"),
			["/servers?page=1&pageSize=12"]
		);
		assert_eq!(
			*listed.asked.lock().expect("the stub records"),
			["/v0.1/servers?search=&limit=10&version=latest"]
		);
	}

	#[tokio::test]
	async fn an_empty_query_answers_the_rows_of_both_registries_in_turn() {
		let (smithery, _) = a_smithery_offering(&["a", "b"]).await;
		let (official, _) = official_stub::serving(official_stub::holding(vec![
			"com.notion/mcp",
			"io.github.Digital-Defiance/mcp-filesystem",
		]))
		.await;

		let answered = offering(smithery, official).await;

		assert_eq!(
			names(answered.applications),
			["a", "com.notion/mcp", "b", "io.github.Digital-Defiance/mcp-filesystem"]
		);
	}

	#[tokio::test]
	async fn an_empty_query_leaves_out_a_row_whose_install_is_refused_and_fills_its_place() {
		let (smithery, _) = smithery_stub::serving(smithery_stub::holding(
			A_SMITHERY_PAGE.iter().map(|name| smithery_stub::a_row(name, name, 1)).collect(),
			A_SMITHERY_PAGE
				.iter()
				.map(|name| match *name {
					"b" => smithery_stub::an_uncarried_detail("b", "https://b.example"),
					held => smithery_stub::a_detail(held, &format!("https://{held}.example")),
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
	async fn a_curated_name_answers_from_the_catalogue_and_no_registry_is_read() {
		let (official, listed) = official_stub::serving(official_stub::holding(Vec::new())).await;
		let (smithery, semantic) = smithery_stub::serving(smithery_stub::nothing()).await;

		let answered = named(&Registries { official, smithery }, "superset")
			.await
			.expect("the name resolves");

		assert_eq!(answered.map(|held| held.name), Some("superset".to_owned()));
		assert!(listed.asked.lock().expect("the stub records").is_empty(), "the official was read");
		assert!(semantic.asked.lock().expect("the stub records").is_empty(), "Smithery was read");
	}

	#[tokio::test]
	async fn a_name_no_source_carries_answers_nothing_and_raises_no_failure() {
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;
		let (smithery, _) = smithery_stub::serving(smithery_stub::nothing()).await;

		let answered = named(&Registries { official, smithery }, "io.test/nowhere").await;

		assert_eq!(answered.expect("the name resolves").map(|held| held.name), None);
	}

	#[tokio::test]
	async fn a_name_no_source_carries_while_a_registry_is_unreached_answers_that_failure() {
		let (smithery, _) = smithery_stub::serving(smithery_stub::nothing()).await;

		let answered =
			named(&Registries { official: unreached().await, smithery }, "io.test/nowhere").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.map(|held| held.map(|found| found.name))
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
	fn a_read_whose_every_row_was_hosted_by_smithery_says_nothing() {
		assert_eq!(drift(SMITHERY_SOURCE, 10, 0), None);
	}

	#[test]
	fn a_read_carrying_a_row_no_transport_was_read_in_names_its_source_and_its_count() {
		let line = drift(OFFICIAL_SOURCE, 10, 2).expect("the drift is named");

		assert!(line.contains(OFFICIAL_SOURCE), "got {line}");
		assert!(line.contains("10"), "got {line}");
	}

	#[test]
	fn a_read_answers_its_listings_and_leaves_out_every_dropped_row() {
		let read = vec![
			Ok(listed("@owner/one", None)),
			Err(Dropped::HostedBySmithery),
			Err(Dropped::Unread),
			Ok(listed("io.test/one", None)),
		];

		let kept = normalised(OFFICIAL_SOURCE, 4, read);

		assert_eq!(
			names(kept.into_iter().map(|listing| listing.application).collect()),
			["@owner/one", "io.test/one"]
		);
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
