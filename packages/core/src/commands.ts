import type { Block, BlockType, EditorSelection, EditorState } from "./types";

export type CommandResult = {
	state: EditorState;
	selection: EditorSelection | null;
	inverse: EditorCommand | null;
};

export type CommandHandler<C extends EditorCommand = EditorCommand> = (
	state: EditorState,
	selection: EditorSelection | null,
	command: C,
) => CommandResult;

export type HistoryPolicy = "record" | "skip" | "merge";

export type DispatchOptions = {
	history?: HistoryPolicy;
};

export type EditorCommand =
	| {
			type: "updateBlock";
			id: string;
			patch: Partial<Block>;
	  }
	| {
			type: "insertText";
			blockId: string;
			offset: number;
			text: string;
	  }
	| {
			type: "deleteText";
			blockId: string;
			start: number;
			end: number;
	  }
	| {
			type: "splitBlock";
			blockId: string;
			offset: number;
			newBlockId: string;
	  }
	| {
			type: "mergeBlockBackward";
			blockId: string;
	  }
	| {
			type: "deleteBlockBackward";
			blockId: string;
	  }
	| {
			type: "changeBlockType";
			blockId: string;
			blockType: BlockType;
			newContent?: string;
	  }
	| {
			type: "replaceBlocks";
			start: number;
			deleteCount: number;
			blocks: Block[];
			selection: EditorSelection | null;
	  };
