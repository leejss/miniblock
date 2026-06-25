export function matchSlashTrigger(content: string, offset: number) {
	const textBeforeCaret = content.slice(0, offset);
	const match = textBeforeCaret.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);
	if (!match) return null;
	return {
		query: match[1],
	};
}
