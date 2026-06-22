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

export function insertTextState(
	state: EditorState,
	input: { blockId: string; offset: number; text: string },
): EditorState {
	const block = state.blocks.find((block) => block.id === input.blockId);
	if (!block) return state;

	// block.content의 길이를 벗어나지 않도록 offset 조정
	const offset = Math.max(0, Math.min(input.offset, block.content.length));
	const newContent =
		block.content.slice(0, offset) + input.text + block.content.slice(offset);

	const newBlocks = state.blocks.map((b) =>
		b.id === input.blockId ? { ...b, content: newContent } : b,
	);

	return {
		...state,
		blocks: newBlocks,
		selection: createCollapsedSelection(
			input.blockId,
			offset + input.text.length,
		),
	};
}
export function deleteTextState(
	state: EditorState,
	input: { blockId: string; start: number; end: number },
): EditorState {
	const block = state.blocks.find((block) => block.id === input.blockId);
	if (!block) return state;

	const start = Math.max(0, Math.min(input.start, block.content.length));
	const end = Math.max(start, Math.min(input.end, block.content.length));

	if (start === end) return state;

	const newContent = block.content.slice(0, start) + block.content.slice(end);

	const newBlocks = state.blocks.map((b) =>
		b.id === input.blockId ? { ...b, content: newContent } : b,
	);

	return {
		...state,
		blocks: newBlocks,
		selection: createCollapsedSelection(input.blockId, start),
	};
}
