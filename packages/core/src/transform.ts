import { createBlock } from "./blocks";
import { createCollapsedSelection } from "./selection";
import type { Block, EditorState } from "./types";

// State transition

export function splitBlockState(
	state: EditorState,
	input: {
		blockId: string;
		offset: number;
		newBlockId: string;
	},
): EditorState {
	const index = state.blocks.findIndex((item) => item.id === input.blockId);
	if (index === -1) return state;

	const block = state.blocks[index];
	const offset = Math.max(0, Math.min(input.offset, block.content.length));

	const before = block.content.slice(0, offset);
	const after = block.content.slice(offset);

	const currentBlock: Block = {
		...block,
		content: before,
	};

	const newBlock = createBlock({
		id: input.newBlockId,
		content: after,
	});

	const blocks = [
		...state.blocks.slice(0, index),
		currentBlock,
		newBlock,
		...state.blocks.slice(index + 1),
	];

	return {
		...state,
		blocks,
		selection: createCollapsedSelection(newBlock.id),
	};
}

export function mergetBlockBackwardState(
	state: EditorState,
	input: { blockId: string },
): EditorState {
	const index = state.blocks.findIndex((block) => block.id === input.blockId);
	if (index <= 0) return state;

	const currentBlock = state.blocks[index];
	const previousBlock = state.blocks[index - 1];
	const offset = previousBlock.content.length;

	const mergedBlock: Block = {
		...previousBlock,
		content: previousBlock.content + currentBlock.content,
	};

	const nextBlocks = [
		...state.blocks.slice(0, index - 1),
		mergedBlock,
		...state.blocks.slice(index + 1),
	];

	return {
		...state,
		blocks: nextBlocks,
		selection: createCollapsedSelection(previousBlock.id, offset),
	};
}
