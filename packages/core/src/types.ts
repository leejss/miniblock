export type BlockType = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";

export type Block = {
	id: string;
	type: BlockType;
	content: string;
};

export type SelectionPoint = {
	blockId: string;
	offset: number;
};

export type EditorSelection = {
	anchor: SelectionPoint;
	focus: SelectionPoint;
};

export const EDITOR_STATE_SCHEMA_VERSION = 1;

export type EditorState = {
	schemaVersion: typeof EDITOR_STATE_SCHEMA_VERSION;
	blocks: Block[];
};

export type EditorRuntimeState = {
	selection: EditorSelection | null;
};

export type EditorSnapshot = {
	state: EditorState;
	runtime: EditorRuntimeState;
};

export type EditorChange = {
	stateChanged: boolean;
	selectionChanged: boolean;
};
