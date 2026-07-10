import {
	applyEditorInputIntent,
	type EditorInputIntent,
	MAX_BULLET_INDENT,
	type MiniBlockCore,
} from "@miniblock/core";
import {
	readCaretOffsetWithinBlock,
	readCollapsedCaretOffsetWithinBlock,
	readTextRangeWithinBlock,
} from "./dom-selection";

export type ResolvedBlock = {
	blockId: string;
	element: HTMLElement;
};

type KeyboardInputOptions = {
	editor: MiniBlockCore;
	event: KeyboardEvent;
	block: ResolvedBlock;
	selection: Selection | null;
	supportsBeforeInput: boolean;
	syncSelectionFromDom: () => void;
};

const SUPPORTED_INPUT_TYPES = new Set([
	"insertText",
	"insertParagraph",
	"deleteContentBackward",
	"deleteContentForward",
	"historyUndo",
	"historyRedo",
]);

export function createBeforeInputIntent(
	event: InputEvent,
	block: ResolvedBlock | null,
	selection: Selection | null,
): EditorInputIntent | null {
	if (!SUPPORTED_INPUT_TYPES.has(event.inputType)) return null;
	if (isCompositionInput(event.inputType)) return null;

	if (event.inputType === "historyUndo") return { type: "historyUndo" };
	if (event.inputType === "historyRedo") return { type: "historyRedo" };
	if (!block) return null;

	if (event.inputType === "insertText") {
		const offset = readCollapsedCaretOffsetWithinBlock(
			block.element,
			selection,
		);
		if (offset === null || !event.data) return null;
		if (isLineBreak(event.data)) {
			return { type: "splitBlock", blockId: block.blockId, offset };
		}
		return {
			type: "insertText",
			blockId: block.blockId,
			offset,
			text: event.data,
		};
	}

	if (event.inputType === "insertParagraph") {
		const offset = readCollapsedCaretOffsetWithinBlock(
			block.element,
			selection,
		);
		if (offset === null) return null;
		return { type: "splitBlock", blockId: block.blockId, offset };
	}

	const range = readTextRangeWithinBlock(block.element, selection);
	if (!range) return null;

	if (event.inputType === "deleteContentBackward") {
		return { type: "deleteBackward", blockId: block.blockId, range };
	}

	if (event.inputType === "deleteContentForward") {
		return { type: "deleteForward", blockId: block.blockId, range };
	}

	return null;
}

export function handleKeyboardInput({
	editor,
	event,
	block,
	selection,
	supportsBeforeInput,
	syncSelectionFromDom,
}: KeyboardInputOptions): boolean {
	if (handleListIndentation(editor, event, block.blockId)) {
		syncSelectionFromDom();
		return true;
	}

	if (handleHistoryShortcut(editor, event)) return true;
	if (
		handleMutationFallback(editor, event, block, selection, supportsBeforeInput)
	) {
		return true;
	}

	return handleVerticalNavigation(editor, event, block, selection);
}

export function supportsBeforeInput(root: HTMLElement) {
	const InputEventConstructor = root.ownerDocument.defaultView?.InputEvent;
	return (
		!!InputEventConstructor &&
		typeof InputEventConstructor.prototype.getTargetRanges === "function"
	);
}

function isCompositionInput(inputType: string) {
	return (
		inputType === "insertCompositionText" ||
		inputType === "deleteCompositionText"
	);
}

function isLineBreak(text: string) {
	return text === "\n" || text === "\r" || text === "\r\n";
}

function handleListIndentation(
	editor: MiniBlockCore,
	event: KeyboardEvent,
	blockId: string,
) {
	if (event.key !== "Tab") return false;

	const block = editor.getBlocks().find((item) => item.id === blockId);
	if (block?.type !== "bulletedListItem") return false;

	event.preventDefault();
	const currentIndent = block.indent ?? 0;
	const nextIndent = event.shiftKey
		? Math.max(0, currentIndent - 1)
		: Math.min(MAX_BULLET_INDENT, currentIndent + 1);

	if (nextIndent !== currentIndent) {
		editor.updateBlock(blockId, { indent: nextIndent });
	}
	return true;
}

function handleHistoryShortcut(editor: MiniBlockCore, event: KeyboardEvent) {
	const key = event.key.toLowerCase();
	const hasModifier = event.metaKey || event.ctrlKey;
	const isUndo = hasModifier && key === "z" && !event.shiftKey;
	const isRedo =
		hasModifier && ((key === "z" && event.shiftKey) || key === "y");
	if (!isUndo && !isRedo) return false;

	event.preventDefault();
	applyEditorInputIntent(editor, {
		type: isUndo ? "historyUndo" : "historyRedo",
	});
	return true;
}

function handleMutationFallback(
	editor: MiniBlockCore,
	event: KeyboardEvent,
	block: ResolvedBlock,
	selection: Selection | null,
	hasBeforeInput: boolean,
) {
	if (hasBeforeInput) return false;

	if (event.key === "Enter") {
		event.preventDefault();
		const offset =
			readCollapsedCaretOffsetWithinBlock(block.element, selection) ?? 0;
		applyEditorInputIntent(editor, {
			type: "splitBlock",
			blockId: block.blockId,
			offset,
		});
		return true;
	}

	if (event.key !== "Backspace") return false;

	const range = readTextRangeWithinBlock(block.element, selection);
	if (range?.start !== 0 || range.end !== 0) return false;

	event.preventDefault();
	applyEditorInputIntent(editor, {
		type: "deleteBackward",
		blockId: block.blockId,
		range,
	});
	return true;
}

function handleVerticalNavigation(
	editor: MiniBlockCore,
	event: KeyboardEvent,
	block: ResolvedBlock,
	selection: Selection | null,
) {
	if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;

	event.preventDefault();
	const blocks = editor.getBlocks();
	const blockIndex = blocks.findIndex((item) => item.id === block.blockId);
	if (blockIndex === -1) return true;

	const nextIndex = Math.max(
		0,
		Math.min(
			event.key === "ArrowUp" ? blockIndex - 1 : blockIndex + 1,
			blocks.length - 1,
		),
	);
	const nextBlock = blocks[nextIndex];
	if (!nextBlock) return true;

	const offset = readCaretOffsetWithinBlock(block.element, selection);
	editor.setSelection({
		anchor: { blockId: nextBlock.id, offset },
		focus: { blockId: nextBlock.id, offset },
	});
	return true;
}
