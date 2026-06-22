import type { Block, BlockType, EditorSelection } from "./types";

export type HistoryPolicy = "record" | "skip" | "merge";

export type DispatchOptions = {
	history?: HistoryPolicy;
};

export type EditorCommand =
	| {
			type: "setSelection";
			selection: EditorSelection | null;
	  }
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
