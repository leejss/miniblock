import type { Block } from "./editor";

type Listener = (blocks: Block[]) => void;

export class MiniBlockCore {
	private blocks: Block[] = [];
	private listeners = new Set<Listener>();

	constructor(initialBlocks: Block[]) {
		this.blocks = initialBlocks;
	}

	getBlocks() {
		return this.blocks;
	}

	subscribe(listener: Listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	updateBlock(id: string, patch: Partial<Block>) {
		this.blocks = this.blocks.map((block) => {
			return block.id === id ? { ...block, ...patch } : block;
		});

		this.emit();
	}

	private emit() {
		for (const listener of this.listeners) {
			listener(this.blocks);
		}
	}

	private createBlock(content = "", type = "p") {
		return {
			id: crypto.randomUUID(),
			type,
			content,
		};
	}

	// 특정 블록 뒤에 새 블록을 넣는다.
	insertBlockAfter(id: string, block?: Block) {
		const index = this.blocks.findIndex((block) => block.id === id);
		if (index === -1) return;

		const nextBlock = block ?? this.createBlock();
		this.blocks = [
			...this.blocks.slice(0, index + 1),
			nextBlock,
			...this.blocks.slice(index + 1),
		];
		this.emit();
	}

	deleteBlock(id: string) {
		this.blocks = this.blocks.filter((block) => block.id !== id);
		this.emit();
	}

	splitBlock(id: string, offset: number): string | null {
		const index = this.blocks.findIndex((block) => block.id === id);
		if (index === -1) return null;

		const block = this.blocks[index];
		const before = block.content.slice(0, offset);
		const after = block.content.slice(offset);

		const currentBlock = {
			...block,
			content: before,
		};

		const newBlock = this.createBlock(after);

		this.blocks = [
			...this.blocks.slice(0, index),
			currentBlock,
			newBlock,
			...this.blocks.slice(index + 1),
		];

		this.emit();
		return newBlock.id;
	}

	mergeBlockBackward(id: string) {
		const index = this.blocks.findIndex((block) => block.id === id);
		if (index === -1) return null;

		const currentBlock = this.blocks[index];
		const previousBlock = this.blocks[index - 1];
		const offset = previousBlock.content.length;

		const mergedBlock = {
			...previousBlock,
			content: previousBlock.content + currentBlock.content,
		};

		this.blocks = [
			...this.blocks.slice(0, index - 1),
			mergedBlock,
			...this.blocks.slice(index + 1),
		];
		this.emit();
		return {
			id: previousBlock.id,
			offset,
		};
	}
}
