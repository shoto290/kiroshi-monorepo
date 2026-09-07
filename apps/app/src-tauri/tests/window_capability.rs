use std::collections::BTreeSet;

use serde_json::Value;

const HOST: &str = include_str!("../../src/lib/host.ts");
const CAPABILITY: &str = include_str!("../capabilities/default.json");
const DEV_CONFIG: &str = include_str!("../tauri.dev.conf.json");

const WINDOW_PREFIX: &str = "core:window:allow-";
const CORE_DEFAULT: &str = "core:default";
const HANDLE_FACTORY: &str = "getCurrentWindow()";

const WINDOW_COMMANDS_OF_CORE_DEFAULT: &[&str] = &["is-focused"];

// The drag region handler the webview injects invokes `start_dragging` on the press
// itself, so no line of host.ts names it.
const WINDOW_COMMANDS_OF_THE_DRAG_REGION: &[&str] = &["start-dragging"];

fn kebab(method: &str) -> String {
	method.chars().fold(String::new(), |mut name, letter| {
		if letter.is_ascii_uppercase() {
			name.push('-');
		}
		name.push(letter.to_ascii_lowercase());
		name
	})
}

fn is_event_subscription(method: &str) -> bool {
	method.starts_with("on")
}

fn window_handles(source: &str) -> Vec<&str> {
	source
		.lines()
		.filter(|line| line.contains(HANDLE_FACTORY))
		.filter_map(|line| line.split_once('='))
		.filter_map(|(binding, _)| binding.split_whitespace().last())
		.collect()
}

fn commands_called_by_the_front(source: &str) -> BTreeSet<String> {
	let mut commands: BTreeSet<String> =
		WINDOW_COMMANDS_OF_THE_DRAG_REGION.iter().map(ToString::to_string).collect();
	for handle in window_handles(source) {
		let needle = format!("{handle}.");
		for (index, _) in source.match_indices(&needle) {
			let follows_an_identifier = source[..index]
				.chars()
				.next_back()
				.is_some_and(|letter| letter.is_ascii_alphanumeric() || letter == '_');
			if follows_an_identifier {
				continue;
			}
			let rest = &source[index + needle.len()..];
			let method: String = rest.chars().take_while(char::is_ascii_alphanumeric).collect();
			if !rest[method.len()..].starts_with('(') || is_event_subscription(&method) {
				continue;
			}
			commands.insert(kebab(&method));
		}
	}
	commands
}

fn named_permissions(capability: &str) -> Vec<String> {
	let parsed: Value = serde_json::from_str(capability).expect("the capability is valid JSON");
	parsed["permissions"]
		.as_array()
		.expect("the capability lists its permissions")
		.iter()
		.filter_map(Value::as_str)
		.map(ToString::to_string)
		.collect()
}

fn window_commands_of(permissions: &[String]) -> BTreeSet<String> {
	permissions
		.iter()
		.filter_map(|entry| entry.strip_prefix(WINDOW_PREFIX))
		.map(ToString::to_string)
		.collect()
}

fn granted_window_commands(capability: &str) -> BTreeSet<String> {
	let permissions = named_permissions(capability);
	let mut granted = window_commands_of(&permissions);
	if permissions.iter().any(|entry| entry == CORE_DEFAULT) {
		granted.extend(WINDOW_COMMANDS_OF_CORE_DEFAULT.iter().map(ToString::to_string));
	}
	granted
}

fn listed(commands: BTreeSet<String>) -> String {
	commands
		.iter()
		.map(|command| format!("{WINDOW_PREFIX}{command}"))
		.collect::<Vec<_>>()
		.join(", ")
}

fn declares(config: &Value, key: &str) -> bool {
	match config {
		Value::Object(fields) => {
			fields.contains_key(key) || fields.values().any(|nested| declares(nested, key))
		}
		Value::Array(items) => items.iter().any(|item| declares(item, key)),
		_ => false,
	}
}

#[test]
fn the_capability_grants_every_window_command_the_front_calls() {
	let granted = granted_window_commands(CAPABILITY);
	let missing: BTreeSet<String> = commands_called_by_the_front(HOST)
		.into_iter()
		.filter(|command| !granted.contains(command))
		.collect();
	assert!(missing.is_empty(), "the capability is missing {}", listed(missing));
}

#[test]
fn the_capability_grants_no_window_command_the_front_leaves_uncalled() {
	let called = commands_called_by_the_front(HOST);
	let unused: BTreeSet<String> = window_commands_of(&named_permissions(CAPABILITY))
		.into_iter()
		.filter(|command| !called.contains(command))
		.collect();
	assert!(unused.is_empty(), "the capability grants {} that nothing calls", listed(unused));
}

#[test]
fn the_front_calls_set_focus_on_the_reveal_path() {
	assert!(
		commands_called_by_the_front(HOST).contains("set-focus"),
		"host.ts no longer brings the window to the front"
	);
}

#[test]
fn the_dev_config_leaves_the_capability_to_the_base_config() {
	let config: Value = serde_json::from_str(DEV_CONFIG).expect("the dev config is valid JSON");
	for key in ["security", "capabilities"] {
		assert!(
			!declares(&config, key),
			"tauri.dev.conf.json declares `{key}`, so com.kiroshi.app.dev no longer shares the capability of com.kiroshi.app"
		);
	}
}
