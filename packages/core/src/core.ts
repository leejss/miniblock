import type {
	CommandResult,
	DispatchOptions,
	EditorCommand,
	HistoryPolicy,
} from "./commands";
import { commandHandlers } from "./handlers";
import { createBlockId } from "./id";
import { normalizeSelection } from "./selection";
import { createEmptyState, normalizeState } from "./state";
import type {
	Block,
	BlockType,
	EditorChange,
	EditorRuntimeState,
	EditorSelection,
	EditorSnapshot,
	EditorState,
} from "./types";

type Listener = (snapshot: EditorSnapshot, change: EditorChange) => void;

type HistoryRecord = {
	command: EditorCommand;
	inverse: EditorCommand;
	selectionBefore: EditorSelection | null;
	selectionAfter: EditorSelection | null;
};

export class MiniBlockCore {
	private state: EditorState;
	private runtime: EditorRuntimeState;
	private snapshot: EditorSnapshot;
	private listeners = new Set<Listener>();
	private past: HistoryRecord[] = [];
	private future: HistoryRecord[] = [];

	constructor(
		initialState?: EditorState,
		initialSelection?: EditorSelection | null,
	) {
		this.state = initialState
			? normalizeState(initialState)
			: createEmptyState();
		this.runtime = {
			selection: normalizeSelection(
				this.state.blocks,
				initialSelection ?? null,
			),
		};
		this.snapshot = this.createSnapshot();
	}

	setState(nextState: EditorState, options?: { emit: boolean }) {
		const state = normalizeState(nextState);
		const selection = normalizeSelection(state.blocks, this.runtime.selection);
		const stateChanged = state !== this.state;
		const selectionChanged = !isSelectionEqual(
			selection,
			this.runtime.selection,
		);

		this.state = state;
		this.runtime = { selection };
		this.snapshot = this.createSnapshot();

		if (options?.emit) {
			this.emit({ stateChanged, selectionChanged });
		}
	}

	getState() {
		return this.state;
	}

	getSelection() {
		return this.runtime.selection;
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
		if (isSelectionEqual(this.runtime.selection, nextSelection)) return;

		this.runtime = { selection: nextSelection };
		this.snapshot = this.createSnapshot();

		if (options?.emit !== false) {
			this.emit({ stateChanged: false, selectionChanged: true });
		}
	}

	updateBlock(id: string, patch: Partial<Block>) {
		this.dispatch(
			{ type: "updateBlock", id, patch },
			{
				history: "merge",
			},
		);
	}

	private createSnapshot(): EditorSnapshot {
		return {
			state: this.state,
			runtime: this.runtime,
		};
	}

	private emit(change: EditorChange) {
		if (!change.stateChanged && !change.selectionChanged) return;

		for (const listener of this.listeners) {
			listener(this.snapshot, change);
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

		const result = this.applyCommand(
			this.state,
			this.runtime.selection,
			record.inverse,
		);
		const selection = normalizeSelection(
			result.state.blocks,
			record.selectionBefore,
		);

		this.future.push(record);
		this.state = result.state;
		this.runtime = { selection };
		this.snapshot = this.createSnapshot();
		this.emit({ stateChanged: true, selectionChanged: true });
	}

	redo() {
		const record = this.future.pop();
		if (!record) return;

		const result = this.applyCommand(
			this.state,
			this.runtime.selection,
			record.command,
		);
		const selection = normalizeSelection(
			result.state.blocks,
			record.selectionAfter,
		);

		this.past.push(record);
		this.state = result.state;
		this.runtime = { selection };
		this.snapshot = this.createSnapshot();
		this.emit({ stateChanged: true, selectionChanged: true });
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

	dispatch(command: EditorCommand, options: DispatchOptions = {}) {
		const selectionBefore = this.runtime.selection;
		const result = this.applyCommand(this.state, selectionBefore, command);
		const stateChanged = result.state !== this.state;
		const selectionChanged = !isSelectionEqual(
			result.selection,
			this.runtime.selection,
		);

		if (!stateChanged && !selectionChanged) return;

		const history = options.history ?? "record";

		if (history !== "skip" && result.inverse) {
			this.recordHistory(
				{
					command,
					inverse: result.inverse,
					selectionBefore,
					selectionAfter: result.selection,
				},
				history,
			);
		}

		this.state = result.state;
		this.runtime = { selection: result.selection };
		this.snapshot = this.createSnapshot();
		this.emit({ stateChanged, selectionChanged });
	}

	private applyCommand(
		state: EditorState,
		selection: EditorSelection | null,
		command: EditorCommand,
	): CommandResult {
		const handler = commandHandlers[command.type];
		if (!handler) {
			return {
				state,
				selection,
				inverse: null,
			};
		}
		return handler.apply(state, selection, command as never);
	}
}

function isSelectionEqual(
	left: EditorSelection | null,
	right: EditorSelection | null,
) {
	if (left === right) return true;
	if (!left || !right) return false;

	return (
		left.anchor.blockId === right.anchor.blockId &&
		left.anchor.offset === right.anchor.offset &&
		left.focus.blockId === right.focus.blockId &&
		left.focus.offset === right.focus.offset
	);
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
