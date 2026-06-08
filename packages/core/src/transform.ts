import { createBlock } from "./blocks";
import { createCollapsedSelection } from "./selection";
import type { Block, EditorState } from "./types";

export function splitBlockState(
	state: EditorState,
	input: {
		blockId: string;
		offset: number;
		createId: () => string;
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

	const newBlock = createBlock(input.createId, after);

	const blocks = [
		...state.blocks.slice(0, index),
		currentBlock,
		newBlock,
		...state.blocks.slice(index + 1),
	];

	return {
		...state,
		blocks,
		selection: createCollapsedSelection(newBlock.id, 0),
	};
}
