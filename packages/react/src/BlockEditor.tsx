import "./styles.css";
import type {
	Block,
	BlockType,
	EditorSelection,
	SelectionPoint,
} from "@miniblock/core";
import { useLayoutEffect, useRef, useState } from "react";
import { blockCommands } from "./commands";
import { matchTextShortcut } from "./shortcuts";
import { useBlockEditor } from "./useBlockEditor";

type SlashMenuState = {
	blockId: string;
	activeIndex: number;
	top: number;
	left: number;
};

export type BlockEditorProps = {
	initialBlocks: Block[];
	onChange?: (blocks: Block[]) => void;
};

export function BlockEditor({ initialBlocks, onChange }: BlockEditorProps) {
	const {
		blocks,
		selection,
		updateBlock,
		splitBlock,
		mergeBlockBackward,
		deleteBlockBackward,
		changeBlockType,
		setSelection,
	} = useBlockEditor({ initialBlocks: initialBlocks, onChange });

	const blocksRef = useRef(new Map<string, HTMLElement>());
	const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);

	const selectSlashItem = (type: BlockType) => {
		if (!slashMenu) return;
		const element = blocksRef.current.get(slashMenu.blockId);
		const content = element?.textContent ?? "";
		const nextContent = content === "/" ? "" : content.replace(/ \/$/, "");
		const target = changeBlockType(slashMenu.blockId, type, nextContent);
		setSlashMenu(null);
		if (!target) return;
		requestAnimationFrame(() => {
			const nextElement = blocksRef.current.get(target.id);
			if (!nextElement) return;
			focusBlock(nextElement, target.offset);
		});
	};

	const syncSelectionFromDom = () => {
		setSelection(readSelectionFromDom(blocksRef.current));
	};

	console.log("selection", selection);
	useLayoutEffect(() => {
		applySelectionToDom(blocksRef.current, selection);
	}, [selection]);
	return (
		<div className="mb-editor">
			<div className="mb-editor__page">
				{blocks.map((block) => {
					const Block = block.type as BlockType;
					return (
						<Block
							className="mb-block"
							data-block-type={block.type}
							onMouseUp={syncSelectionFromDom}
							onKeyUp={syncSelectionFromDom}
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
								const content = event.currentTarget.textContent ?? "";
								// match shortcut
								const shortcut = matchTextShortcut(content);
								if (shortcut) {
									const target = changeBlockType(
										block.id,
										shortcut.type,
										shortcut.nextContent,
									);
									setSlashMenu(null);
									if (!target) return;

									requestAnimationFrame(() => {
										const element = blocksRef.current.get(block.id);
										if (!element) return;
										focusBlock(element, target.offset);
									});
									return;
								}

								updateBlock(block.id, {
									content,
								});

								if (content === "/" || content.endsWith(" /")) {
									const { offsetHeight, offsetLeft, offsetTop } =
										event.currentTarget;
									// Open menu
									setSlashMenu({
										blockId: block.id,
										activeIndex: 0,
										top: offsetTop + offsetHeight + 4,
										left: offsetLeft,
									});
								} else {
									// Hide menu
									setSlashMenu(null);
								}

								syncSelectionFromDom();
							}}
							onKeyDown={(event) => {
								if (slashMenu?.blockId === block.id) {
									if (event.key === "ArrowDown") {
										event.preventDefault();

										setSlashMenu((menu) =>
											menu
												? {
														...menu,
														activeIndex:
															(menu.activeIndex + 1) % blockCommands.length,
													}
												: menu,
										);
										return;
									}

									if (event.key === "ArrowUp") {
										event.preventDefault();

										setSlashMenu((menu) =>
											menu
												? {
														...menu,
														activeIndex:
															(menu.activeIndex - 1 + blockCommands.length) %
															blockCommands.length,
													}
												: menu,
										);
										return;
									}

									if (event.key === "Enter") {
										event.preventDefault();
										const item = blockCommands[slashMenu.activeIndex];
										selectSlashItem(item.type);

										return;
									}

									if (event.key === "Escape") {
										event.preventDefault();
										setSlashMenu(null);
										return;
									}
								}

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
									const selection = window.getSelection();
									const isAtStart =
										selection?.isCollapsed && selection.anchorOffset === 0;
									if (!isAtStart) return;
									event.preventDefault();

									const isEmpty =
										(event.currentTarget.textContent ?? "") === "";
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

									const index = blocks.findIndex(
										(item) => item.id === block.id,
									);
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
				{slashMenu ? (
					<div
						className="mb-slash-menu"
						style={{ top: slashMenu.top, left: slashMenu.left }}
					>
						{blockCommands.map((item, index) => (
							<button
								key={item.type}
								type="button"
								className={index === slashMenu.activeIndex ? "active" : ""}
								onMouseDown={(event) => {
									event.preventDefault();
									selectSlashItem(item.type);
								}}
							>
								{item.label}
							</button>
						))}
					</div>
				) : null}
			</div>
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

function readSelectionFromDom(
	blocksRef: Map<string, HTMLElement>,
): EditorSelection | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;

	const anchorBlockId = findSelectedBlockId(blocksRef, selection.anchorNode);
	const focusBlockId = findSelectedBlockId(blocksRef, selection.focusNode);

	if (!anchorBlockId || !focusBlockId) return null;

	return {
		anchor: {
			blockId: anchorBlockId,
			offset: selection.anchorOffset,
		},
		focus: {
			blockId: focusBlockId,
			offset: selection.focusOffset,
		},
	};
}

function findSelectedBlockId(
	blocksRef: Map<string, HTMLElement>,
	node: Node | null,
): string | null {
	if (!node) return null;

	const element = node instanceof HTMLElement ? node : node.parentElement;

	if (!element) return null;

	for (const [blockId, blockElement] of blocksRef) {
		if (blockElement.contains(element)) {
			return blockId;
		}
	}

	return null;
}

function applySelectionToDom(
	blocksRef: Map<string, HTMLElement>,
	editorSelection: EditorSelection | null,
) {
	if (!editorSelection) return;

	const anchorBlockElement = blocksRef.get(editorSelection.anchor.blockId);
	const focusBlockElement = blocksRef.get(editorSelection.focus.blockId);

	if (!anchorBlockElement || !focusBlockElement) return;

	// GET TextNode
	const anchorText = ensureTextNode(anchorBlockElement);
	const focusText = ensureTextNode(focusBlockElement);

	if (!anchorText || !focusText) return;

	const range = document.createRange();

	range.setStart(
		anchorText,
		Math.min(
			editorSelection.anchor.offset,
			anchorText.textContent?.length ?? 0,
		),
	);
	range.setEnd(
		focusText,
		Math.min(editorSelection.focus.offset, focusText.textContent.length ?? 0),
	);

	const domSelection = document.getSelection();
	domSelection?.removeAllRanges();
	domSelection?.addRange(range);
}

function ensureTextNode(element: HTMLElement): Text | null {
	let textNode = element.firstChild;

	if (!textNode) {
		textNode = document.createTextNode("");
		element.appendChild(textNode);
	}

	return textNode instanceof Text ? textNode : null;
}
