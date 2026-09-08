import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { I18nProvider } from "@workspace/ui/components/i18n-provider"

import { WebsitePage } from "./website-page"

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<I18nProvider>
			<WebsitePage />
		</I18nProvider>
	</StrictMode>,
)
