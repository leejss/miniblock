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
		type: "paragraph",
		description: "Start writing with plain text.",
		shortcut: "⌥⌘0",
	},
	{
		label: "Heading 1",
		type: "heading1",
		description: "Big section heading.",
		shortcut: "⌥⌘1",
	},
	{
		label: "Heading 2",
		type: "heading2",
		description: "Medium section heading.",
		shortcut: "⌥⌘2",
	},
	{
		label: "Heading 3",
		type: "heading3",
		description: "Small section heading.",
		shortcut: "⌥⌘3",
	},
	{
		label: "Quote",
		type: "quote",
		description: "Capture a quote or highlight.",
		shortcut: "⌥⌘Q",
	},
	{
		label: "Code block",
		type: "codeBlock",
		description: "Write code snippet or block.",
		shortcut: "⌥⌘C",
	},
	{
		label: "Bulleted list",
		type: "bulletedListItem",
		description: "Create a simple bulleted list.",
		shortcut: "⌥⌘8",
	},
] as const satisfies readonly BlockCommand[];
