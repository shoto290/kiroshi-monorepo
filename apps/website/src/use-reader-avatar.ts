import { useEffect, useState } from "react"

import { AUTHOR_X_AVATAR_URL } from "./copy"

import committedReaderAvatar from "./assets/reader-avatar.jpg"

const drawableAvatar = () =>
	new Promise<string>((settle) => {
		const picture = new Image()
		picture.onload = () => settle(AUTHOR_X_AVATAR_URL)
		picture.onerror = () => settle(committedReaderAvatar)
		picture.src = AUTHOR_X_AVATAR_URL
	})

export const useReaderAvatar = () => {
	const [avatar, setAvatar] = useState(committedReaderAvatar)

	useEffect(() => {
		let listening = true
		drawableAvatar().then((url) => {
			if (listening) setAvatar(url)
		})
		return () => {
			listening = false
		}
	}, [])

	return avatar
}
