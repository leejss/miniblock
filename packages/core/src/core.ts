import type {
	Block,
	BlockType,
	EditorSelection,
	EditorState,
	FocusTarget,
	SelectionPoint,
} from "./types";

type Listener = (state: EditorState) => void;

export class MiniBlockCore {
	private state: EditorState;

	private listeners = new Set<Listener>();

	private past: EditorState[] = [];
	private future: EditorState[] = [];

	constructor(initialBlocks: Block[]) {
		this.state = {
			blocks: initialBlocks,
			selection: null,
		};
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
			selection: this.normalizeSelection(selection),
		};

		this.emit();
	}

	private normalizeSelection(
		selection: EditorSelection | null,
	): EditorSelection | null {
		if (!selection) return null;

		const anchor = this.normalizePoint(selection.anchor);
		const focus = this.normalizePoint(selection.focus);

		if (!anchor || !focus) return null;

		return {
			anchor,
			focus,
		};
	}

	private normalizePoint(point: SelectionPoint): SelectionPoint | null {
		const block = this.state.blocks.find((block) => block.id === point.blockId);
		if (!block) return null;
		return {
			blockId: point.blockId,
			offset: Math.max(0, Math.min(point.offset, block.content.length)),
		};
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

	private createBlock(content = "", type: BlockType = "p") {
		return {
			id: crypto.randomUUID(),
			type,
			content,
		};
	}

	deleteBlock(id: string) {
		if (!this.state.blocks.some((block) => block.id === id)) return;
		this.recordHistory();

		const nextBlocks = this.state.blocks.filter((block) => block.id !== id);
		this.state = {
			...this.state,
			blocks: nextBlocks,
		};
		this.emit();
	}

	splitBlock(id: string, offset: number): string | null {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index === -1) return null;

		this.recordHistory();

		const block = this.state.blocks[index];
		const before = block.content.slice(0, offset);
		const after = block.content.slice(offset);

		const currentBlock = {
			...block,
			content: before,
		};

		const newBlock = this.createBlock(after);

		const nextBlocks = [
			...this.state.blocks.slice(0, index),
			currentBlock,
			newBlock,
			...this.state.blocks.slice(index + 1),
		];

		this.state = {
			...this.state,
			blocks: nextBlocks,
		};

		this.emit();
		return newBlock.id;
	}

	mergeBlockBackward(id: string): FocusTarget | null {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index <= 0) return null;

		this.recordHistory();

		const currentBlock = this.state.blocks[index];
		const previousBlock = this.state.blocks[index - 1];
		const offset = previousBlock.content.length;

		const mergedBlock = {
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
		};

		this.emit();
		return {
			id: previousBlock.id,
			offset,
		};
	}

	deleteBlockBackward(id: string): FocusTarget | null {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index <= 0) return null;

		this.recordHistory();

		const previousBlock = this.state.blocks[index - 1];
		const nextBlocks = [
			...this.state.blocks.slice(0, index),
			...this.state.blocks.slice(index + 1),
		];
		this.state = {
			...this.state,
			blocks: nextBlocks,
		};

		this.emit();

		return {
			id: previousBlock.id,
			offset: previousBlock.content.length,
		};
	}

	changeBlockType(
		id: string,
		type: BlockType,
		newContent?: string,
	): FocusTarget | null {
		const index = this.state.blocks.findIndex((block) => block.id === id);
		if (index === -1) return null;

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
		};

		this.emit();

		return {
			id,
			offset: content.length,
		};
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
}
