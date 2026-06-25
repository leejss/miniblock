import type { BlockType } from "@miniblock/core";

export type BlockCommand = {
	label: string;
	type: BlockType;
	description: string;
	shortcut: string;
};

export const blockCommands = [
	{
		label: "Text",
		type: "p",
		description: "Start writing with plain text.",
		shortcut: "⌥⌘0",
	},
	{
		label: "Heading 1",
		type: "h1",
		description: "Big section heading.",
		shortcut: "⌥⌘1",
	},
	{
		label: "Heading 2",
		type: "h2",
		description: "Medium section heading.",
		shortcut: "⌥⌘2",
	},
	{
		label: "Heading 3",
		type: "h3",
		description: "Small section heading.",
		shortcut: "⌥⌘3",
	},
	{
		label: "Quote",
		type: "blockquote",
		description: "Capture a quote or highlight.",
		shortcut: "⌥⌘Q",
	},
	{
		label: "Code block",
		type: "pre",
		description: "Write code snippet or block.",
		shortcut: "⌥⌘C",
	},
] as const satisfies readonly BlockCommand[];
