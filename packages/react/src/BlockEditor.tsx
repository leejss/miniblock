import type { Block } from "@miniblock/core";
import { useRef } from "react";
import { useBlockEditor } from "./useBlockEditor";

type BlockTag = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";
export type BlockEditorProps = {
	initialState: Block[];
	onChange?: (blocks: Block[]) => void;
};

export function BlockEditor({ initialState, onChange }: BlockEditorProps) {
	const {
		blocks,
		updateBlock,
		splitBlock,
		mergeBlockBackward,
		deleteBlockBackward,
	} = useBlockEditor({ initialState, onChange });
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

								if (el.textContent !== block.content) {
									el.textContent = block.content;
								}
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
							if (event.key === "Enter") {
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
								return;
							}

							if (event.key === "Backspace") {
								// mergeBlockBackward
								// caret의 위치가 처음인 경우에 merge

								const selection = window.getSelection();
								const isAtStart =
									selection?.isCollapsed && selection.anchorOffset === 0;
								if (!isAtStart) return;
								event.preventDefault();

								const isEmpty = (event.currentTarget.textContent ?? "") === "";
								const target = isEmpty
									? deleteBlockBackward(block.id)
									: mergeBlockBackward(block.id);

								if (!target) return;

								requestAnimationFrame(() => {
									const targetBlock = blocksRef.current.get(target.id);
									if (!targetBlock) return;

									focusBlock(targetBlock, target.offset);
								});

								return;
							}

							if (event.key === "ArrowUp" || event.key === "ArrowDown") {
								event.preventDefault();

								const index = blocks.findIndex((item) => item.id === block.id);
								const nextIndex =
									event.key === "ArrowUp" ? index - 1 : index + 1;

								const nextBlock = blocks[nextIndex];
								if (!nextBlock) return;

								const offset = getCaretOffset();

								requestAnimationFrame(() => {
									const element = blocksRef.current.get(nextBlock.id);
									if (!element) return;
									focusBlock(element, offset);
								});
							}
						}}
					/>
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

function getCaretOffset() {
	const selection = window.getSelection();
	if (!selection?.isCollapsed) return 0;
	return selection.anchorOffset;
}
