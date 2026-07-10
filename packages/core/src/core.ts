import { createBlock, normalizeBlock } from "./blocks";
import type {
	BlockPatch,
	CommandResult,
	CommitOptions,
	EditorCommand,
	HistoryPolicy,
	SelectionEffect,
	TextRange,
} from "./commands";
import {
	patchBlockHandler,
	replaceTextHandler,
	spliceBlocksHandler,
} from "./handlers";
import { createBlockId } from "./id";
import {
	areEditorSelectionsEqual,
	createCollapsedSelection,
	normalizeSelection,
} from "./selection";
import { createEmptyState, normalizeState } from "./state";
import type {
	BlockType,
	EditorSelection,
	EditorSnapshot,
	EditorState,
} from "./types";

type Listener = () => void;

type HistoryRecord = {
	command: EditorCommand;
	inverse: EditorCommand;
	selectionBefore: EditorSelection | null;
	selectionAfter: EditorSelection | null;
};

export class MiniBlockCore {
	private state: EditorState;
	private selection: EditorSelection | null = null;
	private snapshot: EditorSnapshot;
	private listeners = new Set<Listener>();
	private past: HistoryRecord[] = [];
	private future: HistoryRecord[] = [];

	constructor(initialState?: EditorState) {
		this.state = initialState
			? normalizeState(initialState)
			: createEmptyState();

		this.snapshot = this.createSnapshot();
	}

	setState(nextState: EditorState, options?: { emit: boolean }) {
		const state = normalizeState(nextState);
		const selection = normalizeSelection(state.blocks, this.selection);
		const stateChanged = state !== this.state;
		const selectionChanged = !areEditorSelectionsEqual(
			selection,
			this.selection,
		);

		this.state = state;
		this.selection = selection;
		this.snapshot = this.createSnapshot();

		if (options?.emit && (stateChanged || selectionChanged)) {
			this.emit();
		}
	}

	getState() {
		return this.state;
	}

	getSelection() {
		return this.selection;
	}

	getSnapshot() {
		return this.snapshot;
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

	setSelection(
		selection: EditorSelection | null,
		options?: { emit?: boolean },
	) {
		const nextSelection = normalizeSelection(this.state.blocks, selection);
		if (areEditorSelectionsEqual(this.selection, nextSelection)) return;

		this.selection = nextSelection;
		this.snapshot = this.createSnapshot();

		if (options?.emit !== false) {
			this.emit();
		}
	}

	replaceText(
		blockId: string,
		range: TextRange,
		text: string,
		options: CommitOptions = {},
	) {
		const payload = { blockId, range, text };
		const command: EditorCommand = { type: "replaceText", payload };
		const result = replaceTextHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, options);
	}

	updateBlock(id: string, patch: BlockPatch, options: CommitOptions = {}) {
		const payload = { blockId: id, patch };
		const command: EditorCommand = { type: "patchBlock", payload };
		const result = patchBlockHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, {
			history: "merge",
			...options,
		});
	}

	private createSnapshot(): EditorSnapshot {
		return {
			state: this.state,
			selection: this.selection,
		};
	}

	private emit() {
		for (const listener of this.listeners) {
			listener();
		}
	}

	splitBlock(blockId: string, offset: number) {
		const index = this.state.blocks.findIndex((block) => block.id === blockId);
		if (index === -1) return;

		const block = this.state.blocks[index];

		if (block.type === "bulletedListItem" && block.content === "") {
			const payload = {
				blockId,
				patch: {
					type: "paragraph" as const,
					indent: undefined,
				},
			};
			const command: EditorCommand = { type: "patchBlock", payload };
			const result = patchBlockHandler(this.state, this.selection, payload);

			this.commitCommandResult(command, result, {
				history: "record",
				select: { type: "collapse", blockId, offset: 0 },
			});
			return;
		}

		const splitOffset = Math.max(0, Math.min(offset, block.content.length));
		const newBlockId = createBlockId();
		const currentBlock = normalizeBlock({
			...block,
			content: block.content.slice(0, splitOffset),
		});
		const newBlock = createBlock({
			id: newBlockId,
			content: block.content.slice(splitOffset),
			type:
				block.type === "bulletedListItem" ? "bulletedListItem" : "paragraph",
			indent: block.type === "bulletedListItem" ? block.indent : undefined,
		});

		const payload = {
			index,
			deleteCount: 1,
			insert: [currentBlock, newBlock],
		};
		const command: EditorCommand = { type: "spliceBlocks", payload };
		const result = spliceBlocksHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, {
			history: "record",
			select: { type: "collapse", blockId: newBlockId },
		});
	}

	mergeBlockBackward(blockId: string) {
		const index = this.state.blocks.findIndex((block) => block.id === blockId);
		if (index <= 0) return;

		const previousBlock = this.state.blocks[index - 1];
		const currentBlock = this.state.blocks[index];
		const offset = previousBlock.content.length;
		const mergedBlock = normalizeBlock({
			...previousBlock,
			content: previousBlock.content + currentBlock.content,
		});

		const payload = {
			index: index - 1,
			deleteCount: 2,
			insert: [mergedBlock],
		};
		const command: EditorCommand = { type: "spliceBlocks", payload };
		const result = spliceBlocksHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, {
			history: "record",
			select: {
				type: "collapse",
				blockId: previousBlock.id,
				offset,
			},
		});
	}

	deleteBlockBackward(blockId: string): void {
		const index = this.state.blocks.findIndex((block) => block.id === blockId);
		if (index <= 0) return;

		const previousBlock = this.state.blocks[index - 1];

		const payload = {
			index,
			deleteCount: 1,
			insert: [],
		};
		const command: EditorCommand = { type: "spliceBlocks", payload };
		const result = spliceBlocksHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, {
			history: "record",
			select: {
				type: "collapse",
				blockId: previousBlock.id,
				offset: previousBlock.content.length,
			},
		});
	}

	changeBlockType(
		blockId: string,
		blockType: BlockType,
		newContent?: string,
	): void {
		const block = this.state.blocks.find((block) => block.id === blockId);
		if (!block) return;

		const content = newContent ?? block.content;
		const patch: BlockPatch = { type: blockType };
		if (newContent !== undefined) {
			patch.content = newContent;
		}

		const payload = {
			blockId,
			patch,
		};
		const command: EditorCommand = { type: "patchBlock", payload };
		const result = patchBlockHandler(this.state, this.selection, payload);

		this.commitCommandResult(command, result, {
			history: "record",
			select: { type: "collapse", blockId, offset: content.length },
		});
	}

	undo() {
		const record = this.past.pop();
		if (!record) return;

		const result = this.applyCommand(
			this.state,
			this.selection,
			record.inverse,
		);
		const selection = normalizeSelection(
			result.state.blocks,
			record.selectionBefore,
		);

		this.future.push(record);
		this.state = result.state;
		this.selection = selection;
		this.snapshot = this.createSnapshot();
		this.emit();
	}

	redo() {
		const record = this.future.pop();
		if (!record) return;

		const result = this.applyCommand(
			this.state,
			this.selection,
			record.command,
		);
		const selection = normalizeSelection(
			result.state.blocks,
			record.selectionAfter,
		);

		this.past.push(record);
		this.state = result.state;
		this.selection = selection;
		this.snapshot = this.createSnapshot();
		this.emit();
	}

	private recordHistory(record: HistoryRecord, history: HistoryPolicy) {
		const previous = this.past[this.past.length - 1];

		if (history === "merge" && previous) {
			const merged = mergeHistoryRecord(previous, record);
			if (merged) {
				this.past[this.past.length - 1] = merged;
				this.future = [];
				return;
			}
		}

		this.past.push(record);
		this.future = [];
	}

	private commitCommandResult(
		command: EditorCommand,
		result: CommandResult,
		options: CommitOptions = {},
	) {
		const selectionBefore = this.selection;
		const selection = applySelectionEffect(
			result.state.blocks,
			selectionBefore,
			result.selection,
			options.select,
		);
		const stateChanged = result.state !== this.state;
		const selectionChanged = !areEditorSelectionsEqual(
			selection,
			this.selection,
		);

		if (!stateChanged && !selectionChanged) return;

		const history = options.history ?? "record";

		if (history !== "skip" && result.inverse) {
			this.recordHistory(
				{
					command,
					inverse: result.inverse,
					selectionBefore,
					selectionAfter: selection,
				},
				history,
			);
		}

		this.state = result.state;
		this.selection = selection;
		this.snapshot = this.createSnapshot();
		this.emit();
	}

	private applyCommand(
		state: EditorState,
		selection: EditorSelection | null,
		command: EditorCommand,
	): CommandResult {
		let result: CommandResult;

		switch (command.type) {
			case "replaceText":
				result = replaceTextHandler(state, selection, command.payload);
				break;
			case "patchBlock":
				result = patchBlockHandler(state, selection, command.payload);
				break;
			case "spliceBlocks":
				result = spliceBlocksHandler(state, selection, command.payload);
				break;
			default:
				return assertNever(command);
		}

		return {
			...result,
			selection: normalizeSelection(result.state.blocks, result.selection),
		};
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}

function applySelectionEffect(
	blocks: EditorState["blocks"],
	previousSelection: EditorSelection | null,
	defaultSelection: EditorSelection | null,
	effect: SelectionEffect | undefined,
) {
	if (!effect) return normalizeSelection(blocks, defaultSelection);

	if (effect.type === "preserve") {
		return normalizeSelection(blocks, previousSelection);
	}

	if (effect.type === "set") {
		return normalizeSelection(blocks, effect.selection);
	}

	return normalizeSelection(
		blocks,
		createCollapsedSelection(effect.blockId, effect.offset ?? 0),
	);
}

function mergeHistoryRecord(
	previous: HistoryRecord,
	current: HistoryRecord,
): HistoryRecord | null {
	const mergedReplaceText = mergeReplaceTextHistory(previous, current);
	if (mergedReplaceText) return mergedReplaceText;

	if (
		previous.command.type === "patchBlock" &&
		current.command.type === "patchBlock" &&
		previous.inverse.type === "patchBlock" &&
		previous.command.payload.blockId === current.command.payload.blockId
	) {
		return {
			command: {
				type: "patchBlock",
				payload: {
					blockId: previous.command.payload.blockId,
					patch: {
						...previous.command.payload.patch,
						...current.command.payload.patch,
					},
				},
			},
			inverse: previous.inverse,
			selectionBefore: previous.selectionBefore,
			selectionAfter: current.selectionAfter,
		};
	}

	return null;
}

function mergeReplaceTextHistory(
	previous: HistoryRecord,
	current: HistoryRecord,
): HistoryRecord | null {
	if (
		previous.command.type !== "replaceText" ||
		current.command.type !== "replaceText" ||
		previous.inverse.type !== "replaceText" ||
		current.inverse.type !== "replaceText" ||
		previous.command.payload.blockId !== current.command.payload.blockId
	) {
		return null;
	}

	const previousPayload = previous.command.payload;
	const currentPayload = current.command.payload;
	const previousInversePayload = previous.inverse.payload;
	const currentInversePayload = current.inverse.payload;

	if (
		isPureInsert(previousPayload.range, previousPayload.text) &&
		isPureInsert(currentPayload.range, currentPayload.text) &&
		currentPayload.range.start ===
			previousPayload.range.start + previousPayload.text.length
	) {
		const text = previousPayload.text + currentPayload.text;

		return {
			command: {
				type: "replaceText",
				payload: {
					blockId: previousPayload.blockId,
					range: {
						start: previousPayload.range.start,
						end: previousPayload.range.start,
					},
					text,
				},
			},
			inverse: {
				type: "replaceText",
				payload: {
					blockId: previousPayload.blockId,
					range: {
						start: previousPayload.range.start,
						end: previousPayload.range.start + text.length,
					},
					text: "",
				},
			},
			selectionBefore: previous.selectionBefore,
			selectionAfter: current.selectionAfter,
		};
	}

	if (
		isPureDelete(previousPayload.range, previousPayload.text) &&
		isPureDelete(currentPayload.range, currentPayload.text) &&
		isPureInsert(previousInversePayload.range, previousInversePayload.text) &&
		isPureInsert(currentInversePayload.range, currentInversePayload.text)
	) {
		if (currentPayload.range.start === previousPayload.range.start) {
			const text = previousInversePayload.text + currentInversePayload.text;

			return createMergedDeleteHistory(previous, current, {
				blockId: previousPayload.blockId,
				start: previousPayload.range.start,
				text,
			});
		}

		if (
			currentPayload.range.start + currentInversePayload.text.length ===
			previousPayload.range.start
		) {
			const text = currentInversePayload.text + previousInversePayload.text;

			return createMergedDeleteHistory(previous, current, {
				blockId: previousPayload.blockId,
				start: currentPayload.range.start,
				text,
			});
		}
	}

	return null;
}

function createMergedDeleteHistory(
	previous: HistoryRecord,
	current: HistoryRecord,
	input: {
		blockId: string;
		start: number;
		text: string;
	},
): HistoryRecord {
	return {
		command: {
			type: "replaceText",
			payload: {
				blockId: input.blockId,
				range: {
					start: input.start,
					end: input.start + input.text.length,
				},
				text: "",
			},
		},
		inverse: {
			type: "replaceText",
			payload: {
				blockId: input.blockId,
				range: {
					start: input.start,
					end: input.start,
				},
				text: input.text,
			},
		},
		selectionBefore: previous.selectionBefore,
		selectionAfter: current.selectionAfter,
	};
}

function isPureInsert(range: TextRange, text: string) {
	return range.start === range.end && text.length > 0;
}

function isPureDelete(range: TextRange, text: string) {
	return range.start < range.end && text.length === 0;
}
