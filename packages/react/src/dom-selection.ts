import type { EditorSelection } from "@miniblock/core";

export type TextRange = {
	start: number;
	end: number;
};

export function readSelectionFromDom(
	blocksMap: Map<string, HTMLElement>,
): EditorSelection | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;

	const anchorBlock = findBlockElement(blocksMap, selection.anchorNode);
	const focusBlock = findBlockElement(blocksMap, selection.focusNode);
	if (!anchorBlock || !focusBlock) return null;

	const anchorOffset = getDomPointOffsetInBlock(
		anchorBlock.element,
		selection.anchorNode,
		selection.anchorOffset,
	);
	const focusOffset = getDomPointOffsetInBlock(
		focusBlock.element,
		selection.focusNode,
		selection.focusOffset,
	);
	if (anchorOffset === null || focusOffset === null) return null;

	return {
		anchor: {
			blockId: anchorBlock.blockId,
			offset: anchorOffset,
		},
		focus: {
			blockId: focusBlock.blockId,
			offset: focusOffset,
		},
	};
}

export function applySelectionToDom(
	blocksMap: Map<string, HTMLElement>,
	editorSelection: EditorSelection | null,
) {
	if (!editorSelection) return;

	const anchorBlockElement = blocksMap.get(editorSelection.anchor.blockId);
	const focusBlockElement = blocksMap.get(editorSelection.focus.blockId);

	if (!anchorBlockElement || !focusBlockElement) return;

	const anchorTextNode = ensureTextNode(anchorBlockElement);
	const focusTextNode = ensureTextNode(focusBlockElement);
	if (!anchorTextNode || !focusTextNode) return;

	const anchorOffset = Math.min(
		editorSelection.anchor.offset,
		anchorTextNode.textContent?.length ?? 0,
	);
	const focusOffset = Math.min(
		editorSelection.focus.offset,
		focusTextNode.textContent?.length ?? 0,
	);

	const domSelection = document.getSelection();
	domSelection?.removeAllRanges();
	domSelection?.setBaseAndExtent(
		anchorTextNode,
		anchorOffset,
		focusTextNode,
		focusOffset,
	);
}

export function getCollapsedOffsetInBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
) {
	const range = getSelectionRangeInBlock(blockElement, selection);
	if (!range || range.start !== range.end) return null;
	return range.start;
}

export function getSelectionRangeInBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
): TextRange | null {
	if (!selection || selection.rangeCount === 0) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;
	if (!isNodeInsideElement(blockElement, selection.anchorNode)) return null;
	if (!isNodeInsideElement(blockElement, selection.focusNode)) return null;

	const anchorOffset = getDomPointOffsetInBlock(
		blockElement,
		selection.anchorNode,
		selection.anchorOffset,
	);

	const focusOffset = getDomPointOffsetInBlock(
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

export function getCaretOffsetWithinBlock(blockElement: HTMLElement): number {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return 0;

	const offset = getDomPointOffsetInBlock(
		blockElement,
		selection.getRangeAt(0).startContainer,
		selection.getRangeAt(0).startOffset,
	);
	return offset ?? 0;
}

function findBlockElement(
	blocksMap: Map<string, HTMLElement>,
	node: Node,
): { blockId: string; element: HTMLElement } | null {
	const element = node instanceof Element ? node : node.parentElement;
	const blockElement = element?.closest<HTMLElement>("[data-block-id]");
	const blockId = blockElement?.dataset.blockId;

	if (!blockId || !blockElement || !blocksMap.has(blockId)) return null;

	return {
		blockId,
		element: blockElement,
	};
}

function ensureTextNode(element: HTMLElement): Text | null {
	let textNode = element.firstChild;

	if (!textNode) {
		textNode = document.createTextNode("");
		element.appendChild(textNode);
	}

	return textNode instanceof Text ? textNode : null;
}

function isNodeInsideElement(element: HTMLElement, node: Node) {
	if (node === element) return true;
	return element.contains(node);
}

function getDomPointOffsetInBlock(
	blockElement: HTMLElement,
	node: Node,
	offset: number,
) {
	const range = document.createRange();
	range.selectNodeContents(blockElement);

	try {
		range.setEnd(node, offset);
		const contentLength = blockElement.textContent?.length ?? 0;
		return Math.max(0, Math.min(range.toString().length, contentLength));
	} catch {
		return null;
	}
}
