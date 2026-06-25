import type { BlockType } from "@miniblock/core";

export type BlockCommand = {
	label: string;
	type: BlockType;
};

export const blockCommands = [
	{ label: "Text", type: "p" },
	{ label: "Heading 1", type: "h1" },
	{ label: "Heading 2", type: "h2" },
	{ label: "Heading 3", type: "h3" },
	{ label: "Quote", type: "blockquote" },
	{ label: "Code", type: "pre" },
] as const satisfies readonly BlockCommand[];
