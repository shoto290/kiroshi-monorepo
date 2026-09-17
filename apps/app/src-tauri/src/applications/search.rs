use super::contract::{Application, ApplicationSearch, ApplicationsError};
use super::directory::Directory;
use super::registry::OFFICIAL_SOURCE;
use super::{catalogue, registry};

const SHORTEST_TERM: usize = 3;

type Sought = Result<Option<Application>, ApplicationsError>;

pub async fn named(official: &str, directory: &Directory, name: &str) -> Sought {
	if let Some(curated) = catalogue::curated()?.into_iter().find(|held| held.name == name) {
		return Ok(Some(curated));
	}
	if let Some(held) = directory.named(name) {
		return Ok(Some(held));
	}
	registry::detail(official, name).await
}

pub async fn search(
	official: &str,
	directory: &Directory,
	query: &str,
) -> Result<ApplicationSearch, ApplicationsError> {
	match directory.searched(query).await {
		Ok(answered) => Ok(answered),
		Err(unread) => fallen_back(official, query, unread).await,
	}
}

async fn fallen_back(
	official: &str,
	query: &str,
	unread: ApplicationsError,
) -> Result<ApplicationSearch, ApplicationsError> {
	let applications = registry::search(official, query).await.map_err(|failure| {
		eprintln!("{OFFICIAL_SOURCE} answered nothing for {query:?}: {failure:?}");
		unread.clone()
	})?;
	Ok(ApplicationSearch {
		applications,
		registry_failure: Some(unread),
		read_at: None,
		is_stale: None,
	})
}

pub(super) fn terms(query: &str) -> Vec<String> {
	query
		.split_whitespace()
		.filter(|term| term.chars().count() >= SHORTEST_TERM)
		.map(str::to_lowercase)
		.collect()
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::applications::directory::tests as directory_stub;
	use crate::applications::directory::DIRECTORY;
	use crate::applications::registry::tests as official_stub;
	use crate::applications::registry::tests::unreached;

	fn an_unread_directory() -> Directory {
		Directory::at(DIRECTORY.to_owned(), None)
	}

	async fn a_directory_answering_nothing() -> Directory {
		let (base, _) = directory_stub::serving(vec![directory_stub::a_page(&[])]).await;
		Directory::at(base, None)
	}

	fn names(answered: ApplicationSearch) -> Vec<String> {
		answered.applications.into_iter().map(|held| held.name).collect()
	}

	#[tokio::test]
	async fn a_curated_name_answers_from_the_catalogue_and_the_registry_is_not_read() {
		let (official, listed) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = named(&official, &an_unread_directory(), "superset")
			.await
			.expect("the name resolves");

		assert_eq!(answered.map(|held| held.name), Some("superset".to_owned()));
		assert!(listed.detailed.lock().expect("the stub records").is_empty(), "a detail was read");
	}

	#[tokio::test]
	async fn a_name_the_directory_holds_answers_from_it_and_the_registry_is_not_read() {
		let (base, _) = directory_stub::serving(vec![directory_stub::a_page(&["linear"])]).await;
		let directory = Directory::at(base, None);
		directory.refreshed().await;
		let (official, listed) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered =
			named(&official, &directory, "linear").await.expect("the name resolves");

		assert_eq!(answered.map(|held| held.name), Some("linear".to_owned()));
		assert!(listed.detailed.lock().expect("the stub records").is_empty(), "a detail was read");
	}

	#[tokio::test]
	async fn a_name_only_the_official_registry_carries_answers_from_it() {
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = named(&official, &an_unread_directory(), "com.notion/mcp")
			.await
			.expect("the name resolves");

		assert_eq!(answered.map(|held| held.name), Some("com.notion/mcp".to_owned()));
	}

	#[tokio::test]
	async fn a_name_no_source_carries_answers_nothing_and_raises_no_failure() {
		let (official, _) = official_stub::serving(official_stub::holding(Vec::new())).await;

		let answered = named(&official, &an_unread_directory(), "io.test/nowhere").await;

		assert_eq!(answered.expect("the name resolves").map(|held| held.name), None);
	}

	#[tokio::test]
	async fn a_name_no_source_carries_while_the_registry_is_unreached_answers_that_failure() {
		let answered =
			named(&unreached().await, &an_unread_directory(), "io.test/nowhere").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreached { .. })),
			"got {:?}",
			answered.map(|held| held.map(|found| found.name))
		);
	}

	#[tokio::test]
	async fn a_listing_answers_the_directory_rows_and_the_official_registry_is_not_read() {
		let (base, _) = directory_stub::serving(vec![directory_stub::a_page(&["linear"])]).await;
		let (official, listed) =
			official_stub::serving(official_stub::holding(vec!["com.notion/mcp"])).await;
		let directory = Directory::at(base, None);

		let answered =
			search(&official, &directory, "").await.expect("the listing answers");

		assert_eq!(names(answered), ["linear"]);
		assert!(listed.asked.lock().expect("the stub records").is_empty(), "the registry was read");
	}

	#[tokio::test]
	async fn a_query_answers_the_directory_rows_and_the_official_registry_is_not_read() {
		let (base, _) =
			directory_stub::serving(vec![directory_stub::a_page(&["linear", "notion"])]).await;
		let (official, listed) =
			official_stub::serving(official_stub::holding(vec!["com.notion/mcp"])).await;
		let directory = Directory::at(base, None);

		let answered =
			search(&official, &directory, "linear").await.expect("the query answers");

		assert_eq!(names(answered), ["linear"]);
		assert!(listed.asked.lock().expect("the stub records").is_empty(), "the registry was read");
	}

	#[tokio::test]
	async fn an_unread_directory_answers_the_official_registry_rows_and_carries_its_failure() {
		let (official, _) =
			official_stub::serving(official_stub::holding(vec!["com.notion/mcp"])).await;

		let answered = search(&official, &a_directory_answering_nothing().await, "notion")
			.await
			.expect("the query answers");

		assert!(
			matches!(answered.registry_failure, Some(ApplicationsError::RegistryUnreadable { .. })),
			"got {:?}",
			answered.registry_failure
		);
		assert_eq!(names(answered), ["com.notion/mcp"]);
	}

	#[tokio::test]
	async fn an_unread_directory_and_an_unreached_registry_answer_the_directory_failure() {
		let answered =
			search(&unreached().await, &a_directory_answering_nothing().await, "notion").await;

		assert!(
			matches!(answered, Err(ApplicationsError::RegistryUnreadable { .. })),
			"got {:?}",
			answered.map(names)
		);
	}

	#[test]
	fn a_query_keeps_only_the_terms_of_three_characters_or_more_in_lowercase() {
		assert_eq!(terms("My Issues an"), ["issues"]);
		assert_eq!(terms("an my"), Vec::<String>::new());
		assert_eq!(terms(""), Vec::<String>::new());
	}
}
