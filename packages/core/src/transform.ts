import { createBlock } from "./blocks";
import { createCollapsedSelection } from "./selection";
import type { Block, BlockType, EditorState } from "./types";

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

export function mergeBlockBackwardState(
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

export function deleteBlockBackwardState(
	state: EditorState,
	input: {
		blockId: string;
	},
): EditorState {
	const index = state.blocks.findIndex((block) => block.id === input.blockId);

	if (index <= 0) return state;

	const previousBlock = state.blocks[index - 1];
	const offset = previousBlock.content.length;
	const nextBlocks = [
		...state.blocks.slice(0, index),
		...state.blocks.slice(index + 1),
	];
	return {
		...state,
		blocks: nextBlocks,
		selection: createCollapsedSelection(previousBlock.id, offset),
	};
}

export function changeBlockTypeState(
	state: EditorState,
	input: {
		blockId: string;
		type: BlockType;
		newContent?: string;
	},
): EditorState {
	const block = state.blocks.find((block) => block.id === input.blockId);
	if (!block) return state;

	const content = input.newContent ?? block.content;
	const blocks = state.blocks.map((block) =>
		block.id === input.blockId
			? {
					...block,
					type: input.type,
					content,
				}
			: block,
	);

	return {
		...state,
		blocks,
		selection: createCollapsedSelection(input.blockId, content.length),
	};
}
