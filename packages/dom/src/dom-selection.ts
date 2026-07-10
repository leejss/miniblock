import type { EditorSelection, TextRange } from "@miniblock/core";

export function readEditorSelection(
	blockElements: ReadonlyMap<string, HTMLElement>,
	selection: Selection | null,
): EditorSelection | null {
	if (!selection || selection.rangeCount === 0) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;

	const anchorBlock = findRegisteredBlock(blockElements, selection.anchorNode);
	const focusBlock = findRegisteredBlock(blockElements, selection.focusNode);
	if (!anchorBlock || !focusBlock) return null;

	const anchorOffset = measureTextOffset(
		anchorBlock.element,
		selection.anchorNode,
		selection.anchorOffset,
	);
	const focusOffset = measureTextOffset(
		focusBlock.element,
		selection.focusNode,
		selection.focusOffset,
	);
	if (anchorOffset === null || focusOffset === null) return null;

	return {
		anchor: { blockId: anchorBlock.blockId, offset: anchorOffset },
		focus: { blockId: focusBlock.blockId, offset: focusOffset },
	};
}

export function applyEditorSelection(
	blockElements: ReadonlyMap<string, HTMLElement>,
	selection: EditorSelection | null,
): boolean {
	if (!selection) return false;

	const anchorElement = blockElements.get(selection.anchor.blockId);
	const focusElement = blockElements.get(selection.focus.blockId);
	if (!anchorElement || !focusElement) return false;

	const anchorTextNode = ensureTextNode(anchorElement);
	const focusTextNode = ensureTextNode(focusElement);
	if (!anchorTextNode || !focusTextNode) return false;

	const anchorOffset = Math.min(
		selection.anchor.offset,
		anchorTextNode.textContent?.length ?? 0,
	);
	const focusOffset = Math.min(
		selection.focus.offset,
		focusTextNode.textContent?.length ?? 0,
	);
	const domSelection = anchorElement.ownerDocument.getSelection();
	if (!domSelection) return false;

	domSelection.removeAllRanges();
	domSelection.setBaseAndExtent(
		anchorTextNode,
		anchorOffset,
		focusTextNode,
		focusOffset,
	);
	return true;
}

export function readTextRangeWithinBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
): TextRange | null {
	if (!selection || selection.rangeCount === 0) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;
	if (!containsNode(blockElement, selection.anchorNode)) return null;
	if (!containsNode(blockElement, selection.focusNode)) return null;

	const anchorOffset = measureTextOffset(
		blockElement,
		selection.anchorNode,
		selection.anchorOffset,
	);
	const focusOffset = measureTextOffset(
		blockElement,
		selection.focusNode,
		selection.focusOffset,
	);
	if (anchorOffset === null || focusOffset === null) return null;

	return {
		start: Math.min(anchorOffset, focusOffset),
		end: Math.max(anchorOffset, focusOffset),
	};
}

export function readCollapsedCaretOffsetWithinBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
): number | null {
	const range = readTextRangeWithinBlock(blockElement, selection);
	if (!range || range.start !== range.end) return null;
	return range.start;
}

export function readCaretOffsetWithinBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
): number {
	if (!selection || selection.rangeCount === 0) return 0;

	const range = selection.getRangeAt(0);
	return (
		measureTextOffset(blockElement, range.startContainer, range.startOffset) ??
		0
	);
}

function findRegisteredBlock(
	blockElements: ReadonlyMap<string, HTMLElement>,
	node: Node,
): { blockId: string; element: HTMLElement } | null {
	const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
	const blockElement = element?.closest<HTMLElement>("[data-block-id]");
	const blockId = blockElement?.dataset.blockId;
	if (!blockId || !blockElement) return null;
	if (blockElements.get(blockId) !== blockElement) return null;

	return { blockId, element: blockElement };
}

function ensureTextNode(element: HTMLElement): Text | null {
	let textNode = element.firstChild;
	if (!textNode) {
		textNode = element.ownerDocument.createTextNode("");
		element.appendChild(textNode);
	}

	return textNode.nodeType === 3 ? (textNode as Text) : null;
}

function containsNode(element: HTMLElement, node: Node) {
	return node === element || element.contains(node);
}

function measureTextOffset(
	blockElement: HTMLElement,
	node: Node,
	offset: number,
) {
	const range = blockElement.ownerDocument.createRange();
	range.selectNodeContents(blockElement);

	try {
		range.setEnd(node, offset);
		const contentLength = blockElement.textContent?.length ?? 0;
		return Math.max(0, Math.min(range.toString().length, contentLength));
	} catch {
		return null;
	}
}
