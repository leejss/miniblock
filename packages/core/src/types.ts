export type BlockType =
	| "paragraph"
	| "heading1"
	| "heading2"
	| "heading3"
	| "quote"
	| "codeBlock"
	| "bulletedListItem";

export type Block = {
	id: string;
	type: BlockType;
	content: string;
	indent?: number;
};

export const MAX_BULLET_INDENT = 5;

export type SelectionPoint = {
	blockId: string;
	offset: number;
};

export type EditorSelection = {
	anchor: SelectionPoint;
	focus: SelectionPoint;
};

export const EDITOR_STATE_SCHEMA_VERSION = 2;

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
