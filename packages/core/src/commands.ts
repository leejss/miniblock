import type { Block, EditorSelection, EditorState } from "./types";

export type TextRange = {
	start: number;
	end: number;
};

export type BlockPatch = {
	type?: Block["type"];
	content?: string;
	indent?: number | undefined;
};

export type SelectionEffect =
	| { type: "preserve" }
	| { type: "set"; selection: EditorSelection | null }
	| { type: "collapse"; blockId: string; offset?: number };

export type CommandPayloadMap = {
	replaceText: {
		blockId: string;
		range: TextRange;
		text: string;
	};
	patchBlock: {
		blockId: string;
		patch: BlockPatch;
	};
	spliceBlocks: {
		index: number;
		deleteCount: number;
		insert: Block[];
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

export type CommitOptions = {
	history?: HistoryPolicy;
	select?: SelectionEffect;
};
