"use client"

import { type ComponentProps, useEffect, useRef } from "react"

import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const TOGGLE_SHORTCUT_KEY = "b"

const isToggleShortcut = (event: KeyboardEvent) =>
	event.key === TOGGLE_SHORTCUT_KEY && (event.metaKey || event.ctrlKey)

type NestedSidebarProviderProps = ComponentProps<typeof SidebarProvider> & {
	open: boolean
	onOpenChange: (isOpen: boolean) => void
}

const NestedSidebarProvider = ({
	onOpenChange,
	...props
}: NestedSidebarProviderProps) => {
	const isShortcutDown = useRef(false)

	useEffect(() => {
		const mark = (event: KeyboardEvent) => {
			isShortcutDown.current = isToggleShortcut(event)
		}
		const clear = () => {
			isShortcutDown.current = false
		}
		window.addEventListener("keydown", mark, true)
		window.addEventListener("keyup", clear, true)
		return () => {
			window.removeEventListener("keydown", mark, true)
			window.removeEventListener("keyup", clear, true)
		}
	}, [])

	return (
		<SidebarProvider
			{...props}
			onOpenChange={(isOpen) => {
				if (isShortcutDown.current) return
				onOpenChange(isOpen)
			}}
		/>
	)
}

export { NestedSidebarProvider, type NestedSidebarProviderProps }
