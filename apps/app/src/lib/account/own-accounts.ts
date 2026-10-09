type OwnAccounts = {
	list: () => string[]
	remember: (accountId: string) => void
}

const OWN_ACCOUNTS_KEY = "ownAccountIds"

const isAccountIds = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((id) => typeof id === "string")

const parsedAccountIds = (stored: string | null): string[] => {
	if (!stored) {
		return []
	}
	try {
		const value: unknown = JSON.parse(stored)
		return isAccountIds(value) ? value : []
	} catch {
		return []
	}
}

const readAccountIds = () =>
	parsedAccountIds(localStorage.getItem(OWN_ACCOUNTS_KEY))

export const storedOwnAccounts: OwnAccounts = {
	list: readAccountIds,
	remember: (accountId) => {
		const known = readAccountIds()
		if (known.includes(accountId)) {
			return
		}
		localStorage.setItem(
			OWN_ACCOUNTS_KEY,
			JSON.stringify([...known, accountId]),
		)
	},
}
