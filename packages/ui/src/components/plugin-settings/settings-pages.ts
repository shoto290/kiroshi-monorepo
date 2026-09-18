import type { ReactNode } from "react"

import type { PushedPages } from "@workspace/ui/hooks/use-pushed-pages"

type SettingsPage = "skill" | "server" | "catalogue" | "history"

type SettingsPages = PushedPages<SettingsPage>

type SessionPages = Partial<Record<SettingsPage, ReactNode>>

export type { SessionPages, SettingsPage, SettingsPages }
