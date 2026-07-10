import {
	applyEditorInputIntent,
	areEditorSelectionsEqual,
	type MiniBlockCore,
} from "@miniblock/core";
import {
	createBeforeInputIntent,
	handleKeyboardInput,
	type ResolvedBlock,
	supportsBeforeInput,
} from "./dom-input";
import { applyEditorSelection, readEditorSelection } from "./dom-selection";

export type BlockLayout = {
	top: number;
	left: number;
	height: number;
};

export type KeyDownInterceptorContext = {
	blockId: string;
};

export type KeyDownInterceptor = (
	event: KeyboardEvent,
	context: KeyDownInterceptorContext,
) => boolean;

export type EditorDomAdapterOptions = {
	readOnly?: boolean;
};

export class EditorDomAdapter {
	private readonly blockElements = new Map<string, HTMLElement>();
	private readonly keyDownInterceptors = new Set<KeyDownInterceptor>();
	private root: HTMLElement | null = null;
	private isComposing = false;
	private readOnly: boolean;

	constructor(
		private readonly editor: MiniBlockCore,
		options: EditorDomAdapterOptions = {},
	) {
		this.readOnly = !!options.readOnly;
	}

	connect(root: HTMLElement) {
		if (this.root === root) return;
		if (this.root) {
			this.disconnect();
		}
		this.root = root;

		root.addEventListener("beforeinput", this.handleBeforeInput);
		root.addEventListener("input", this.handleInput);
		root.addEventListener("keydown", this.handleKeyDown);
		root.addEventListener("compositionstart", this.handleCompositionStart);
		root.addEventListener("compositionend", this.handleCompositionEnd);
		root.ownerDocument.addEventListener(
			"selectionchange",
			this.handleSelectionChange,
		);
	}

	disconnect() {
		const root = this.root;
		if (root) {
			root.removeEventListener("beforeinput", this.handleBeforeInput);
			root.removeEventListener("input", this.handleInput);
			root.removeEventListener("keydown", this.handleKeyDown);
			root.removeEventListener("compositionstart", this.handleCompositionStart);
			root.removeEventListener("compositionend", this.handleCompositionEnd);
			root.ownerDocument.removeEventListener(
				"selectionchange",
				this.handleSelectionChange,
			);
		}

		this.root = null;
		this.isComposing = false;
		this.blockElements.clear();
	}

	setReadOnly(readOnly: boolean) {
		this.readOnly = readOnly;
	}

	setBlockElement(blockId: string, element: HTMLElement | null) {
		if (element) {
			this.blockElements.set(blockId, element);
		} else {
			this.blockElements.delete(blockId);
		}
	}

	syncBlockContent(blockId: string, content: string) {
		if (this.isComposing) return;

		const element = this.blockElements.get(blockId);
		if (element && element.textContent !== content) {
			element.textContent = content;
		}
	}

	syncSelectionToDom() {
		if (this.isComposing) return;
		applyEditorSelection(this.blockElements, this.editor.getSelection());
	}

	getBlockLayout(blockId: string): BlockLayout | null {
		const element = this.blockElements.get(blockId);
		if (!element) return null;

		return {
			top: element.offsetTop,
			left: element.offsetLeft,
			height: element.offsetHeight,
		};
	}

	registerKeyDownInterceptor(interceptor: KeyDownInterceptor) {
		this.keyDownInterceptors.add(interceptor);
		return () => {
			this.keyDownInterceptors.delete(interceptor);
		};
	}

	private handleBeforeInput = (event: InputEvent) => {
		if (this.shouldIgnoreInput(event.isComposing)) return;

		const intent = createBeforeInputIntent(
			event,
			this.resolveBlock(event.target),
			this.getSelection(),
		);
		if (!intent) return;

		event.preventDefault();
		applyEditorInputIntent(this.editor, intent);
	};

	private handleInput = (event: Event) => {
		const inputEvent = event as InputEvent;
		if (this.shouldIgnoreInput(inputEvent.isComposing)) return;

		const block = this.resolveBlock(event.target);
		if (!block) return;

		applyEditorInputIntent(this.editor, {
			type: "setBlockContent",
			blockId: block.blockId,
			content: block.element.textContent ?? "",
		});
		this.syncSelectionFromDom();
	};

	private handleKeyDown = (event: KeyboardEvent) => {
		if (this.shouldIgnoreInput(event.isComposing)) return;

		const block = this.resolveBlock(event.target);
		if (!block || this.runKeyDownInterceptors(event, block.blockId)) return;

		handleKeyboardInput({
			editor: this.editor,
			event,
			block,
			selection: this.getSelection(),
			supportsBeforeInput: this.root ? supportsBeforeInput(this.root) : false,
			syncSelectionFromDom: () => this.syncSelectionFromDom(),
		});
	};

	private handleCompositionStart = () => {
		if (!this.readOnly) {
			this.isComposing = true;
		}
	};

	private handleCompositionEnd = (event: CompositionEvent) => {
		this.isComposing = false;
		if (this.readOnly) return;

		const block = this.resolveBlock(event.target);
		if (!block) return;

		applyEditorInputIntent(this.editor, {
			type: "setBlockContent",
			blockId: block.blockId,
			content: block.element.textContent ?? "",
		});
		this.syncSelectionFromDom();
	};

	private handleSelectionChange = () => {
		if (this.readOnly || this.isComposing) return;

		const root = this.root;
		const selection = this.getSelection();
		if (!root || !selection?.anchorNode) return;
		if (!root.contains(selection.anchorNode)) return;

		this.syncSelectionFromDom();
	};

	private shouldIgnoreInput(eventIsComposing: boolean) {
		return this.readOnly || this.isComposing || eventIsComposing;
	}

	private getSelection() {
		return this.root?.ownerDocument.getSelection() ?? null;
	}

	private syncSelectionFromDom() {
		const selection = readEditorSelection(
			this.blockElements,
			this.getSelection(),
		);
		if (!areEditorSelectionsEqual(selection, this.editor.getSelection())) {
			this.editor.setSelection(selection);
		}
	}

	private resolveBlock(target: EventTarget | null): ResolvedBlock | null {
		const root = this.root;
		if (!root || !isNode(target) || !root.contains(target)) return null;

		const element =
			target.nodeType === 1 ? (target as Element) : target.parentElement;
		const blockElement = element?.closest<HTMLElement>("[data-block-id]");
		const blockId = blockElement?.dataset.blockId;
		if (!blockId || !blockElement) return null;
		if (this.blockElements.get(blockId) !== blockElement) return null;

		return { blockId, element: blockElement };
	}

	private runKeyDownInterceptors(event: KeyboardEvent, blockId: string) {
		const interceptors = Array.from(this.keyDownInterceptors).reverse();
		return interceptors.some((interceptor) => interceptor(event, { blockId }));
	}
}

function isNode(target: EventTarget | null): target is Node {
	return !!target && "nodeType" in target;
}
