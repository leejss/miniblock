export function getCaretOffsetWithinBlock(blockEl: HTMLElement): number {
	const selection = window.getSelection();

	if (!selection || selection.rangeCount === 0) return 0;

	const range = selection.getRangeAt(0);

	if (!blockEl.contains(range.startContainer)) return 0;
	const preCaretRange = range.cloneRange();
	preCaretRange.selectNodeContents(blockEl);
	// range의 startContainer와 startOffset을 preCaretRange의 끝으로 설정하여, 블록 내에서 커서가 위치한 오프셋을 계산합니다.
	preCaretRange.setEnd(range.startContainer, range.startOffset);
	return preCaretRange.toString().length;
}

export function matchSlashTrigger(content: string, offset: number) {
	const textBeforeCaret = content.slice(0, offset);
	const match = textBeforeCaret.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);
	if (!match) return null;
	return {
		query: match[1],
	};
}
