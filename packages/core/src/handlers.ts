import { normalizeBlock } from "./blocks";
import type { CommandHandler, CommandResult } from "./commands";
import { createCollapsedSelection, normalizeSelection } from "./selection";
import {
	changeBlockTypeState,
	deleteBlockBackwardState,
	deleteTextState,
	insertTextState,
	mergeBlockBackwardState,
	splitBlockState,
} from "./transform";
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

export const updateBlockHandler: CommandHandler<"updateBlock"> = (
	state,
	selection,
	payload,
) => {
	const index = state.blocks.findIndex((block) => block.id === payload.id);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const blocks = state.blocks.map((block) =>
		block.id === payload.id
			? normalizeBlock({ ...block, ...payload.patch })
			: block,
	);
	const nextState = { ...state, blocks };

	return {
		state: nextState,
		selection: normalizeSelection(blocks, selection),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start: index,
				deleteCount: 1,
				blocks: [previousBlock],
				selection,
			},
		},
	};
};

export const splitBlockHandler: CommandHandler<"splitBlock"> = (
	state,
	selection,
	payload,
) => {
	const index = state.blocks.findIndex((block) => block.id === payload.blockId);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const block = state.blocks[index];

	// If splitting an empty bullet list item, convert it to a paragraph and reset indentation instead
	if (block.type === "bulletedListItem" && block.content === "") {
		const updatedBlock = normalizeBlock({
			...block,
			type: "paragraph",
			indent: undefined,
		});
		const blocks = state.blocks.map((b) =>
			b.id === payload.blockId ? updatedBlock : b,
		);
		return {
			state: {
				...state,
				blocks,
			},
			selection: createCollapsedSelection(payload.blockId, 0),
			inverse: {
				type: "replaceBlocks",
				payload: {
					start: index,
					deleteCount: 1,
					blocks: [previousBlock],
					selection,
				},
			},
		};
	}

	const offset = Math.max(0, Math.min(payload.offset, block.content.length));
	const nextState = splitBlockState(state, {
		blockId: payload.blockId,
		offset,
		newBlockId: payload.newBlockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(payload.newBlockId),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start: index,
				deleteCount: 2,
				blocks: [previousBlock],
				selection,
			},
		},
	};
};

export const mergeBlockBackwardHandler: CommandHandler<"mergeBlockBackward"> = (
	state,
	selection,
	payload,
) => {
	const index = state.blocks.findIndex((block) => block.id === payload.blockId);
	if (index <= 0) return unchanged(state, selection);

	const previousBlock = state.blocks[index - 1];
	const currentBlock = state.blocks[index];
	const offset = previousBlock.content.length;
	const nextState = mergeBlockBackwardState(state, {
		blockId: payload.blockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(previousBlock.id, offset),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start: index - 1,
				deleteCount: 1,
				blocks: [previousBlock, currentBlock],
				selection,
			},
		},
	};
};

export const deleteBlockBackwardHandler: CommandHandler<
	"deleteBlockBackward"
> = (state, selection, payload) => {
	const index = state.blocks.findIndex((block) => block.id === payload.blockId);
	if (index <= 0) return unchanged(state, selection);

	const previousBlock = state.blocks[index - 1];
	const deletedBlock = state.blocks[index];
	const offset = previousBlock.content.length;
	const nextState = deleteBlockBackwardState(state, {
		blockId: payload.blockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(previousBlock.id, offset),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start: index,
				deleteCount: 0,
				blocks: [deletedBlock],
				selection,
			},
		},
	};
};

export const changeBlockTypeHandler: CommandHandler<"changeBlockType"> = (
	state,
	selection,
	payload,
) => {
	const index = state.blocks.findIndex((block) => block.id === payload.blockId);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const content = payload.newContent ?? previousBlock.content;
	const nextState = changeBlockTypeState(state, {
		blockId: payload.blockId,
		type: payload.blockType,
		newContent: payload.newContent,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(payload.blockId, content.length),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start: index,
				deleteCount: 1,
				blocks: [previousBlock],
				selection,
			},
		},
	};
};

export const insertTextHandler: CommandHandler<"insertText"> = (
	state,
	selection,
	payload,
) => {
	if (payload.text.length === 0) return unchanged(state, selection);

	const block = state.blocks.find((block) => block.id === payload.blockId);
	if (!block) return unchanged(state, selection);

	const offset = Math.max(0, Math.min(payload.offset, block.content.length));
	const nextState = insertTextState(state, {
		blockId: payload.blockId,
		offset,
		text: payload.text,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(
			payload.blockId,
			offset + payload.text.length,
		),
		inverse: {
			type: "deleteText",
			payload: {
				blockId: payload.blockId,
				start: offset,
				end: offset + payload.text.length,
			},
		},
	};
};

export const deleteTextHandler: CommandHandler<"deleteText"> = (
	state,
	selection,
	payload,
) => {
	const block = state.blocks.find((block) => block.id === payload.blockId);
	if (!block) return unchanged(state, selection);

	const start = Math.max(0, Math.min(payload.start, block.content.length));
	const end = Math.max(start, Math.min(payload.end, block.content.length));
	if (start === end) return unchanged(state, selection);

	const deletedText = block.content.slice(start, end);
	const nextState = deleteTextState(state, {
		blockId: payload.blockId,
		start,
		end,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(payload.blockId, start),
		inverse: {
			type: "insertText",
			payload: {
				blockId: payload.blockId,
				offset: start,
				text: deletedText,
			},
		},
	};
};

export const replaceBlocksHandler: CommandHandler<"replaceBlocks"> = (
	state,
	selection,
	payload,
) => {
	const start = Math.max(0, Math.min(payload.start, state.blocks.length));
	const deleteCount = Math.max(
		0,
		Math.min(payload.deleteCount, state.blocks.length - start),
	);
	const removedBlocks = state.blocks.slice(start, start + deleteCount);
	const blocks = [
		...state.blocks.slice(0, start),
		...payload.blocks,
		...state.blocks.slice(start + deleteCount),
	];

	if (blocks.length === 0) return unchanged(state, selection);

	return {
		state: {
			...state,
			blocks,
		},
		selection: normalizeSelection(blocks, payload.selection),
		inverse: {
			type: "replaceBlocks",
			payload: {
				start,
				deleteCount: payload.blocks.length,
				blocks: removedBlocks,
				selection,
			},
		},
	};
};
