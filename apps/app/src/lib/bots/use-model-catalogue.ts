import { useEffect, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { readModelCatalogue } from "./model-catalogue"

import type { OfferedModel_Serialize } from "@/lib/bindings"

export type ModelCatalogue = {
	models: OfferedModel_Serialize[]
	hasFailedToLoad: boolean
}

const UNREAD_CATALOGUE: ModelCatalogue = { models: [], hasFailedToLoad: false }

export const useModelCatalogue = (): ModelCatalogue => {
	const [catalogue, setCatalogue] = useState(UNREAD_CATALOGUE)

	useEffect(() => {
		let listening = true
		readModelCatalogue().then(
			(models) => {
				if (listening) setCatalogue({ models, hasFailedToLoad: false })
			},
			() => {
				if (!listening) return
				setCatalogue({ models: [], hasFailedToLoad: true })
				raiseFailureNotice({ title: i18n.t("bots:runtime.model.unreadable") })
			},
		)
		return () => {
			listening = false
		}
	}, [])

	return catalogue
}
