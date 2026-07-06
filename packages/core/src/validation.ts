import {
	type Block,
	type BlockType,
	EDITOR_STATE_SCHEMA_VERSION,
	type EditorSelection,
	type EditorState,
	type SelectionPoint,
} from "./types";

const BLOCK_TYPES = new Set<BlockType>([
	"paragraph",
	"heading1",
	"heading2",
	"heading3",
	"quote",
	"codeBlock",
	"bulletedListItem",
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

function isBlock(value: unknown): value is Block {
	if (!isRecord(value)) return false;

	const id = value.id;
	if (typeof id !== "string" || id.trim() === "") return false;

	const type = value.type;
	if (!isBlockType(type)) return false;

	const content = value.content;
	if (typeof content !== "string") return false;

	const indent = value.indent;
	if (indent !== undefined && typeof indent !== "number") return false;

	return true;
}

export function isEditorState(value: unknown): value is EditorState {
	if (!isRecord(value)) return false;

	if (value.schemaVersion !== EDITOR_STATE_SCHEMA_VERSION) return false;

	const blocks = value.blocks;
	if (!Array.isArray(blocks)) return false;
	if (blocks.length === 0) return false;

	for (const block of blocks) {
		if (!isBlock(block)) return false;
	}

	return true;
}
