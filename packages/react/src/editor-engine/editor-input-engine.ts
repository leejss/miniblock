import { MAX_BULLET_INDENT, type MiniBlockCore } from "@miniblock/core";
import type { KeyDownInterceptor } from "../hooks/use-block-editor-context";
import { findClosestBlockElement } from "../utils/dom-block";
import {
	getCaretOffsetWithinBlock,
	getCollapsedOffsetInBlock,
	getSelectionRangeInBlock,
	type TextRange,
} from "../utils/dom-selection";
import {
	isBeforeInputSupported,
	isCompositionInput,
} from "../utils/input-events";
import { insertTextAt } from "../utils/input-text";
import { matchTextShortcut } from "../utils/shortcuts";

export interface KeyboardInputInfo {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	isComposing: boolean;
	target: EventTarget | null;
	preventDefault: () => void;
}

export interface BeforeInputInfo {
	inputType: string;
	data: string | null;
	target: EventTarget | null;
	preventDefault: () => void;
	isComposing: boolean;
}

export interface TargetInputInfo {
	target: EventTarget | null;
	isComposing: boolean;
}

export type InputIntent =
	| {
			type: "insertText";
			blockId: string;
			offset: number;
			text: string;
	  }
	| {
			type: "splitBlock";
			blockId: string;
			offset: number;
	  }
	| {
			type: "deleteBackward";
			blockId: string;
			range: TextRange;
	  }
	| {
			type: "deleteForward";
			blockId: string;
			range: TextRange;
	  };

export interface EditorInputEngineOptions {
	editor: MiniBlockCore;
	readOnly?: boolean;
	syncSelectionFromDom: () => void;
}

export class EditorInputEngine {
	private editor: MiniBlockCore;
	private readOnly = false;
	private syncSelectionFromDom: () => void;
	private interceptors = new Set<KeyDownInterceptor>();
	private isComposing = false;

	constructor(options: EditorInputEngineOptions) {
		this.editor = options.editor;
		this.readOnly = !!options.readOnly;
		this.syncSelectionFromDom = options.syncSelectionFromDom;
	}

	updateOptions(options: Partial<EditorInputEngineOptions>) {
		if (options.editor !== undefined) {
			this.editor = options.editor;
		}
		if (options.readOnly !== undefined) {
			this.readOnly = options.readOnly;
		}
		if (options.syncSelectionFromDom !== undefined) {
			this.syncSelectionFromDom = options.syncSelectionFromDom;
		}
	}

	getIsComposing() {
		return this.isComposing;
	}

	registerKeyDownInterceptor(interceptor: KeyDownInterceptor) {
		this.interceptors.add(interceptor);
		return () => {
			this.interceptors.delete(interceptor);
		};
	}

	handleBeforeInput(info: BeforeInputInfo) {
		if (this.readOnly) return;
		if (this.isComposing || info.isComposing) return;
		if (isCompositionInput(info.inputType)) return;

		const blockElement = findClosestBlockElement(info.target);
		const blockId = blockElement?.dataset.blockId;
		if (!blockElement || !blockId) return;

		const selection = window.getSelection();

		if (info.inputType === "historyUndo") {
			info.preventDefault();
			this.editor.undo();
			return;
		}

		if (info.inputType === "historyRedo") {
			info.preventDefault();
			this.editor.redo();
			return;
		}

		if (info.inputType === "insertText") {
			const offset = getCollapsedOffsetInBlock(blockElement, selection);
			const text = info.data;
			if (offset === null || !text) return;

			info.preventDefault();
			this.handleInputIntent({
				type: "insertText",
				blockId,
				offset,
				text,
			});
			return;
		}

		if (info.inputType === "insertParagraph") {
			const offset = getCollapsedOffsetInBlock(blockElement, selection);
			if (offset === null) return;

			info.preventDefault();
			this.handleInputIntent({
				type: "splitBlock",
				blockId,
				offset,
			});
			return;
		}

		if (info.inputType === "deleteContentBackward") {
			const range = getSelectionRangeInBlock(blockElement, selection);
			if (!range) return;

			info.preventDefault();
			this.handleInputIntent({
				type: "deleteBackward",
				blockId,
				range,
			});
			return;
		}

		if (info.inputType === "deleteContentForward") {
			const range = getSelectionRangeInBlock(blockElement, selection);
			if (!range) return;

			info.preventDefault();
			this.handleInputIntent({
				type: "deleteForward",
				blockId,
				range,
			});
		}
	}

	handleCompositionStart() {
		this.isComposing = true;
	}

	handleCompositionEnd(info: TargetInputInfo) {
		this.isComposing = false;
		if (this.readOnly) return;

		const blockElement = findClosestBlockElement(info.target);
		const blockId = blockElement?.dataset.blockId;
		if (!blockElement || !blockId) return;

		this.commitBlockContent(blockId, blockElement.textContent ?? "");
		this.syncSelectionFromDom();
	}

	handleInput(info: TargetInputInfo) {
		if (this.readOnly) return;
		if (this.isComposing || info.isComposing) return;

		const blockElement = findClosestBlockElement(info.target);
		const blockId = blockElement?.dataset.blockId;
		if (!blockElement || !blockId) return;

		this.commitBlockContent(blockId, blockElement.textContent ?? "");
		this.syncSelectionFromDom();
	}

	handleKeyDown(info: KeyboardInputInfo) {
		if (this.readOnly) return;
		if (this.isComposing || info.isComposing) return;

		const blockElement = findClosestBlockElement(info.target);
		const blockId = blockElement?.dataset.blockId;
		if (!blockElement || !blockId) return;

		const interceptors = Array.from(this.interceptors).reverse();
		for (const interceptor of interceptors) {
			if (interceptor(info, { blockId, blockElement })) {
				return;
			}
		}

		if (info.key === "Tab") {
			const blocks = this.editor.getBlocks();
			const block = blocks.find((b) => b.id === blockId);
			if (block && block.type === "bulletedListItem") {
				info.preventDefault();
				const currentIndent = block.indent ?? 0;
				if (info.shiftKey) {
					if (currentIndent > 0) {
						this.editor.updateBlock(blockId, { indent: currentIndent - 1 });
					}
				} else {
					if (currentIndent < MAX_BULLET_INDENT) {
						this.editor.updateBlock(blockId, { indent: currentIndent + 1 });
					}
				}
				this.syncSelectionFromDom();
				return;
			}
		}

		if (this.handleHistoryShortcut(info)) return;

		if (this.handleBlockMutationKeys(info, blockId, blockElement)) {
			return;
		}

		this.handleCaretNavigation(info, blockId, blockElement);
	}

	private commitBlockContent(blockId: string, content: string) {
		const shortcut = matchTextShortcut(content);
		if (shortcut) {
			this.editor.changeBlockType(blockId, shortcut.type, "");
			return;
		}

		this.editor.updateBlock(blockId, { content });
	}

	private handleInputIntent(command: InputIntent) {
		const blocks = this.editor.getBlocks();
		const block = blocks.find((b) => b.id === command.blockId);
		if (!block) return;

		if (command.type === "insertText") {
			const nextContent = insertTextAt(
				block.content,
				command.offset,
				command.text,
			);
			const shortcut = matchTextShortcut(nextContent);

			if (shortcut) {
				this.editor.changeBlockType(command.blockId, shortcut.type, "");
				return;
			}

			this.editor.dispatch(
				{
					type: "insertText",
					payload: {
						blockId: command.blockId,
						offset: command.offset,
						text: command.text,
					},
				},
				{ history: "merge" },
			);
			return;
		}

		if (command.type === "splitBlock") {
			this.editor.splitBlock(command.blockId, command.offset);
			return;
		}

		if (command.type === "deleteBackward") {
			const { start, end } = command.range;

			if (start !== end) {
				this.editor.dispatch(
					{
						type: "deleteText",
						payload: {
							blockId: command.blockId,
							start,
							end,
						},
					},
					{ history: "merge" },
				);
				return;
			}

			if (start > 0) {
				this.editor.dispatch(
					{
						type: "deleteText",
						payload: {
							blockId: command.blockId,
							start: start - 1,
							end: start,
						},
					},
					{ history: "merge" },
				);
				return;
			}

			if (block.type === "bulletedListItem") {
				const currentIndent = block.indent ?? 0;
				if (currentIndent > 0) {
					this.editor.updateBlock(command.blockId, {
						indent: currentIndent - 1,
					});
				} else {
					this.editor.changeBlockType(
						command.blockId,
						"paragraph",
						block.content,
					);
				}
				return;
			}

			if (block.content.length === 0) {
				this.editor.deleteBlockBackward(command.blockId);
			} else {
				this.editor.mergeBlockBackward(command.blockId);
			}

			return;
		}

		if (command.type === "deleteForward") {
			const { start, end } = command.range;

			if (start !== end) {
				this.editor.dispatch(
					{
						type: "deleteText",
						payload: {
							blockId: command.blockId,
							start,
							end,
						},
					},
					{ history: "merge" },
				);
				return;
			}

			if (start < block.content.length) {
				this.editor.dispatch(
					{
						type: "deleteText",
						payload: {
							blockId: command.blockId,
							start,
							end: start + 1,
						},
					},
					{ history: "merge" },
				);
				return;
			}

			const blockIndex = blocks.findIndex((b) => b.id === command.blockId);
			const nextBlock = blocks[blockIndex + 1];
			if (nextBlock) {
				this.editor.mergeBlockBackward(nextBlock.id);
			}
		}
	}

	private handleHistoryShortcut(info: KeyboardInputInfo): boolean {
		const key = info.key.toLowerCase();
		const isModifierKey = info.metaKey || info.ctrlKey;
		const isUndoKey = isModifierKey && key === "z" && !info.shiftKey;
		const isRedoKey =
			isModifierKey && ((key === "z" && info.shiftKey) || key === "y");

		if (isUndoKey) {
			info.preventDefault();
			this.editor.undo();
			return true;
		}

		if (isRedoKey) {
			info.preventDefault();
			this.editor.redo();
			return true;
		}

		return false;
	}

	private handleBlockMutationKeys(
		info: KeyboardInputInfo,
		blockId: string,
		blockElement: HTMLElement,
	): boolean {
		if (info.key === "Enter") {
			if (isBeforeInputSupported()) return false;
			info.preventDefault();

			const offset =
				getCollapsedOffsetInBlock(blockElement, window.getSelection()) ?? 0;

			this.editor.splitBlock(blockId, offset);
			return true;
		}

		if (info.key === "Backspace") {
			if (isBeforeInputSupported()) return false;
			const range = getSelectionRangeInBlock(
				blockElement,
				window.getSelection(),
			);
			const isAtStart = range?.start === 0 && range.end === 0;
			if (!isAtStart) return false;

			info.preventDefault();

			const blocks = this.editor.getBlocks();
			const block = blocks.find((b) => b.id === blockId);
			if (block && block.type === "bulletedListItem") {
				const currentIndent = block.indent ?? 0;
				if (currentIndent > 0) {
					this.editor.updateBlock(blockId, { indent: currentIndent - 1 });
				} else {
					this.editor.changeBlockType(blockId, "paragraph", block.content);
				}
				return true;
			}

			const isEmpty = (blockElement.textContent ?? "") === "";

			if (isEmpty) {
				this.editor.deleteBlockBackward(blockId);
			} else {
				this.editor.mergeBlockBackward(blockId);
			}

			return true;
		}

		return false;
	}

	private handleCaretNavigation(
		info: KeyboardInputInfo,
		blockId: string,
		blockElement: HTMLElement,
	): boolean {
		if (info.key !== "ArrowUp" && info.key !== "ArrowDown") return false;

		info.preventDefault();

		const blocks = this.editor.getBlocks();
		const index = blocks.findIndex((item) => item.id === blockId);
		if (index === -1) return true;

		const idxCandidate = info.key === "ArrowUp" ? index - 1 : index + 1;
		const nextIdx = Math.max(0, Math.min(idxCandidate, blocks.length - 1));
		const nextBlock = blocks[nextIdx];
		if (!nextBlock) return true;

		const offset = getCaretOffsetWithinBlock(blockElement);
		this.editor.setSelection({
			anchor: { blockId: nextBlock.id, offset },
			focus: { blockId: nextBlock.id, offset },
		});

		return true;
	}
}
