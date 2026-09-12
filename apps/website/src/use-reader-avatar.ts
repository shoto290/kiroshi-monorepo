import { useEffect, useState } from "react"

import { AUTHOR_X_AVATAR_URL } from "./copy"

import committedReaderAvatar from "./assets/reader-avatar.jpg"

const loadedPicture = (url: string) =>
	new Promise<string | null>((settle) => {
		const picture = new Image()
		picture.onload = () => settle(url)
		picture.onerror = () => settle(null)
		picture.src = url
	})

export const useReaderAvatar = () => {
	const [avatar, setAvatar] = useState<string>()

	useEffect(() => {
		let listening = true
		let isLiveDrawn = false

		loadedPicture(committedReaderAvatar).then((url) => {
			if (url && listening && !isLiveDrawn) setAvatar(url)
		})

		loadedPicture(AUTHOR_X_AVATAR_URL).then((url) => {
			if (url && listening) {
				isLiveDrawn = true
				setAvatar(url)
			}
		})

		return () => {
			listening = false
		}
	}, [])

	return avatar
}
