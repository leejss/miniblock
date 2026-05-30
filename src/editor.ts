// GOAL: Split block, Merge block, Focus block with handling keydown event

type Block = {
	id: string;
	content: string;
	type: string;
};

export class BlockEditor {
	private state: Block[];
	private root: HTMLElement;

	private isMenuOpen: boolean = false;
	private activeBlockId: string | null = null;
	private activeMenuIndex = 0;
	private slashMenuEl: HTMLElement | null = null;

	constructor(rootId: string) {
		this.root = document.getElementById(rootId) as HTMLElement;
		this.slashMenuEl = document.getElementById("slash-menu");
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

	private handleInput(e: InputEvent, blockId: string) {
		const text = (e.target as HTMLElement).innerText;
		const block = this.state.find((b) => b.id === blockId);
		if (block) {
			block.content = text;
		}
		this.updateDebugger();

		// 슬래시 텍스트를 감지한다.
		const isSlashComamnd = text === "/" || text.endsWith(" /");
		if (isSlashComamnd) {
			this.showSlashMenu(e.target as HTMLElement, blockId);
		} else {
			this.hideSlashMenu();
		}
	}

	private updateDebugger() {
		console.log(this.state);
		const debugEl = document.getElementById("state-debugger");
		if (debugEl) {
			debugEl.innerHTML = `<pre class="debug-json"><code>${JSON.stringify(this.state, null, 2)}</code></pre>`;
		}
	}

	private handleKeydown(e: KeyboardEvent, blockId: string) {
		// e.key에 따른 행동 정의하기
		if (e.isComposing) return;

		if (this.isMenuOpen) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				this.navigateMenu(1);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				this.navigateMenu(-1);
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.hideSlashMenu();
			} else if (e.key === "Enter") {
				e.preventDefault();
				this.selectMenuItem();
			}
			return;
		}

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

	private showSlashMenu(blockEl: HTMLElement, blockId: string) {
		if (!this.slashMenuEl) return;

		this.isMenuOpen = true;
		this.activeBlockId = blockId;
		this.activeMenuIndex = 0;

		const rect = blockEl.getBoundingClientRect();
		// ? slash menu 를 띄울 위치를 어떻게 계산할까?. 절대좌표와 상대좌표

		const top = rect.bottom + window.scrollY;
		const left = rect.left + window.scrollX;

		this.slashMenuEl.style.display = "block";
		this.slashMenuEl.style.top = `${top}px`;
		this.slashMenuEl.style.left = `${left}px`;

		this.updateMenuHighlight();
	}
	private hideSlashMenu() {
		if (!this.slashMenuEl) return;

		this.isMenuOpen = false;
		this.activeBlockId = null;
		this.slashMenuEl.style.display = "none";
	}

	private updateMenuHighlight() {
		if (!this.slashMenuEl) return;

		// Menu items
		const items = document.querySelectorAll(".slash-menu-item");
		items.forEach((item, index) => {
			if (index === this.activeMenuIndex) {
				item.classList.add("active");
				item.scrollIntoView({ block: "nearest" });
			} else {
				item.classList.remove("active");
			}
		});
	}

	private navigateMenu(direction: number) {
		if (!this.slashMenuEl) return;

		const items = this.slashMenuEl.querySelectorAll(".slash-menu-item");
		const count = items.length;
		if (count === 0) return;

		// 모듈러 연산
		this.activeMenuIndex = (this.activeMenuIndex + direction + count) % count;
		this.updateMenuHighlight();
	}

	private selectMenuItem() {
		if (!this.slashMenuEl || !this.activeBlockId) return;
		const items = this.slashMenuEl.querySelectorAll(".slash-menu-item");
		const activeItem = items[this.activeMenuIndex] as HTMLElement;
		if (!activeItem) return;
		const selectedType = activeItem.dataset.type as string;
		this.changeBlockType(this.activeBlockId, selectedType);
	}

	private changeBlockType(blockId: string, type: string) {
		const blockIndex = this.state.findIndex((b) => b.id === blockId);
		if (blockIndex === -1) return;

		const currentBlock = this.state[blockIndex];
		// cleaning: slash 제거하기

		let cleanContent = currentBlock.content;
		if (cleanContent.endsWith(" /")) {
			cleanContent = cleanContent.slice(0, -2);
		} else if (cleanContent === "/") {
			cleanContent = "";
		}

		if (cleanContent === "") {
			// 현재 블록의 타입을 바꾼다.
			currentBlock.content = "";
			currentBlock.type = type;
			this.hideSlashMenu();
			this.render();

			setTimeout(() => {
				this.focusBlock(currentBlock.id, 0);
			}, 0);
		} else {
			currentBlock.content = cleanContent;
			const newBlock = {
				id: this.generateId(),
				content: "",
				type,
			};

			this.state.splice(blockIndex + 1, 0, newBlock);
			this.hideSlashMenu();
			this.render();
			setTimeout(() => {
				this.focusBlock(newBlock.id, 0);
			}, 0);
		}
	}
}
