import { type CreateId, createBlock } from "./blocks";
import { normalizeSelection } from "./selection";
import { splitBlockState } from "./transform";
import type { Block, BlockType, EditorSelection, EditorState } from "./types";

type Listener = (state: EditorState) => void;

export type MiniBlockCoreOptions = {
	createId?: () => string;
};

export class MiniBlockCore {
	private state: EditorState;
	private listeners = new Set<Listener>();
	private past: EditorState[] = [];
	private future: EditorState[] = [];

	private createId: CreateId;

	constructor(initialBlocks: Block[], options: MiniBlockCoreOptions = {}) {
		this.state = {
			blocks: initialBlocks,
			selection: null,
		};

		this.createId = options.createId ? options.createId : crypto.randomUUID;
	}

	getState() {
		return this.state;
	}

	getBlocks() {
		return this.state.blocks;
	}

	subscribe(listener: Listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	setSelection(selection: EditorSelection | null) {
		this.state = {
			...this.state,
			selection: normalizeSelection(this.state.blocks, selection),
		};

		this.emit();
	}

	updateBlock(id: string, patch: Partial<Block>) {
		if (!this.state.blocks.some((block) => block.id === id)) return;

		const nextBlocks = this.state.blocks.map((block) => {
			return block.id === id ? { ...block, ...patch } : block;
		});

		this.state = {
			...this.state,
			blocks: nextBlocks,
		};

		this.emit();
	}

	private emit() {
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	splitBlock(id: string, offset: number) {
		const nextState = splitBlockState(this.state, {
			blockId: id,
			offset,
			createId: this.createId,
		});

		if (this.state === nextState) return;

		this.recordHistory();
		this.state = nextState;
		this.emit();
	}

	mergeBlockBackward(id: string) {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index <= 0) return;

		this.recordHistory();

		const currentBlock = this.state.blocks[index];
		const previousBlock = this.state.blocks[index - 1];
		const offset = previousBlock.content.length;

		const mergedBlock: Block = {
			...previousBlock,
			content: previousBlock.content + currentBlock.content,
		};

		const nextBlocks = [
			...this.state.blocks.slice(0, index - 1),
			mergedBlock,
			...this.state.blocks.slice(index + 1),
		];

		this.state = {
			...this.state,
			blocks: nextBlocks,
			selection: this.createCollapsedSelection(previousBlock.id, offset),
		};

		this.emit();
	}

	deleteBlockBackward(id: string): void {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index <= 0) return;

		this.recordHistory();

		const previousBlock = this.state.blocks[index - 1];
		const offset = previousBlock.content.length;
		const nextBlocks = [
			...this.state.blocks.slice(0, index),
			...this.state.blocks.slice(index + 1),
		];
		this.state = {
			...this.state,
			blocks: nextBlocks,
			selection: this.createCollapsedSelection(previousBlock.id, offset),
		};

		this.emit();
	}

	changeBlockType(id: string, type: BlockType, newContent?: string): void {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index === -1) return;

		this.recordHistory();

		const block = this.state.blocks[index];
		const content = newContent ?? block.content;
		const nextBlocks = this.state.blocks.map((block) =>
			block.id === id
				? {
						...block,
						type,
						content,
					}
				: block,
		);

		this.state = {
			...this.state,
			blocks: nextBlocks,
			selection: this.createCollapsedSelection(id, content.length),
		};

		this.emit();
	}

	undo() {
		const previous = this.past.pop();
		if (!previous) return;
		this.future.push(this.state);
		this.state = previous;
		this.emit();
	}
	redo() {
		const next = this.future.pop();
		if (!next) return;

		this.past.push(this.state);
		this.state = next;
		this.emit();
	}

	private recordHistory() {
		this.past.push(this.state);
		this.future = [];
	}

	private createCollapsedSelection(
		blockId: string,
		offset: number,
	): EditorSelection {
		return {
			anchor: { blockId, offset },
			focus: { blockId, offset },
		};
	}
}
