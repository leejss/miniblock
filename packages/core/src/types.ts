export type BlockType = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";

export type Block = {
	id: string;
	type: BlockType;
	content: string;
};

export type FocusTarget = {
	id: string;
	offset: number;
};

export type SelectionPoint = {
	blockId: string;
	offset: number;
};

export type EditorSelection = {
	anchor: SelectionPoint;
	focus: SelectionPoint;
};

export type EditorState = {
	blocks: Block[];
	selection: EditorSelection | null;
};
