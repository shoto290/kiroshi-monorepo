const CLOUD_SETTINGS_FILE: &str = "kiroshi-cloud.conf";

fn cloud_profile_key() -> &'static str {
	match std::env::var("PROFILE").as_deref() {
		Ok("release") => "release",
		_ => "dev",
	}
}

fn cloud_api_url(settings: &str, key: &str) -> Option<String> {
	settings.lines().find_map(|line| {
		let (name, value) = line.split_once('=')?;
		(name.trim() == key).then(|| value.trim().to_owned())
	})
}

fn emit_cloud_api_url() {
	println!("cargo:rerun-if-changed={CLOUD_SETTINGS_FILE}");
	let settings = std::fs::read_to_string(CLOUD_SETTINGS_FILE)
		.unwrap_or_else(|cause| panic!("cannot read {CLOUD_SETTINGS_FILE}: {cause}"));
	let key = cloud_profile_key();
	let url = cloud_api_url(&settings, key)
		.filter(|url| !url.is_empty())
		.unwrap_or_else(|| panic!("{CLOUD_SETTINGS_FILE} has no value for the key `{key}`"));
	println!("cargo:rustc-env=KIROSHI_CLOUD_API_URL={url}");
}

fn main() {
	emit_cloud_api_url();
	tauri_build::build()
}
