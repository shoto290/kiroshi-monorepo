import { describe, expect, it } from "bun:test"

import { EXECUTABLE_OVERRIDE_ENV } from "./executable"
import {
	CLASSIFY_ASK_USER_QUESTION,
	CONNECTION_KEYS,
	connectionEnv,
	inheritedEnv,
	sessionEnv,
} from "./session-env"

describe("inheritedEnv", () => {
	it("keeps every allowed key the sidecar carries", () => {
		const source = {
			PATH: "/usr/bin",
			HOME: "/home/bean",
			SHELL: "/bin/zsh",
			USER: "bean",
			LOGNAME: "bean",
			TMPDIR: "/tmp",
			LANG: "en_US.UTF-8",
			LC_ALL: "en_US.UTF-8",
			TERM: "xterm",
			TZ: "Europe/Paris",
			HTTP_PROXY: "http://proxy:1",
			HTTPS_PROXY: "http://proxy:2",
			NO_PROXY: "localhost",
			http_proxy: "http://proxy:3",
			https_proxy: "http://proxy:4",
			no_proxy: "127.0.0.1",
			NODE_EXTRA_CA_CERTS: "/certs/corp.pem",
			SSL_CERT_FILE: "/certs/bundle.pem",
			[EXECUTABLE_OVERRIDE_ENV]: "/bin/claude",
		}

		expect(inheritedEnv(source)).toEqual(source)
	})

	it("keeps every Windows key a spawned process needs", () => {
		const source = {
			SystemRoot: "C:\\Windows",
			USERPROFILE: "C:\\Users\\bean",
			APPDATA: "C:\\Users\\bean\\AppData\\Roaming",
			LOCALAPPDATA: "C:\\Users\\bean\\AppData\\Local",
			TEMP: "C:\\Temp",
			TMP: "C:\\Temp",
			PATHEXT: ".COM;.EXE;.BAT;.CMD",
			ComSpec: "C:\\Windows\\system32\\cmd.exe",
		}

		expect(inheritedEnv(source)).toEqual(source)
	})

	it("omits every Windows key a POSIX source does not carry", () => {
		expect(inheritedEnv({ PATH: "/usr/bin" })).toEqual({ PATH: "/usr/bin" })
	})

	it("drops a key the allowlist does not name", () => {
		const env = inheritedEnv({ PATH: "/usr/bin", ANTHROPIC_API_KEY: "sk-live" })

		expect(env).toEqual({ PATH: "/usr/bin" })
	})

	it("drops BROWSER, which the sign-in sets to a command opening nothing", () => {
		expect(inheritedEnv({ PATH: "/usr/bin", BROWSER: "open" })).toEqual({
			PATH: "/usr/bin",
		})
	})

	it("omits an allowed key the sidecar does not carry", () => {
		expect(inheritedEnv({ PATH: "/usr/bin" })).not.toHaveProperty("HOME")
	})

	it("carries the config directory the host names", () => {
		const source = { PATH: "/usr/bin", CLAUDE_CONFIG_DIR: "/tmp/claude-config" }

		expect(inheritedEnv(source)).toEqual(source)
	})
})

describe("connectionEnv", () => {
	it("keeps the two connection names and no other name of the base", () => {
		const base = {
			ANTHROPIC_API_KEY: "sk-stored",
			CLAUDE_CODE_OAUTH_TOKEN: "token",
			LINEAR_KEY: "lin",
		}

		expect(connectionEnv(base)).toEqual({
			ANTHROPIC_API_KEY: "sk-stored",
			CLAUDE_CODE_OAUTH_TOKEN: "token",
		})
	})

	it("carries nothing while the base holds no connection name", () => {
		expect(connectionEnv({ LINEAR_KEY: "lin" })).toEqual({})
		expect(connectionEnv()).toEqual({})
	})
})

describe("sessionEnv", () => {
	it("is the allowlist, the stored source and the session switches", () => {
		const env = sessionEnv(
			{ ANTHROPIC_API_KEY: "sk-stored", LINEAR_KEY: "lin" },
			{ PATH: "/usr/bin", CLAUDE_CODE_OAUTH_TOKEN: "from-the-host" },
		)

		expect(env).toEqual({
			PATH: "/usr/bin",
			ANTHROPIC_API_KEY: "sk-stored",
			CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
			[CLASSIFY_ASK_USER_QUESTION]: "0",
		})
	})

	it("reads no connection source from the host environment", () => {
		const host = { PATH: "/usr/bin", ANTHROPIC_API_KEY: "sk-host" }

		for (const key of CONNECTION_KEYS) {
			expect(sessionEnv(undefined, host)).not.toHaveProperty(key)
		}
	})
})
