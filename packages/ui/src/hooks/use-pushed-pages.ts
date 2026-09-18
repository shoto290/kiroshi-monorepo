"use client"

import {
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react"

type PushedLevel<Level extends string> = {
	level: Level
	opener?: string
}

type OwnedLevel<Level extends string> = {
	level: Level
	isOpen: boolean
}

type PushedPagesOptions<Level extends string> = {
	owned?: OwnedLevel<Level>[]
	surface?: RefObject<HTMLElement | null>
}

type PushedPages<Level extends string> = {
	top: Level | null
	depth: number
	isPushed: (level: Level) => boolean
	push: (level: Level, opener?: string) => void
	leave: (level: Level) => void
	shown: (pages: Partial<Record<Level, ReactNode>>) => ReactNode
}

const without = <Level extends string>(
	levels: PushedLevel<Level>[],
	left: PushedLevel<Level>[],
) => levels.filter(({ level }) => !left.some((it) => it.level === level))

const focusOpener = (opener: string, surface: ParentNode) =>
	surface
		.querySelector<HTMLElement>(`[data-opens="${opener}"]`)
		?.focus({ preventScroll: true })

const usePushedPages = <Level extends string>({
	owned = [],
	surface,
}: PushedPagesOptions<Level> = {}): PushedPages<Level> => {
	const [pushed, setPushed] = useState<PushedLevel<Level>[]>([])
	const isOpen = ({ level }: PushedLevel<Level>) =>
		owned.find((it) => it.level === level)?.isOpen ?? true
	const openedByCaller = owned
		.filter(
			({ level, isOpen }) => isOpen && !pushed.some((it) => it.level === level),
		)
		.map(({ level }) => ({ level }))
	const stack = [...pushed.filter(isOpen), ...openedByCaller]
	const shownStack = useRef(stack)

	useEffect(() => {
		const left = without(shownStack.current, stack)
		shownStack.current = stack
		if (left.length === 0) return

		setPushed((held) => without(held, left))
		const opener = left.at(-1)?.opener
		if (opener) focusOpener(opener, surface?.current ?? document)
	})

	const top = stack.at(-1)?.level ?? null

	return {
		top,
		depth: stack.length,
		isPushed: (level) => stack.some((it) => it.level === level),
		push: (level, opener) =>
			setPushed((held) => [
				...held.filter((it) => it.level !== level),
				{ level, opener },
			]),
		leave: (level) =>
			setPushed((held) => held.filter((it) => it.level !== level)),
		shown: (pages) => (top ? (pages[top] ?? null) : null),
	}
}

export { type PushedPages, usePushedPages }
