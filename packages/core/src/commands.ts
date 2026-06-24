import type { Block, BlockType, EditorSelection, EditorState } from "./types";

export type CommandPayloadMap = {
	updateBlock: {
		id: string;
		patch: Partial<Block>;
	};
	insertText: {
		blockId: string;
		offset: number;
		text: string;
	};
	deleteText: {
		blockId: string;
		start: number;
		end: number;
	};
	splitBlock: {
		blockId: string;
		offset: number;
		newBlockId: string;
	};
	mergeBlockBackward: {
		blockId: string;
	};
	deleteBlockBackward: {
		blockId: string;
	};
	changeBlockType: {
		blockId: string;
		blockType: BlockType;
		newContent?: string;
	};
	replaceBlocks: {
		start: number;
		deleteCount: number;
		blocks: Block[];
		selection: EditorSelection | null;
	};
};

export type CommandType = keyof CommandPayloadMap;

export type CommandPayload<T extends CommandType> = CommandPayloadMap[T];

export type EditorCommand = {
	[T in CommandType]: {
		type: T;
		payload: CommandPayload<T>;
	};
}[CommandType];

export type CommandResult = {
	state: EditorState;
	selection: EditorSelection | null;
	inverse: EditorCommand | null;
};

export type CommandHandler<T extends CommandType = CommandType> = (
	state: EditorState,
	selection: EditorSelection | null,
	payload: CommandPayload<T>,
) => CommandResult;

export type HistoryPolicy = "record" | "skip" | "merge";

export type DispatchOptions = {
	history?: HistoryPolicy;
};
