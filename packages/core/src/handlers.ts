import { normalizeBlock } from "./blocks";
import type { CommandHandler, CommandResult } from "./commands";
import { createCollapsedSelection, normalizeSelection } from "./selection";
import type { EditorSelection, EditorState } from "./types";

function unchanged(
	state: EditorState,
	selection: EditorSelection | null,
): CommandResult {
	return {
		state,
		selection,
		inverse: null,
	};
}

export const replaceTextHandler: CommandHandler<"replaceText"> = (
	state,
	selection,
	payload,
) => {
	const block = state.blocks.find((block) => block.id === payload.blockId);
	if (!block) return unchanged(state, selection);

	const start = Math.max(
		0,
		Math.min(payload.range.start, block.content.length),
	);
	const end = Math.max(
		start,
		Math.min(payload.range.end, block.content.length),
	);
	if (start === end && payload.text.length === 0) {
		return unchanged(state, selection);
	}

	const removedText = block.content.slice(start, end);
	const content =
		block.content.slice(0, start) + payload.text + block.content.slice(end);
	if (content === block.content) return unchanged(state, selection);

	const blocks = state.blocks.map((item) =>
		item.id === payload.blockId ? { ...item, content } : item,
	);

	return {
		state: {
			...state,
			blocks,
		},
		selection: createCollapsedSelection(
			payload.blockId,
			start + payload.text.length,
		),
		inverse: {
			type: "replaceText",
			payload: {
				blockId: payload.blockId,
				range: {
					start,
					end: start + payload.text.length,
				},
				text: removedText,
			},
		},
	};
};

export const patchBlockHandler: CommandHandler<"patchBlock"> = (
	state,
	selection,
	payload,
) => {
	const index = state.blocks.findIndex((block) => block.id === payload.blockId);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const nextBlock = normalizeBlock({
		id: previousBlock.id,
		type: payload.patch.type ?? previousBlock.type,
		content: payload.patch.content ?? previousBlock.content,
		indent: Object.hasOwn(payload.patch, "indent")
			? payload.patch.indent
			: previousBlock.indent,
	});

	if (isBlockEqual(previousBlock, nextBlock)) {
		return unchanged(state, selection);
	}

	const blocks = state.blocks.map((block) =>
		block.id === payload.blockId ? nextBlock : block,
	);

	return {
		state: {
			...state,
			blocks,
		},
		selection: normalizeSelection(blocks, selection),
		inverse: {
			type: "patchBlock",
			payload: {
				blockId: payload.blockId,
				patch: {
					type: previousBlock.type,
					content: previousBlock.content,
					indent: previousBlock.indent,
				},
			},
		},
	};
};

export const spliceBlocksHandler: CommandHandler<"spliceBlocks"> = (
	state,
	selection,
	payload,
) => {
	const index = Math.max(0, Math.min(payload.index, state.blocks.length));
	const deleteCount = Math.max(
		0,
		Math.min(payload.deleteCount, state.blocks.length - index),
	);
	if (deleteCount === 0 && payload.insert.length === 0) {
		return unchanged(state, selection);
	}

	const removedBlocks = state.blocks.slice(index, index + deleteCount);
	const blocks = [
		...state.blocks.slice(0, index),
		...payload.insert,
		...state.blocks.slice(index + deleteCount),
	];

	if (blocks.length === 0) return unchanged(state, selection);

	return {
		state: {
			...state,
			blocks,
		},
		selection: normalizeSelection(blocks, selection),
		inverse: {
			type: "spliceBlocks",
			payload: {
				index,
				deleteCount: payload.insert.length,
				insert: removedBlocks,
			},
		},
	};
};

function isBlockEqual(
	left: EditorState["blocks"][number],
	right: EditorState["blocks"][number],
) {
	return (
		left.id === right.id &&
		left.type === right.type &&
		left.content === right.content &&
		left.indent === right.indent
	);
}
