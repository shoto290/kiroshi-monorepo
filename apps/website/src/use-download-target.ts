import { type MouseEvent, useEffect, useState } from "react"

import { LATEST_RELEASE_URL, RELEASES_URL } from "./copy"

export type DownloadPlatform = "macos" | "windows" | "other"

type ReleaseAsset = {
	name: string
	browser_download_url: string
}

const PLATFORM_ASSET_SUFFIX: Record<DownloadPlatform, string | null> = {
	macos: "_aarch64.dmg",
	windows: "-setup.exe",
	other: null,
}

const UPDATER_ASSET_SUFFIXES = [".sig", ".app.tar.gz"]
const UPDATER_MANIFEST = "latest.json"

const detectPlatform = (): DownloadPlatform => {
	const agent = navigator.userAgent
	if (/iPhone|iPad|iPod/.test(agent)) return "other"
	if (/Mac/.test(agent)) return navigator.maxTouchPoints > 1 ? "other" : "macos"
	if (/Win/.test(agent)) return "windows"
	return "other"
}

const VISITOR_PLATFORM = detectPlatform()

const fetchLatestAssets = async () => {
	const response = await fetch(LATEST_RELEASE_URL, {
		headers: { Accept: "application/vnd.github+json" },
	})
	if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
	const release = (await response.json()) as { assets: ReleaseAsset[] }
	return release.assets
}

let latestAssetsRequest: Promise<ReleaseAsset[]> | null = null

const latestAssets = () => {
	latestAssetsRequest ??= fetchLatestAssets()
	return latestAssetsRequest
}

const isDistributable = ({ name }: ReleaseAsset) =>
	name !== UPDATER_MANIFEST &&
	UPDATER_ASSET_SUFFIXES.every((suffix) => !name.endsWith(suffix))

const platformAssetUrl = (assets: ReleaseAsset[]) => {
	const suffix = PLATFORM_ASSET_SUFFIX[VISITOR_PLATFORM]
	if (suffix === null) return null
	const asset = assets
		.filter(isDistributable)
		.find(({ name }) => name.endsWith(suffix))
	return asset?.browser_download_url ?? null
}

const OFFERS_NO_ASSET = PLATFORM_ASSET_SUFFIX[VISITOR_PLATFORM] === null

const resolvedTarget = () =>
	latestAssets()
		.then((assets) => platformAssetUrl(assets) ?? RELEASES_URL)
		.catch(() => RELEASES_URL)

export const useDownloadTarget = () => {
	const [target, setTarget] = useState<string | null>(
		OFFERS_NO_ASSET ? RELEASES_URL : null,
	)

	useEffect(() => {
		if (OFFERS_NO_ASSET) return
		let listening = true
		resolvedTarget().then((url) => {
			if (listening) setTarget(url)
		})
		return () => {
			listening = false
		}
	}, [])

	const transferOnceResolved = (event: MouseEvent<HTMLAnchorElement>) => {
		if (target !== null) return
		event.preventDefault()
		resolvedTarget().then((url) => {
			window.location.href = url
		})
	}

	return {
		href: target ?? RELEASES_URL,
		onActivate: transferOnceResolved,
		platform: VISITOR_PLATFORM,
	}
}
