// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { usePendingSubmit } from "@workspace/ui/hooks/use-pending-submit"

const LABEL = "Save"

type HarnessProps = {
	submit: () => unknown
}

const Harness = ({ submit }: HarnessProps) => {
	const { isPending, run } = usePendingSubmit()

	return (
		<button
			aria-label={LABEL}
			disabled={isPending}
			onClick={() => run(submit)}
			type="button"
		/>
	)
}

const settle = () => act(async () => {})

describe("usePendingSubmit", () => {
	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("stays idle when the submit returns nothing", () => {
		render(<Harness submit={() => undefined} />)
		fireEvent.click(screen.getByRole("button"))

		expect(screen.getByRole("button")).toHaveProperty("disabled", false)
	})

	it("holds the pending state until the request resolves", async () => {
		let resolve = () => {}
		const request = new Promise<void>((done) => {
			resolve = done
		})
		render(<Harness submit={() => request} />)
		fireEvent.click(screen.getByRole("button"))

		expect(screen.getByRole("button")).toHaveProperty("disabled", true)

		resolve()
		await settle()
		expect(screen.getByRole("button")).toHaveProperty("disabled", false)
	})

	it("clears the pending state and reports a rejected request", async () => {
		const report = vi.spyOn(console, "error").mockImplementation(() => {})
		const unhandled = vi.fn()
		process.on("unhandledRejection", unhandled)
		const failure = new Error("refused")
		render(<Harness submit={() => Promise.reject(failure)} />)
		fireEvent.click(screen.getByRole("button"))

		await settle()
		await new Promise((done) => setTimeout(done, 0))
		process.off("unhandledRejection", unhandled)

		expect(screen.getByRole("button")).toHaveProperty("disabled", false)
		expect(report).toHaveBeenCalledWith(
			"pending submit: the request was rejected",
			failure,
		)
		expect(unhandled).not.toHaveBeenCalled()
	})
})
