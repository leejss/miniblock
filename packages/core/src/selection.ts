import type { Block, EditorSelection, SelectionPoint } from "./types";

function normalizePoint(
	blocks: Block[],
	point: SelectionPoint,
): SelectionPoint | null {
	const block = blocks.find((block) => block.id === point.blockId);

	if (!block) {
		return null;
	}

	const offset = Math.max(0, Math.min(point.offset, block.content.length));
	return {
		blockId: block.id,
		offset,
	};
}

export function normalizeSelection(
	blocks: Block[],
	selection: EditorSelection | null,
): EditorSelection | null {
	if (!selection) return null;
	const anchor = normalizePoint(blocks, selection.anchor);
	const focus = normalizePoint(blocks, selection.focus);
	if (!anchor || !focus) return null;
	return {
		anchor,
		focus,
	};
}

export function createCollapsedSelection(
	blockId: string,
	offset: number = 0,
): EditorSelection {
	return {
		anchor: { blockId, offset },
		focus: { blockId, offset },
	};
}

export function areEditorSelectionsEqual(
	left: EditorSelection | null,
	right: EditorSelection | null,
): boolean {
	if (left === right) return true;
	if (!left || !right) return false;

	return (
		left.anchor.blockId === right.anchor.blockId &&
		left.anchor.offset === right.anchor.offset &&
		left.focus.blockId === right.focus.blockId &&
		left.focus.offset === right.focus.offset
	);
}
