import type { BlockType } from "./types";

export type CreateId = () => string;

export type CreateBlockInput = {
	id: string;
	content?: string;
	type?: BlockType;
};

export function createBlock(input: CreateBlockInput) {
	return {
		id: input.id,
		content: input.content ?? "",
		type: input.type ?? "p",
	};
}
