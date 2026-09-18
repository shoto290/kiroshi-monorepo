import type { CatalogueCategory } from "@workspace/ui/components/plugin-settings/applications-catalogue"

import type { Application } from "./application-port"

const OTHER_CATEGORY: CatalogueCategory = "other"

const CATEGORY_OF_BUCKET: Record<string, CatalogueCategory> = {
	"Commerce & shopping": "commerce-shopping",
	Communication: "communication",
	"Consumer health": "consumer-health",
	Creative: "creative",
	"Data & analytics": "data-analytics",
	"Developer tools": "developer-tools",
	Education: "education",
	"Financial services": "financial-services",
	"Health & life sciences": "health-life-sciences",
	Legal: "legal",
	"Media & entertainment": "media-entertainment",
	Nonprofit: "nonprofit",
	Productivity: "productivity",
	"Sales & marketing": "sales-marketing",
	Travel: "travel",
	Other: "other",
}

export const categoriesOf = ({
	categories,
}: Application): CatalogueCategory[] => {
	const railed = new Set(
		(categories ?? []).map(
			(bucket) => CATEGORY_OF_BUCKET[bucket] ?? OTHER_CATEGORY,
		),
	)
	return railed.size > 0 ? [...railed] : [OTHER_CATEGORY]
}
