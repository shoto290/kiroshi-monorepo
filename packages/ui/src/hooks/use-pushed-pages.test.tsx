// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { usePushedPages } from "@workspace/ui/hooks/use-pushed-pages"

type Level = "list" | "detail" | "form"

type HarnessProps = {
	isDetailOpen?: boolean
	isFormOpen?: boolean
}

const Harness = ({
	isDetailOpen = false,
	isFormOpen = false,
}: HarnessProps) => {
	const surface = useRef<HTMLDivElement>(null)
	const pages = usePushedPages<Level>({
		owned: [
			{ level: "detail", isOpen: isDetailOpen },
			{ level: "form", isOpen: isFormOpen },
		],
		surface,
	})

	return (
		<div ref={surface}>
			<button
				data-testid="push-list"
				onClick={() => pages.push("list")}
				type="button"
			/>
			<button
				data-testid="leave-list"
				onClick={() => pages.leave("list")}
				type="button"
			/>
			<button
				data-opens="detail-opener"
				data-testid="push-detail"
				onClick={() => pages.push("detail", "detail-opener")}
				type="button"
			/>
			<button data-testid="elsewhere" type="button" />
			<output data-testid="depth">{pages.depth}</output>
			{pages.shown({
				list: <p data-testid="list-page" />,
				detail: <p data-testid="detail-page" />,
				form: <p data-testid="form-page" />,
			})}
		</div>
	)
}

const depth = () => screen.getByTestId("depth").textContent
const isShown = (testId: string) => screen.queryByTestId(testId) !== null
const click = (testId: string) => fireEvent.click(screen.getByTestId(testId))

afterEach(cleanup)

describe("usePushedPages", () => {
	it("drops a pushed level once it is left", () => {
		render(<Harness />)

		click("push-list")
		expect(depth()).toBe("1")
		expect(isShown("list-page")).toBe(true)

		click("leave-list")
		expect(depth()).toBe("0")
		expect(isShown("list-page")).toBe(false)
	})

	it("drops a caller-owned level whose flag turns false and focuses its opener", () => {
		const { rerender } = render(<Harness />)

		click("push-detail")
		rerender(<Harness isDetailOpen />)
		expect(depth()).toBe("1")
		screen.getByTestId("elsewhere").focus()

		rerender(<Harness />)
		expect(depth()).toBe("0")
		expect(document.activeElement).toBe(screen.getByTestId("push-detail"))
	})

	it("leaves focus in place when a level opened by its flag alone closes", () => {
		const { rerender } = render(<Harness isDetailOpen />)
		const elsewhere = screen.getByTestId("elsewhere")
		elsewhere.focus()

		rerender(<Harness />)
		expect(depth()).toBe("0")
		expect(document.activeElement).toBe(elsewhere)
	})

	it("renders the page of the top level only", () => {
		const { rerender } = render(<Harness />)

		click("push-list")
		rerender(<Harness isDetailOpen />)
		expect(isShown("detail-page")).toBe(true)
		expect(isShown("list-page")).toBe(false)
	})

	it("stacks two flags turning true in one commit in the written order", () => {
		const { rerender } = render(<Harness />)

		rerender(<Harness isDetailOpen isFormOpen />)
		expect(depth()).toBe("2")
		expect(isShown("form-page")).toBe(true)

		rerender(<Harness isDetailOpen />)
		expect(isShown("detail-page")).toBe(true)
	})
})
