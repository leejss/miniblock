import { createBlock, normalizeBlock } from "./blocks";
import { createBlockId } from "./id";
import {
	type Block,
	EDITOR_STATE_SCHEMA_VERSION,
	type EditorState,
} from "./types";
import { isBlockType, isRecord } from "./validation";

export function createEmptyState(): EditorState {
	return {
		schemaVersion: EDITOR_STATE_SCHEMA_VERSION,
		blocks: [createBlock({ id: createBlockId() })],
	};
}

export function normalizeState(value: unknown): EditorState {
	if (!isRecord(value)) return createEmptyState();
	const blocks = normalizeBlocks(value.blocks);

	if (blocks.length === 0) return createEmptyState();
	return {
		schemaVersion: EDITOR_STATE_SCHEMA_VERSION,
		blocks,
	};
}

function normalizeBlocks(value: unknown): Block[] {
	if (!Array.isArray(value)) return [];
	const seenIds = new Set<string>();
	return value.filter(isRecord).map((block) => {
		let id =
			typeof block.id === "string" && block.id.trim() !== ""
				? block.id
				: createBlockId();

		while (seenIds.has(id)) {
			id = createBlockId();
		}

		seenIds.add(id);

		return normalizeBlock({
			id,
			type: isBlockType(block.type) ? block.type : "paragraph",
			content: typeof block.content === "string" ? block.content : "",
			indent: block.indent,
		});
	});
}

export function toJSON(value: EditorState): EditorState {
	return normalizeState(value);
}
export function fromJSON(value: unknown): EditorState {
	return normalizeState(value);
}

export function toPlainText(value: EditorState): string {
	return normalizeState(value)
		.blocks.map((block) => block.content)
		.join("\n");
}
