export function insertTextAt(content: string, offset: number, text: string) {
	const safeOffset = Math.max(0, Math.min(offset, content.length));
	return content.slice(0, safeOffset) + text + content.slice(safeOffset);
}
