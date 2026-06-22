import type { DispatchOptions, EditorCommand, HistoryPolicy } from "./commands";
import { createBlockId } from "./id";
import { normalizeSelection } from "./selection";
import { createEmptyState, normalizeState } from "./state";
import {
	changeBlockTypeState,
	deleteBlockBackwardState,
	deleteTextState,
	insertTextState,
	mergeBlockBackwardState,
	splitBlockState,
} from "./transform";
import type { Block, BlockType, EditorSelection, EditorState } from "./types";

type Listener = (state: EditorState) => void;

type CommandResult = {
	state: EditorState;
	inverse: EditorCommand | null;
};

type HistoryRecord = {
	command: EditorCommand;
	inverse: EditorCommand;
	selectionBefore: EditorSelection | null;
	selectionAfter: EditorSelection | null;
};

export class MiniBlockCore {
	private state: EditorState;
	private listeners = new Set<Listener>();
	private past: HistoryRecord[] = [];
	private future: HistoryRecord[] = [];

	constructor(initialState?: EditorState) {
		this.state = initialState
			? normalizeState(initialState)
			: createEmptyState();
	}

	setState(nextState: EditorState, options?: { emit: boolean }) {
		this.state = normalizeState(nextState);
		if (options?.emit) this.emit();
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
		this.dispatch(
			{ type: "setSelection", selection },
			{
				history: "skip",
			},
		);
	}

	updateBlock(id: string, patch: Partial<Block>) {
		this.dispatch(
			{ type: "updateBlock", id, patch },
			{
				history: "merge",
			},
		);
	}

	private emit() {
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	splitBlock(blockId: string, offset: number) {
		this.dispatch(
			{ type: "splitBlock", blockId, offset, newBlockId: createBlockId() },
			{
				history: "record",
			},
		);
	}

	mergeBlockBackward(blockId: string) {
		this.dispatch(
			{ type: "mergeBlockBackward", blockId },
			{
				history: "record",
			},
		);
	}

	deleteBlockBackward(blockId: string): void {
		this.dispatch(
			{ type: "deleteBlockBackward", blockId },
			{
				history: "record",
			},
		);
	}

	changeBlockType(
		blockId: string,
		blockType: BlockType,
		newContent?: string,
	): void {
		this.dispatch(
			{
				type: "changeBlockType",
				blockId,
				blockType,
				newContent,
			},
			{
				history: "record",
			},
		);
	}

	undo() {
		const record = this.past.pop();
		if (!record) return;

		const result = this.applyCommand(this.state, record.inverse);

		this.future.push(record);
		this.state = {
			...result.state,
			selection: normalizeSelection(
				result.state.blocks,
				record.selectionBefore,
			),
		};
		this.emit();
	}

	redo() {
		const record = this.future.pop();
		if (!record) return;

		const result = this.applyCommand(this.state, record.command);

		this.past.push(record);
		this.state = {
			...result.state,
			selection: normalizeSelection(result.state.blocks, record.selectionAfter),
		};
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

	// 상태변경 진입점
	dispatch(command: EditorCommand, options: DispatchOptions = {}) {
		const selectionBefore = this.state.selection;
		const result = this.applyCommand(this.state, command);

		if (result.state === this.state) return;

		const history = options.history ?? "record";

		if (history !== "skip" && result.inverse) {
			this.recordHistory(
				{
					command,
					inverse: result.inverse,
					selectionBefore,
					selectionAfter: result.state.selection,
				},
				history,
			);
		}

		this.state = result.state;
		this.emit();
	}
	private applyCommand(
		state: EditorState,
		command: EditorCommand,
	): CommandResult {
		if (command.type === "setSelection") {
			const nextState = {
				...state,
				selection: normalizeSelection(state.blocks, command.selection),
			};

			return {
				state: nextState,
				inverse: {
					type: "setSelection",
					selection: state.selection,
				},
			};
		}

		if (command.type === "updateBlock") {
			const index = state.blocks.findIndex((block) => block.id === command.id);
			if (index === -1) return unchanged(state);

			const previousBlock = state.blocks[index];
			const blocks = state.blocks.map((block) =>
				block.id === command.id ? { ...block, ...command.patch } : block,
			);

			return {
				state: {
					...state,
					blocks,
					selection: normalizeSelection(blocks, state.selection),
				},
				inverse: {
					type: "replaceBlocks",
					start: index,
					deleteCount: 1,
					blocks: [previousBlock],
					selection: state.selection,
				},
			};
		}

		if (command.type === "splitBlock") {
			const index = state.blocks.findIndex(
				(block) => block.id === command.blockId,
			);
			if (index === -1) return unchanged(state);

			const previousBlock = state.blocks[index];
			const nextState = splitBlockState(state, {
				blockId: command.blockId,
				offset: command.offset,
				newBlockId: command.newBlockId,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "replaceBlocks",
					start: index,
					deleteCount: 2,
					blocks: [previousBlock],
					selection: state.selection,
				},
			};
		}

		if (command.type === "mergeBlockBackward") {
			const index = state.blocks.findIndex(
				(block) => block.id === command.blockId,
			);
			if (index <= 0) return unchanged(state);

			const previousBlock = state.blocks[index - 1];
			const currentBlock = state.blocks[index];
			const nextState = mergeBlockBackwardState(state, {
				blockId: command.blockId,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "replaceBlocks",
					start: index - 1,
					deleteCount: 1,
					blocks: [previousBlock, currentBlock],
					selection: state.selection,
				},
			};
		}

		if (command.type === "deleteBlockBackward") {
			const index = state.blocks.findIndex(
				(block) => block.id === command.blockId,
			);
			if (index <= 0) return unchanged(state);

			const deletedBlock = state.blocks[index];
			const nextState = deleteBlockBackwardState(state, {
				blockId: command.blockId,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "replaceBlocks",
					start: index,
					deleteCount: 0,
					blocks: [deletedBlock],
					selection: state.selection,
				},
			};
		}

		if (command.type === "changeBlockType") {
			const index = state.blocks.findIndex(
				(block) => block.id === command.blockId,
			);
			if (index === -1) return unchanged(state);

			const previousBlock = state.blocks[index];
			const nextState = changeBlockTypeState(state, {
				blockId: command.blockId,
				type: command.blockType,
				newContent: command.newContent,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "replaceBlocks",
					start: index,
					deleteCount: 1,
					blocks: [previousBlock],
					selection: state.selection,
				},
			};
		}

		if (command.type === "insertText") {
			if (command.text.length === 0) return unchanged(state);

			const block = state.blocks.find((block) => block.id === command.blockId);
			if (!block) return unchanged(state);

			const offset = Math.max(
				0,
				Math.min(command.offset, block.content.length),
			);
			const nextState = insertTextState(state, {
				blockId: command.blockId,
				offset,
				text: command.text,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "deleteText",
					blockId: command.blockId,
					start: offset,
					end: offset + command.text.length,
				},
			};
		}

		if (command.type === "deleteText") {
			const block = state.blocks.find((block) => block.id === command.blockId);
			if (!block) return unchanged(state);

			const start = Math.max(0, Math.min(command.start, block.content.length));
			const end = Math.max(start, Math.min(command.end, block.content.length));
			if (start === end) return unchanged(state);

			const deletedText = block.content.slice(start, end);
			const nextState = deleteTextState(state, {
				blockId: command.blockId,
				start,
				end,
			});

			if (nextState === state) return unchanged(state);

			return {
				state: nextState,
				inverse: {
					type: "insertText",
					blockId: command.blockId,
					offset: start,
					text: deletedText,
				},
			};
		}

		if (command.type === "replaceBlocks") {
			const start = Math.max(0, Math.min(command.start, state.blocks.length));
			const deleteCount = Math.max(
				0,
				Math.min(command.deleteCount, state.blocks.length - start),
			);
			const removedBlocks = state.blocks.slice(start, start + deleteCount);
			const blocks = [
				...state.blocks.slice(0, start),
				...command.blocks,
				...state.blocks.slice(start + deleteCount),
			];

			if (blocks.length === 0) return unchanged(state);

			return {
				state: {
					...state,
					blocks,
					selection: normalizeSelection(blocks, command.selection),
				},
				inverse: {
					type: "replaceBlocks",
					start,
					deleteCount: command.blocks.length,
					blocks: removedBlocks,
					selection: state.selection,
				},
			};
		}

		return unchanged(state);
	}
}

function unchanged(state: EditorState): CommandResult {
	return {
		state,
		inverse: null,
	};
}

function mergeHistoryRecord(
	previous: HistoryRecord,
	current: HistoryRecord,
): HistoryRecord | null {
	if (
		previous.command.type === "insertText" &&
		current.command.type === "insertText" &&
		previous.inverse.type === "deleteText" &&
		current.inverse.type === "deleteText" &&
		previous.command.blockId === current.command.blockId &&
		current.command.offset ===
			previous.command.offset + previous.command.text.length
	) {
		const text = previous.command.text + current.command.text;

		return {
			command: {
				type: "insertText",
				blockId: previous.command.blockId,
				offset: previous.command.offset,
				text,
			},
			inverse: {
				type: "deleteText",
				blockId: previous.command.blockId,
				start: previous.command.offset,
				end: previous.command.offset + text.length,
			},
			selectionBefore: previous.selectionBefore,
			selectionAfter: current.selectionAfter,
		};
	}

	if (
		previous.command.type === "deleteText" &&
		current.command.type === "deleteText" &&
		previous.inverse.type === "insertText" &&
		current.inverse.type === "insertText" &&
		previous.command.blockId === current.command.blockId
	) {
		if (current.command.start === previous.command.start) {
			const deletedText = previous.inverse.text + current.inverse.text;

			return {
				command: {
					type: "deleteText",
					blockId: previous.command.blockId,
					start: previous.command.start,
					end: previous.command.start + deletedText.length,
				},
				inverse: {
					type: "insertText",
					blockId: previous.command.blockId,
					offset: previous.command.start,
					text: deletedText,
				},
				selectionBefore: previous.selectionBefore,
				selectionAfter: current.selectionAfter,
			};
		}

		if (
			current.command.start + current.inverse.text.length ===
			previous.command.start
		) {
			const deletedText = current.inverse.text + previous.inverse.text;

			return {
				command: {
					type: "deleteText",
					blockId: previous.command.blockId,
					start: current.command.start,
					end: current.command.start + deletedText.length,
				},
				inverse: {
					type: "insertText",
					blockId: previous.command.blockId,
					offset: current.command.start,
					text: deletedText,
				},
				selectionBefore: previous.selectionBefore,
				selectionAfter: current.selectionAfter,
			};
		}
	}

	if (
		previous.command.type === "updateBlock" &&
		current.command.type === "updateBlock" &&
		previous.command.id === current.command.id
	) {
		return {
			command: current.command,
			inverse: previous.inverse,
			selectionBefore: previous.selectionBefore,
			selectionAfter: current.selectionAfter,
		};
	}

	return null;
}
