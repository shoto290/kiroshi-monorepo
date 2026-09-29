const TYPING_FIELDS = "input, textarea, select, [contenteditable='true']"

export const isTypingTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || target.closest(TYPING_FIELDS) !== null)
