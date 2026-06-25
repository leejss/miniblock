import type { BlockType } from "@miniblock/core";

export type TextShortcut = {
	trigger: string;
	type: BlockType;
};

export const textShortcuts = [
	{
		trigger: "# ",
		type: "h1",
	},
	{
		trigger: "## ",
		type: "h2",
	},
	{
		trigger: "### ",
		type: "h3",
	},
	{
		trigger: "> ",
		type: "blockquote",
	},
	{
		trigger: "``` ",
		type: "pre",
	},
] as const satisfies readonly TextShortcut[];

export function matchTextShortcut(content: string): TextShortcut | null {
	return textShortcuts.find((shortcut) => shortcut.trigger === content) ?? null;
}
