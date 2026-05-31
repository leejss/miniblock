import type { Block } from "@miniblock/core";
import { useRef } from "react";
import { useBlockEditor } from "./useBlockEditor";

type BlockTag = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";
export type BlockEditorProps = {
	initialState: Block[];
};

export function BlockEditor({ initialState }: BlockEditorProps) {
	const { blocks, updateBlock, splitBlock } = useBlockEditor({ initialState });
	const blocksRef = useRef(new Map<string, HTMLElement>());

	return (
		<div>
			{blocks.map((block) => {
				const Tag = block.type as BlockTag;

				return (
					<Tag
						ref={(el: HTMLElement | null) => {
							if (el) {
								blocksRef.current.set(block.id, el);
							} else {
								blocksRef.current.delete(block.id);
							}
						}}
						key={block.id}
						contentEditable
						suppressContentEditableWarning
						onInput={(event) => {
							updateBlock(block.id, {
								content: event.currentTarget.textContent ?? "",
							});
						}}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;

							event.preventDefault();

							const selection = window.getSelection();
							const offset = selection?.anchorOffset ?? 0;

							const nextBlockId = splitBlock(block.id, offset);
							if (nextBlockId === null) return;

							requestAnimationFrame(() => {
								const nextBlock = blocksRef.current.get(nextBlockId);

								if (!nextBlock) return;

								focusBlock(nextBlock, 0);
							});
						}}
					>
						{block.content}
					</Tag>
				);
			})}
		</div>
	);
}

function focusBlock(element: HTMLElement, offset: number) {
	element.focus();

	//? Check node type ?
	let textNode = element.firstChild;

	if (!textNode) {
		textNode = document.createTextNode("");
		element.appendChild(textNode);
	}

	if (!(textNode instanceof Text)) return;

	const range = document.createRange();
	const targetOffset = Math.min(offset, textNode.textContent?.length ?? 0);

	range.setStart(textNode, targetOffset);
	range.collapse(true);

	const selection = document.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}
