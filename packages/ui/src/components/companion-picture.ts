const PICTURE_RADIUS_RATIO = 0.25

const MIN_PICTURE_RADIUS = 6

const companionPictureRadius = (size: number) =>
	Math.max(MIN_PICTURE_RADIUS, size * PICTURE_RADIUS_RATIO)

export { companionPictureRadius }
