import type { BlockType } from "./types";

export type CreateId = () => string;

export function createBlock(
	createId: CreateId,
	content = "",
	type: BlockType = "p",
) {
	return {
		id: createId(),
		content,
		type,
	};
}
