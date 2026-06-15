import type { BlockType, EditorSelection, SelectionPoint } from "./types";

const BLOCK_TYPES = new Set<BlockType>([
	"p",
	"h1",
	"h2",
	"h3",
	"blockquote",
	"pre",
]);

export function isBlockType(value: unknown): value is BlockType {
	return typeof value === "string" && BLOCK_TYPES.has(value as BlockType);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
export function isSelectionPoint(value: unknown): value is SelectionPoint {
	return (
		isRecord(value) &&
		typeof value.blockId === "string" &&
		typeof value.offset === "number"
	);
}

export function isEditorSelection(value: unknown): value is EditorSelection {
	return (
		isRecord(value) &&
		isSelectionPoint(value.anchor) &&
		isSelectionPoint(value.focus)
	);
}
