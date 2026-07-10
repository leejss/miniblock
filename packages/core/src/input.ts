import type { TextRange } from "./commands";
import type { MiniBlockCore } from "./core";
import type { Block, BlockType } from "./types";

export type EditorInputIntent =
	| {
			type: "insertText";
			blockId: string;
			offset: number;
			text: string;
	  }
	| {
			type: "setBlockContent";
			blockId: string;
			content: string;
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
	  }
	| { type: "historyUndo" }
	| { type: "historyRedo" };

type TextShortcut = {
	trigger: string;
	type: BlockType;
};

const TEXT_SHORTCUTS = [
	{ trigger: "# ", type: "heading1" },
	{ trigger: "## ", type: "heading2" },
	{ trigger: "### ", type: "heading3" },
	{ trigger: "> ", type: "quote" },
	{ trigger: "``` ", type: "codeBlock" },
	{ trigger: "- ", type: "bulletedListItem" },
	{ trigger: "* ", type: "bulletedListItem" },
] as const satisfies readonly TextShortcut[];

export function applyEditorInputIntent(
	editor: MiniBlockCore,
	intent: EditorInputIntent,
): void {
	switch (intent.type) {
		case "insertText":
			applyInsertText(editor, intent);
			return;
		case "setBlockContent":
			applyBlockContent(editor, intent.blockId, intent.content);
			return;
		case "splitBlock":
			editor.splitBlock(intent.blockId, intent.offset);
			return;
		case "deleteBackward":
			applyDeleteBackward(editor, intent.blockId, intent.range);
			return;
		case "deleteForward":
			applyDeleteForward(editor, intent.blockId, intent.range);
			return;
		case "historyUndo":
			editor.undo();
			return;
		case "historyRedo":
			editor.redo();
			return;
		default:
			assertNever(intent);
	}
}

function applyInsertText(
	editor: MiniBlockCore,
	intent: Extract<EditorInputIntent, { type: "insertText" }>,
) {
	const block = findBlock(editor, intent.blockId);
	if (!block) return;

	const nextContent = insertTextAt(block.content, intent.offset, intent.text);
	if (applyTextShortcut(editor, intent.blockId, nextContent)) return;

	editor.replaceText(
		intent.blockId,
		{ start: intent.offset, end: intent.offset },
		intent.text,
		{ history: "merge" },
	);
}

function applyBlockContent(
	editor: MiniBlockCore,
	blockId: string,
	content: string,
) {
	if (!findBlock(editor, blockId)) return;
	if (applyTextShortcut(editor, blockId, content)) return;

	editor.updateBlock(blockId, { content });
}

function applyDeleteBackward(
	editor: MiniBlockCore,
	blockId: string,
	range: TextRange,
) {
	const block = findBlock(editor, blockId);
	if (!block) return;

	if (range.start !== range.end) {
		editor.replaceText(blockId, range, "", { history: "merge" });
		return;
	}

	if (range.start > 0) {
		editor.replaceText(
			blockId,
			{ start: range.start - 1, end: range.start },
			"",
			{ history: "merge" },
		);
		return;
	}

	if (block.type === "bulletedListItem") {
		outdentListItem(editor, block);
		return;
	}

	if (block.content.length === 0) {
		editor.deleteBlockBackward(blockId);
	} else {
		editor.mergeBlockBackward(blockId);
	}
}

function applyDeleteForward(
	editor: MiniBlockCore,
	blockId: string,
	range: TextRange,
) {
	const blocks = editor.getBlocks();
	const blockIndex = blocks.findIndex((block) => block.id === blockId);
	const block = blocks[blockIndex];
	if (!block) return;

	if (range.start !== range.end) {
		editor.replaceText(blockId, range, "", { history: "merge" });
		return;
	}

	if (range.start < block.content.length) {
		editor.replaceText(
			blockId,
			{ start: range.start, end: range.start + 1 },
			"",
			{ history: "merge" },
		);
		return;
	}

	const nextBlock = blocks[blockIndex + 1];
	if (nextBlock) {
		editor.mergeBlockBackward(nextBlock.id);
	}
}

function outdentListItem(editor: MiniBlockCore, block: Block) {
	const currentIndent = block.indent ?? 0;
	if (currentIndent > 0) {
		editor.updateBlock(block.id, { indent: currentIndent - 1 });
		return;
	}

	editor.changeBlockType(block.id, "paragraph", block.content);
}

function applyTextShortcut(
	editor: MiniBlockCore,
	blockId: string,
	content: string,
) {
	const shortcut = TEXT_SHORTCUTS.find((item) => item.trigger === content);
	if (!shortcut) return false;

	editor.changeBlockType(blockId, shortcut.type, "");
	return true;
}

function findBlock(editor: MiniBlockCore, blockId: string) {
	return editor.getBlocks().find((block) => block.id === blockId);
}

function insertTextAt(content: string, offset: number, text: string) {
	const safeOffset = Math.max(0, Math.min(offset, content.length));
	return content.slice(0, safeOffset) + text + content.slice(safeOffset);
}

function assertNever(value: never): never {
	throw new Error(`Unhandled input intent: ${JSON.stringify(value)}`);
}
