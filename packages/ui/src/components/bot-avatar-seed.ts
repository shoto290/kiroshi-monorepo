const seedHash = (seed: string) => {
	let hash = 0
	for (let at = 0; at < seed.length; at += 1) {
		hash = ((hash << 5) - hash + seed.charCodeAt(at)) | 0
	}
	return Math.abs(hash)
}

export { seedHash }
