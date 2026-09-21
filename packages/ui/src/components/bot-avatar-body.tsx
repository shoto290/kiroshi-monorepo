"use client"

import { round2, VIEW_BOX } from "@workspace/ui/components/bot-avatar-3d"
import type {
	BotAvatarAnimal,
	BotAvatarAnimalDefinition,
	BotAvatarEar,
	BotAvatarShape,
} from "@workspace/ui/components/bot-avatar-animals"
import {
	BLOT_BOX,
	BLOT_PATH,
	blotTransform,
} from "@workspace/ui/components/bot-avatar-blot"
import {
	type BotAvatarEarLayer,
	PARTS,
} from "@workspace/ui/components/bot-avatar-engine"

const AUTHORED_WEIGHT = 5.5

const INK = "var(--bot-avatar-ink, currentColor)"

const STROKE_BASE = {
	stroke: INK,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const

const ROLE_PROPS = {
	outline: { ...STROKE_BASE, fill: "none" },
	line: { ...STROKE_BASE, fill: "none" },
	accent: { fill: "var(--bot-avatar-accent, #e36f3d)", stroke: "none" },
} as const

const HEAD_MASK_BOUNDS = { x: -240, y: -240, width: 720, height: 720 } as const

const BLOT_RATIO = 16 / 15
const BLOT_SPAN = VIEW_BOX * BLOT_RATIO
const BLOT_INSET = round2((VIEW_BOX - BLOT_SPAN) / 2)
const BLOT_PLACEMENT = `translate(${BLOT_INSET} ${BLOT_INSET}) scale(${round2(BLOT_SPAN / BLOT_BOX)})`

const shapeKey = (shape: BotAvatarShape) =>
	shape.kind === "path"
		? `${shape.role}-${shape.d.slice(0, 24)}`
		: `${shape.kind}-${shape.role}-${shape.cx}-${shape.cy}`

const isOccluded = (shape: BotAvatarShape) =>
	"isOccluded" in shape && shape.isOccluded === true

const eyeFill = (definition: BotAvatarAnimalDefinition) =>
	definition.hasInkEyes ? INK : "currentColor"

type EarLayerProps = {
	animal: BotAvatarAnimal
	ears: BotAvatarEar[]
	layer: BotAvatarEarLayer
	weight: number
	splitId: string
}

const EarLayer = ({ animal, ears, layer, weight, splitId }: EarLayerProps) => (
	<g>
		{ears.map((ear, index) => (
			<g
				clipPath={layer === "front" ? `url(#${splitId}-${index})` : undefined}
				key={`${animal}-ear-${ear.pivot[0]}`}
			>
				<g data-part={PARTS.ear(index, layer)}>
					{ear.shapes.map((shape) => (
						<Shape key={shapeKey(shape)} shape={shape} weight={weight} />
					))}
				</g>
			</g>
		))}
	</g>
)

type ShapeProps = { shape: BotAvatarShape; weight: number }

function Shape({ shape, weight }: ShapeProps) {
	const authored =
		"strokeWidth" in shape && shape.strokeWidth !== undefined
			? shape.strokeWidth
			: AUTHORED_WEIGHT
	const props = {
		...ROLE_PROPS[shape.role],
		strokeWidth: round2((authored * weight) / AUTHORED_WEIGHT),
	}
	if (shape.kind === "circle") {
		return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props} />
	}
	if (shape.kind === "ellipse") {
		return (
			<ellipse
				cx={shape.cx}
				cy={shape.cy}
				rx={shape.rx}
				ry={shape.ry}
				{...props}
			/>
		)
	}
	return <path d={shape.d} {...props} />
}

type BotAvatarBodyProps = {
	animal: BotAvatarAnimal
	blotFill?: string
	boil: number
	clipId: string
	definition: BotAvatarAnimalDefinition
	filterId: string
	headMaskId: string
	headPathId: string
	seed?: string
	splitId: string
	weight: number
	wireframe: boolean
}

const BotAvatarBody = ({
	animal,
	blotFill,
	boil,
	clipId,
	definition,
	filterId,
	headMaskId,
	headPathId,
	seed,
	splitId,
	weight,
	wireframe,
}: BotAvatarBodyProps) => (
	<>
		<defs>
			<filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
				<feTurbulence
					data-part={PARTS.noise}
					type="fractalNoise"
					baseFrequency="0.024"
					numOctaves="3"
					seed="3"
					result="n"
				/>
				<feDisplacementMap in="SourceGraphic" in2="n" scale={boil} />
			</filter>
			<path data-part={PARTS.headClip} d={definition.head} id={headPathId} />
			<clipPath id={clipId}>
				<use href={`#${headPathId}`} />
			</clipPath>
			<mask id={headMaskId} maskUnits="userSpaceOnUse" {...HEAD_MASK_BOUNDS}>
				<rect fill="white" {...HEAD_MASK_BOUNDS} />
				<use fill="black" href={`#${headPathId}`} />
			</mask>
			{definition.ears.map((ear, index) => (
				<clipPath
					clipPathUnits="userSpaceOnUse"
					id={`${splitId}-${index}`}
					key={`${animal}-split-${ear.pivot[0]}`}
				>
					<path clipRule="evenodd" d="" data-part={PARTS.earSplit(index)} />
				</clipPath>
			))}
		</defs>
		{blotFill ? (
			<path
				d={BLOT_PATH}
				data-slot="bot-avatar-blot"
				fill={blotFill}
				stroke="none"
				transform={`${BLOT_PLACEMENT} ${blotTransform(seed)}`}
			/>
		) : null}
		<g filter={`url(#${filterId})`}>
			<g data-part={PARTS.rig}>
				<g mask={`url(#${headMaskId})`}>
					<EarLayer
						animal={animal}
						ears={definition.ears}
						layer="back"
						splitId={splitId}
						weight={weight}
					/>
				</g>
				<g data-part={PARTS.head}>
					<path
						d={definition.head}
						{...ROLE_PROPS.outline}
						strokeWidth={round2(weight)}
					/>
				</g>
				{definition.extras.map((shape, index) => (
					<g
						key={shapeKey(shape)}
						mask={isOccluded(shape) ? `url(#${headMaskId})` : undefined}
					>
						<g data-part={PARTS.extra(index)}>
							<Shape shape={shape} weight={weight} />
						</g>
					</g>
				))}
				<EarLayer
					animal={animal}
					ears={definition.ears}
					layer="front"
					splitId={splitId}
					weight={weight}
				/>
				<g data-part={PARTS.blush} opacity={0}>
					<ellipse rx={9} ry={4.5} {...ROLE_PROPS.accent} />
					<ellipse rx={9} ry={4.5} {...ROLE_PROPS.accent} />
				</g>
				<g clipPath={`url(#${clipId})`}>
					<path data-part={PARTS.eye0} fill={eyeFill(definition)} />
					<path data-part={PARTS.eye1} fill={eyeFill(definition)} />
				</g>
				<path
					data-part={PARTS.wire}
					fill="none"
					stroke="var(--bot-avatar-accent, #e36f3d)"
					strokeWidth={1}
					opacity={0.55}
					style={{ display: wireframe ? undefined : "none" }}
				/>
			</g>
		</g>
	</>
)

export { BotAvatarBody }
