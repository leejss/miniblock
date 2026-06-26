import type { BlockType } from "@miniblock/core";

export type TextShortcut = {
	trigger: string;
	type: BlockType;
};

export const textShortcuts = [
	{
		trigger: "# ",
		type: "heading1",
	},
	{
		trigger: "## ",
		type: "heading2",
	},
	{
		trigger: "### ",
		type: "heading3",
	},
	{
		trigger: "> ",
		type: "quote",
	},
	{
		trigger: "``` ",
		type: "codeBlock",
	},
	{
		trigger: "- ",
		type: "bulletedListItem",
	},
	{
		trigger: "* ",
		type: "bulletedListItem",
	},
] as const satisfies readonly TextShortcut[];

export function matchTextShortcut(content: string): TextShortcut | null {
	return textShortcuts.find((shortcut) => shortcut.trigger === content) ?? null;
}
