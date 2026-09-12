import type { FileSink, Subprocess } from "bun"

import { resolveExecutable } from "./executable"
import { inheritedEnv } from "./session-env"

import type { EmitFrame, SignInAnswer, SignInFailure } from "../provider"
import { describeError } from "../../describe-error"
import { readLines } from "../../read-lines"

export const SIGN_IN_STARTED = "sign_in_started"

export const SIGN_IN_TIMEOUT_MS = 300_000

export const NO_BROWSER = "true"

const URL_LINE = /visit:.*?(https?:\/\/[!-~]+)/

const FAILURE_LINE = /login failed:\s*(.+)$/i

type Login = Subprocess<"pipe", "pipe", "pipe">

type Running = {
	stdin: FileSink
	stop: (failure: SignInFailure) => void
}

let running: Running | undefined

const refused = (failure: SignInFailure): SignInAnswer => ({
	signedIn: false,
	error: failure,
})

const spawnLogin = (): Login =>
	Bun.spawn([resolveExecutable(), "auth", "login"], {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		env: { ...inheritedEnv(), BROWSER: NO_BROWSER },
	})

const eachLine = async (
	stream: ReadableStream<Uint8Array>,
	read: (line: string) => void,
) => {
	for await (const line of readLines(stream)) {
		read(line)
	}
}

const reportedFailure = async (login: Login, emit: EmitFrame) => {
	let failure: string | undefined
	let hasStarted = false
	const noteFailure = (line: string) => {
		failure = FAILURE_LINE.exec(line)?.[1]?.trim() ?? failure
	}
	const announceUrl = (line: string) => {
		const url = URL_LINE.exec(line)?.[1]
		if (!url || hasStarted) {
			return
		}
		hasStarted = true
		emit({ type: SIGN_IN_STARTED, url })
	}
	try {
		await Promise.all([
			eachLine(login.stdout, (line) => {
				noteFailure(line)
				announceUrl(line)
			}),
			eachLine(login.stderr, noteFailure),
		])
		return failure
	} catch (error) {
		return failure ?? describeError(error)
	}
}

const settled = async (
	login: Login,
	emit: EmitFrame,
	stopped: () => SignInFailure | undefined,
): Promise<SignInAnswer> => {
	const failure = reportedFailure(login, emit)
	const status = await login.exited
	const stop = stopped()
	if (stop) {
		return refused(stop)
	}
	const detail = await failure
	if (status === 0) {
		return { signedIn: true }
	}
	return refused({
		kind: "failed",
		detail: detail ?? `the sign-in exited with status ${status}`,
	})
}

export const signInClaude = async (
	emit: EmitFrame,
	timeoutMs = SIGN_IN_TIMEOUT_MS,
): Promise<SignInAnswer> => {
	if (running) {
		return refused({
			kind: "busy",
			detail: "another sign-in is already running",
		})
	}
	let login: Login
	try {
		login = spawnLogin()
	} catch (error) {
		return refused({ kind: "failed", detail: describeError(error) })
	}
	let stopped: SignInFailure | undefined
	const stop = (failure: SignInFailure) => {
		stopped ??= failure
		login.kill()
	}
	running = { stdin: login.stdin, stop }
	const expiry = setTimeout(() => stop({ kind: "timedOut" }), timeoutMs)
	try {
		return await settled(login, emit, () => stopped)
	} finally {
		clearTimeout(expiry)
		running = undefined
	}
}

const written = async (stdin: FileSink, text: string) => {
	stdin.write(`${text}\n`)
	await stdin.flush()
}

export const enterClaudeSignInCode = (text: string) => {
	const flow = running
	if (!flow) {
		return
	}
	written(flow.stdin, text).catch((error) =>
		flow.stop({ kind: "failed", detail: describeError(error) }),
	)
}

export const cancelClaudeSignIn = () => {
	running?.stop({ kind: "cancelled" })
}
