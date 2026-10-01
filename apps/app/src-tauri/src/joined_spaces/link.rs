use tauri::Url;

use super::contract::{JoinedSpaceError, LinkPart};
use crate::db::repositories::joined_spaces::JoinedSpace;

const HOST_PARAMETER: &str = "host";
const TOKEN_PARAMETER: &str = "token";
const SPACE_PARAMETER: &str = "space";
const NAME_PARAMETER: &str = "name";

pub fn space_parts(space_id: &str, name: &str) -> String {
	format!("&{SPACE_PARAMETER}={space_id}&{NAME_PARAMETER}={}", percent_encoded(name))
}

pub fn joined_space(
	link: &str,
	id: String,
	name: Option<String>,
) -> Result<JoinedSpace, JoinedSpaceError> {
	let fragment = fragment_of(link)?;
	let host = host_of(parameter(fragment, HOST_PARAMETER))?;
	let token = token_of(parameter(fragment, TOKEN_PARAMETER))?;
	let remote_space_id =
		parameter(fragment, SPACE_PARAMETER).filter(|space| !space.is_empty()).map(str::to_owned);
	let name = name
		.and_then(non_blank)
		.or_else(|| {
			parameter(fragment, NAME_PARAMETER).and_then(percent_decoded).and_then(non_blank)
		})
		.unwrap_or_else(|| authority_of(&host));
	Ok(JoinedSpace {
		id,
		host_url: host.as_str().trim_end_matches('/').to_owned(),
		token,
		remote_space_id,
		name,
	})
}

fn fragment_of(link: &str) -> Result<&str, JoinedSpaceError> {
	match link.trim().split_once('#') {
		Some((_, fragment)) if !fragment.is_empty() => Ok(fragment),
		_ => Err(refused(LinkPart::Fragment, "the link carries no fragment after `#`")),
	}
}

fn parameter<'a>(fragment: &'a str, name: &str) -> Option<&'a str> {
	fragment
		.split('&')
		.filter_map(|pair| pair.split_once('='))
		.find(|(key, _)| *key == name)
		.map(|(_, value)| value)
}

fn non_blank(name: String) -> Option<String> {
	Some(name.trim().to_owned()).filter(|trimmed| !trimmed.is_empty())
}

fn percent_encoded(text: &str) -> String {
	text.bytes()
		.map(|byte| match byte {
			b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
				char::from(byte).to_string()
			}
			_ => format!("%{byte:02X}"),
		})
		.collect()
}

fn percent_decoded(text: &str) -> Option<String> {
	let mut bytes = Vec::with_capacity(text.len());
	let mut rest = text.as_bytes();
	while let Some((&byte, after)) = rest.split_first() {
		if byte != b'%' {
			bytes.push(byte);
			rest = after;
			continue;
		}
		let [high, low, after @ ..] = after else {
			return None;
		};
		bytes.push(hex_digit(*high)? * 16 + hex_digit(*low)?);
		rest = after;
	}
	String::from_utf8(bytes).ok()
}

fn hex_digit(byte: u8) -> Option<u8> {
	char::from(byte).to_digit(16).and_then(|digit| u8::try_from(digit).ok())
}

fn host_of(held: Option<&str>) -> Result<Url, JoinedSpaceError> {
	let held =
		held.ok_or_else(|| refused(LinkPart::Host, "the link fragment carries no `host`"))?;
	match Url::parse(held) {
		Ok(url) if matches!(url.scheme(), "http" | "https") && url.host_str().is_some() => Ok(url),
		_ => Err(refused(LinkPart::Host, "the `host` of the link is not an http or https url")),
	}
}

fn token_of(held: Option<&str>) -> Result<String, JoinedSpaceError> {
	match held.map(str::trim) {
		Some(token) if !token.is_empty() => Ok(token.to_owned()),
		_ => Err(refused(LinkPart::Token, "the `token` of the link is missing or empty")),
	}
}

fn authority_of(host: &Url) -> String {
	let name = host.host_str().unwrap_or_default();
	match host.port() {
		Some(port) => format!("{name}:{port}"),
		None => name.to_owned(),
	}
}

fn refused(part: LinkPart, message: &str) -> JoinedSpaceError {
	JoinedSpaceError::RefusedLink { part, message: message.to_owned() }
}

#[cfg(test)]
mod tests {
	use super::*;

	fn read(link: &str) -> Result<JoinedSpace, JoinedSpaceError> {
		joined_space(link, "id".to_owned(), None)
	}

	fn refused_part(link: &str) -> LinkPart {
		match read(link) {
			Err(JoinedSpaceError::RefusedLink { part, .. }) => part,
			other => panic!("expected a refused link, got {other:?}"),
		}
	}

	#[test]
	fn a_joined_space_link_written_by_a_host_reads_as_its_host_token_and_authority() {
		let joined =
			read("http://127.0.0.1:1420/#host=http://127.0.0.1:45367&token=abc").expect("the link");

		assert_eq!(
			joined,
			JoinedSpace {
				id: "id".to_owned(),
				host_url: "http://127.0.0.1:45367".to_owned(),
				token: "abc".to_owned(),
				remote_space_id: None,
				name: "127.0.0.1:45367".to_owned(),
			}
		);
	}

	#[test]
	fn a_joined_space_link_reads_its_space_and_takes_the_given_name() {
		let joined = joined_space(
			"https://web.test/#space=remote-1&token=abc&host=https://host.test",
			"id".to_owned(),
			Some(" Studio ".to_owned()),
		)
		.expect("the link");

		assert_eq!(joined.host_url, "https://host.test");
		assert_eq!(joined.remote_space_id.as_deref(), Some("remote-1"));
		assert_eq!(joined.name, "Studio");
	}

	#[test]
	fn a_joined_space_link_with_a_blank_name_is_named_after_the_host() {
		let joined = joined_space(
			"x#host=https://host.test&token=abc",
			"id".to_owned(),
			Some(" ".to_owned()),
		)
		.expect("the link");

		assert_eq!(joined.name, "host.test");
	}

	#[test]
	fn a_joined_space_link_reads_its_percent_decoded_name_trimmed() {
		for given in [None, Some(String::new()), Some(" ".to_owned())] {
			let joined = joined_space(
				"x#host=https://host.test&token=abc&space=s1&name=%20Studio%20%26%20Co%20",
				"id".to_owned(),
				given,
			)
			.expect("the link");

			assert_eq!(joined.name, "Studio & Co");
		}
	}

	#[test]
	fn a_given_name_wins_over_the_name_in_the_link() {
		let joined = joined_space(
			"x#host=https://host.test&token=abc&name=Studio",
			"id".to_owned(),
			Some("Mine".to_owned()),
		)
		.expect("the link");

		assert_eq!(joined.name, "Mine");
	}

	#[test]
	fn a_missing_blank_or_unreadable_link_name_falls_back_to_the_host() {
		for name in
			["", "&name=", "&name=%20%20", "&name=%zz", "&name=%2", "&name=%C3", "&name=%+1"]
		{
			let joined =
				read(&format!("x#host=https://host.test:8443&token=abc{name}")).expect("the link");

			assert_eq!(joined.name, "host.test:8443", "for `{name}`");
		}
	}

	#[test]
	fn the_space_parts_round_trip_through_the_link_reader() {
		let name = "Studio & Co =#%+é ~._-";
		let parts = space_parts("s1", name);

		let joined = read(&format!("x#host=https://host.test&token=abc{parts}")).expect("the link");

		assert_eq!(parts, "&space=s1&name=Studio%20%26%20Co%20%3D%23%25%2B%C3%A9%20~._-");
		assert_eq!(joined.remote_space_id.as_deref(), Some("s1"));
		assert_eq!(joined.name, name);
	}

	#[test]
	fn a_joined_space_link_without_a_fragment_is_refused_on_the_fragment() {
		assert_eq!(refused_part("http://x/"), LinkPart::Fragment);
		assert_eq!(refused_part("http://x/#"), LinkPart::Fragment);
	}

	#[test]
	fn a_joined_space_link_without_a_readable_http_host_is_refused_on_the_host() {
		assert_eq!(refused_part("http://x/#host=notaurl"), LinkPart::Host);
		assert_eq!(refused_part("http://x/#host=notaurl&token=abc"), LinkPart::Host);
		assert_eq!(refused_part("http://x/#token=abc"), LinkPart::Host);
		assert_eq!(refused_part("http://x/#host=ftp://h.test&token=abc"), LinkPart::Host);
	}

	#[test]
	fn a_joined_space_link_without_a_token_is_refused_on_the_token() {
		assert_eq!(refused_part("http://x/#host=http://h.test"), LinkPart::Token);
		assert_eq!(refused_part("http://x/#host=http://h.test&token="), LinkPart::Token);
		assert_eq!(refused_part("http://x/#host=http://h.test&token= "), LinkPart::Token);
	}

	#[test]
	fn a_refused_joined_space_link_names_its_part_and_never_echoes_the_token() {
		let refusal = read("http://x/#host=notaurl&token=the-secret").expect_err("refused");

		let printed = format!("{refusal:?}");
		assert!(printed.contains("host"));
		assert!(!printed.contains("the-secret"));
	}
}
