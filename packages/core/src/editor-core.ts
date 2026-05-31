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
}
