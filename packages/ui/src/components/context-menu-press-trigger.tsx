"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import {
	cloneElement,
	type HTMLAttributes,
	type MouseEvent,
	type ReactElement,
} from "react"

import { ContextMenuTrigger } from "@workspace/ui/components/ui/context-menu"

interface ContextMenuPressTriggerProps {
	render: ReactElement<HTMLAttributes<HTMLElement>>
}

const openBelow = (event: MouseEvent<HTMLElement>) => {
	const { left, bottom } = event.currentTarget.getBoundingClientRect()
	event.currentTarget.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			clientX: left,
			clientY: bottom,
		}),
	)
}

export const ContextMenuPressTrigger = ({
	render,
}: ContextMenuPressTriggerProps) => (
	<ContextMenuTrigger
		aria-haspopup="menu"
		onClick={openBelow}
		render={(props, state) =>
			cloneElement(
				render,
				mergeProps<"div">(props, render.props, {
					"aria-expanded": state.open,
				}),
			)
		}
	/>
)
