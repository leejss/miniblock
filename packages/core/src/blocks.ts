import { type Block, type BlockType, MAX_BULLET_INDENT } from "./types";

export type CreateBlockInput = {
	id: string;
	content?: string;
	type?: BlockType;
	indent?: number;
};

export function createBlock(input: CreateBlockInput): Block {
	return normalizeBlock({
		id: input.id,
		content: input.content ?? "",
		type: input.type ?? "paragraph",
		indent: input.indent,
	});
}

export function normalizeBlock(input: {
	id: string;
	content: string;
	type: BlockType;
	indent?: unknown;
}): Block {
	const baseBlock: Block = {
		id: input.id,
		content: input.content,
		type: input.type,
	};
	const indent = normalizeBlockIndent(input.type, input.indent);
	return indent === undefined ? baseBlock : { ...baseBlock, indent };
}

export function normalizeBlockIndent(
	type: BlockType,
	indent: unknown,
): number | undefined {
	if (type !== "bulletedListItem") return undefined;
	if (typeof indent !== "number" || !Number.isFinite(indent)) return 0;
	return Math.max(0, Math.min(MAX_BULLET_INDENT, Math.trunc(indent)));
}
