"use client"

import { type RefObject, useEffect, useLayoutEffect, useMemo } from "react"

import type { BotAvatarAnimalDefinition } from "@workspace/ui/components/bot-avatar-animals"
import type { BotAvatarState } from "@workspace/ui/components/bot-avatar-data"
import { BotAvatarEngine } from "@workspace/ui/components/bot-avatar-engine"

type BotAvatarBinding = {
	svgRef: RefObject<SVGSVGElement | null>
	definition: BotAvatarAnimalDefinition
	state: BotAvatarState
	yaw?: number
	pitch?: number
	roll?: number
	gazeYaw?: number
	gazePitch?: number
	perspective: number
	wireframe: boolean
	isAnimated: boolean
}

const useBotAvatarBinding = ({
	svgRef,
	definition,
	state,
	yaw,
	pitch,
	roll,
	gazeYaw,
	gazePitch,
	perspective,
	wireframe,
	isAnimated,
}: BotAvatarBinding) => {
	const engine = useMemo(() => new BotAvatarEngine(definition), [definition])
	const heldGaze = useMemo(
		() =>
			gazeYaw === undefined && gazePitch === undefined
				? null
				: { yaw: gazeYaw ?? 0, pitch: gazePitch ?? 0 },
		[gazeYaw, gazePitch],
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-time setup — the effects below own every later change
	useLayoutEffect(() => {
		if (!svgRef.current) return
		engine.bind(svgRef.current)
		engine.setState(state)
		engine.setPerspective(perspective)
		engine.setWireframe(wireframe)
		engine.setOrientation({ yaw, pitch, roll })
		engine.setGaze(heldGaze)
		if (!isAnimated) {
			engine.renderStatic()
			return
		}
		engine.start()
		return () => engine.stop()
	}, [engine, isAnimated])

	useEffect(() => {
		engine.setState(state)
		if (!isAnimated) engine.renderStatic()
	}, [engine, state, isAnimated])

	useEffect(() => {
		engine.setPerspective(perspective)
		engine.setWireframe(wireframe)
		engine.setOrientation({ yaw, pitch, roll })
		engine.setGaze(heldGaze)
		if (!isAnimated) engine.renderStatic()
	}, [engine, yaw, pitch, roll, heldGaze, perspective, wireframe, isAnimated])
}

export { useBotAvatarBinding }
