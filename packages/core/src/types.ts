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
