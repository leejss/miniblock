// GOAL: Split block, Merge block, Focus block with handling keydown event

type Block = {
	id: string;
	content: string;
	type: string;
};

export class BlockEditor {
	private state: Block[];
	private root: HTMLElement;
	constructor(rootId: string) {
		this.root = document.getElementById(rootId) as HTMLElement;
		this.state = [
			{
				id: this.generateId(),
				content: "Hello World",
				type: "h1",
			},
		];

		this.init();
	}

	init() {
		this.render();
	}

	private generateId(): string {
		return crypto.randomUUID();
	}

	private render() {
		this.root.innerHTML = "";
		// iterate over the state and render the blocks
		this.state.forEach((block) => {
			// Rendering
			const el = document.createElement(block.type) as HTMLElement;
			el.contentEditable = "true";
			el.className = `block block-${block.type}`;
			el.dataset.id = block.id;
			el.innerText = block.content;

			el.addEventListener("input", (e) => this.handleInput(e, block.id));
			el.addEventListener("keydown", (e) => this.handleKeydown(e, block.id));
			this.root.appendChild(el);
		});

		this.updateDebugger();
	}

	// Events
	private handleInput(e: InputEvent, blockId: string) {
		// Update target state
		const text = (e.target as HTMLElement).innerText;
		const block = this.state.find((b) => b.id === blockId);
		if (block) {
			block.content = text;
		}
		this.updateDebugger();
	}

	private updateDebugger() {
		console.log(this.state);
		const debugEl = document.getElementById("state-debugger");
		if (debugEl) {
			debugEl.innerHTML = `<pre class="debug-json"><code>${JSON.stringify(this.state, null, 2)}</code></pre>`;
		}
	}

	// Enter -> split existing block into two blocks or create new block if cursor is at the end of the block
	// Backspace -> merge current block with previous block if cursor is at the beginning of the block
	private handleKeydown(e: KeyboardEvent, blockId: string) {
		// e.key에 따른 행동 정의하기
		if (e.isComposing) return;

		if (e.key === "Enter") {
			e.preventDefault();
			this.splitBlock(blockId);
		} else if (e.key === "Backspace") {
			const selection = window.getSelection();
			const isCursorAtBeginning =
				selection?.isCollapsed && selection.anchorOffset === 0;
			if (isCursorAtBeginning) {
				e.preventDefault();
				this.mergeBlock(blockId);
			}
		} else if (e.key === "ArrowUp") {
			// 현재 커서의 위치를 얻기
			const selection = window.getSelection();
			const currentOffset = selection?.anchorOffset || 0;
			const blockIndex = this.state.findIndex((block) => block.id === blockId);
			if (blockIndex > 0) {
				e.preventDefault();
				const prevBlock = this.state[blockIndex - 1];
				this.focusBlock(prevBlock.id, currentOffset);
			}
		} else if (e.key === "ArrowDown") {
			// 현재 커서의 위치를 얻기
			const selection = window.getSelection();
			const currentOffset = selection?.anchorOffset || 0;
			const blockIndex = this.state.findIndex((block) => block.id === blockId);
			if (blockIndex < this.state.length - 1) {
				e.preventDefault();
				const nextBlock = this.state[blockIndex + 1];
				this.focusBlock(nextBlock.id, currentOffset);
			}
		}
	}

	private splitBlock(blockId: string) {
		const blockIndex = this.state.findIndex((b) => b.id === blockId);
		if (blockIndex === -1) return;

		const currentBlock = this.state[blockIndex];

		// 커서 포지션 얻기.
		const selection = window.getSelection();
		const cursorPosition = selection?.anchorOffset || 0;

		const textBeforeCursor = currentBlock.content.slice(0, cursorPosition);
		const textAfterCursor = currentBlock.content.slice(cursorPosition);

		currentBlock.content = textBeforeCursor;

		const newBlock: Block = {
			id: this.generateId(),
			content: textAfterCursor,
			type: "p",
		};

		// 새로운 Block을 현재 Block 앞에 넣기.
		this.state.splice(blockIndex + 1, 0, newBlock);

		// Rerendering
		this.render();

		setTimeout(() => {
			this.focusBlock(newBlock.id, 0);
		});
	}

	private mergeBlock(blockId: string) {
		const blockIndex = this.state.findIndex((b) => b.id === blockId);
		if (blockIndex <= 0) return;

		const currentBlock = this.state[blockIndex];
		const prevBlock = this.state[blockIndex - 1];
		const prevLength = prevBlock.content.length;

		prevBlock.content += currentBlock.content;
		this.state.splice(blockIndex, 1);
		this.render();

		// Focus to the previous block and set cursor position to the end of the previous block's original content
		setTimeout(() => {
			// Focus block
			this.focusBlock(prevBlock.id, prevLength);
		});
	}

	private focusBlock(blockId: string, offset: number) {
		const el = this.root.querySelector(
			`[data-id="${blockId}"]`,
		) as HTMLDivElement;
		if (!el) return;
		el.focus();

		const selection = window.getSelection();
		if (!selection) return;

		const range = document.createRange();

		let targetNode: Node = el;
		let targetOffset = offset;

		// Find child TextNode
		if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
			targetNode = el.firstChild;
			const textLength = el.firstChild.textContent?.length || 0;
			targetOffset = Math.min(offset, textLength);
		} else {
			targetOffset = 0;
		}

		try {
			range.setStart(targetNode, targetOffset);
			range.collapse(true);

			selection.removeAllRanges();
			selection.addRange(range);
		} catch (err) {
			console.warn("Failed to set caret position", err);
		}
	}
}
// up -> 현재 focus block 찾기. 현재 focus block index -1 에 위치한 block에 focusBlock
