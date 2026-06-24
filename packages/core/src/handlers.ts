import type { CommandHandler, CommandResult, EditorCommand } from "./commands";
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

export const updateBlockHandler: CommandHandler<
	Extract<EditorCommand, { type: "updateBlock" }>
> = (state, selection, command) => {
	const index = state.blocks.findIndex((block) => block.id === command.id);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const blocks = state.blocks.map((block) =>
		block.id === command.id ? { ...block, ...command.patch } : block,
	);
	const nextState = { ...state, blocks };

	return {
		state: nextState,
		selection: normalizeSelection(blocks, selection),
		inverse: {
			type: "replaceBlocks",
			start: index,
			deleteCount: 1,
			blocks: [previousBlock],
			selection,
		},
	};
};

export const splitBlockHandler: CommandHandler<
	Extract<EditorCommand, { type: "splitBlock" }>
> = (state, selection, command) => {
	const index = state.blocks.findIndex((block) => block.id === command.blockId);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const block = state.blocks[index];
	const offset = Math.max(0, Math.min(command.offset, block.content.length));
	const nextState = splitBlockState(state, {
		blockId: command.blockId,
		offset,
		newBlockId: command.newBlockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(command.newBlockId),
		inverse: {
			type: "replaceBlocks",
			start: index,
			deleteCount: 2,
			blocks: [previousBlock],
			selection,
		},
	};
};

export const mergeBlockBackwardHandler: CommandHandler<
	Extract<EditorCommand, { type: "mergeBlockBackward" }>
> = (state, selection, command) => {
	const index = state.blocks.findIndex((block) => block.id === command.blockId);
	if (index <= 0) return unchanged(state, selection);

	const previousBlock = state.blocks[index - 1];
	const currentBlock = state.blocks[index];
	const offset = previousBlock.content.length;
	const nextState = mergeBlockBackwardState(state, {
		blockId: command.blockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(previousBlock.id, offset),
		inverse: {
			type: "replaceBlocks",
			start: index - 1,
			deleteCount: 1,
			blocks: [previousBlock, currentBlock],
			selection,
		},
	};
};

export const deleteBlockBackwardHandler: CommandHandler<
	Extract<EditorCommand, { type: "deleteBlockBackward" }>
> = (state, selection, command) => {
	const index = state.blocks.findIndex((block) => block.id === command.blockId);
	if (index <= 0) return unchanged(state, selection);

	const previousBlock = state.blocks[index - 1];
	const deletedBlock = state.blocks[index];
	const offset = previousBlock.content.length;
	const nextState = deleteBlockBackwardState(state, {
		blockId: command.blockId,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(previousBlock.id, offset),
		inverse: {
			type: "replaceBlocks",
			start: index,
			deleteCount: 0,
			blocks: [deletedBlock],
			selection,
		},
	};
};

export const changeBlockTypeHandler: CommandHandler<
	Extract<EditorCommand, { type: "changeBlockType" }>
> = (state, selection, command) => {
	const index = state.blocks.findIndex((block) => block.id === command.blockId);
	if (index === -1) return unchanged(state, selection);

	const previousBlock = state.blocks[index];
	const content = command.newContent ?? previousBlock.content;
	const nextState = changeBlockTypeState(state, {
		blockId: command.blockId,
		type: command.blockType,
		newContent: command.newContent,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(command.blockId, content.length),
		inverse: {
			type: "replaceBlocks",
			start: index,
			deleteCount: 1,
			blocks: [previousBlock],
			selection,
		},
	};
};

export const insertTextHandler: CommandHandler<
	Extract<EditorCommand, { type: "insertText" }>
> = (state, selection, command) => {
	if (command.text.length === 0) return unchanged(state, selection);

	const block = state.blocks.find((block) => block.id === command.blockId);
	if (!block) return unchanged(state, selection);

	const offset = Math.max(0, Math.min(command.offset, block.content.length));
	const nextState = insertTextState(state, {
		blockId: command.blockId,
		offset,
		text: command.text,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(
			command.blockId,
			offset + command.text.length,
		),
		inverse: {
			type: "deleteText",
			blockId: command.blockId,
			start: offset,
			end: offset + command.text.length,
		},
	};
};

export const deleteTextHandler: CommandHandler<
	Extract<EditorCommand, { type: "deleteText" }>
> = (state, selection, command) => {
	const block = state.blocks.find((block) => block.id === command.blockId);
	if (!block) return unchanged(state, selection);

	const start = Math.max(0, Math.min(command.start, block.content.length));
	const end = Math.max(start, Math.min(command.end, block.content.length));
	if (start === end) return unchanged(state, selection);

	const deletedText = block.content.slice(start, end);
	const nextState = deleteTextState(state, {
		blockId: command.blockId,
		start,
		end,
	});

	if (nextState === state) return unchanged(state, selection);

	return {
		state: nextState,
		selection: createCollapsedSelection(command.blockId, start),
		inverse: {
			type: "insertText",
			blockId: command.blockId,
			offset: start,
			text: deletedText,
		},
	};
};

export const replaceBlocksHandler: CommandHandler<
	Extract<EditorCommand, { type: "replaceBlocks" }>
> = (state, selection, command) => {
	const start = Math.max(0, Math.min(command.start, state.blocks.length));
	const deleteCount = Math.max(
		0,
		Math.min(command.deleteCount, state.blocks.length - start),
	);
	const removedBlocks = state.blocks.slice(start, start + deleteCount);
	const blocks = [
		...state.blocks.slice(0, start),
		...command.blocks,
		...state.blocks.slice(start + deleteCount),
	];

	if (blocks.length === 0) return unchanged(state, selection);

	return {
		state: {
			...state,
			blocks,
		},
		selection: normalizeSelection(blocks, command.selection),
		inverse: {
			type: "replaceBlocks",
			start,
			deleteCount: command.blocks.length,
			blocks: removedBlocks,
			selection,
		},
	};
};
