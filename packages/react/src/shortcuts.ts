import type { BlockType } from "@miniblock/core";

export type TextShortcut = {
	trigger: string;
	type: BlockType;
	nextContent: string;
};

export const textShortcuts = [
	{
		trigger: "# ",
		type: "h1",
		nextContent: "",
	},
	{
		trigger: "## ",
		type: "h2",
		nextContent: "",
	},
	{
		trigger: "### ",
		type: "h3",
		nextContent: "",
	},
	{
		trigger: "> ",
		type: "blockquote",
		nextContent: "",
	},
	{
		trigger: "``` ",
		type: "pre",
		nextContent: "",
	},
] as const satisfies readonly TextShortcut[];

export function matchTextShortcut(content: string): TextShortcut | null {
	return textShortcuts.find((shortcut) => shortcut.trigger === content) ?? null;
}
