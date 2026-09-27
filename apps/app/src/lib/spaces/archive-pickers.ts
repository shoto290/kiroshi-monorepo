import { open, save } from "@tauri-apps/plugin-dialog"

import { ARCHIVE_EXTENSION, ARCHIVE_FILTER_NAME } from "@/lib/bindings"

export type ArchivePickers = {
	pickExportPath: (defaultName: string) => Promise<string | null>
	pickImportPath: () => Promise<string | null>
}

const ARCHIVE_FILTERS = [
	{ name: ARCHIVE_FILTER_NAME, extensions: [ARCHIVE_EXTENSION] },
]

const PATH_SEPARATORS = /[/\\:]/g

export const archiveFileNameOf = (spaceName: string) =>
	`${spaceName.replace(PATH_SEPARATORS, "-")}.${ARCHIVE_EXTENSION}`

export const nativeArchivePickers: ArchivePickers = {
	pickExportPath: (defaultName) =>
		save({ defaultPath: defaultName, filters: ARCHIVE_FILTERS }),
	pickImportPath: () =>
		open({ multiple: false, directory: false, filters: ARCHIVE_FILTERS }),
}
