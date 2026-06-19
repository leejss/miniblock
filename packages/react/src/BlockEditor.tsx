import type { BlockType, EditorSelection, EditorState } from "@miniblock/core";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { blockCommands } from "./commands";
import { matchTextShortcut } from "./shortcuts";
import "./styles.css";
import { useBlockEditor } from "./useBlockEditor";

type SlashMenuState = {
	blockId: string;
	activeIndex: number;
	top: number;
	left: number;
};

export type BlockEditorProps = {
	value?: EditorState;
	defaultValue?: EditorState;
	onChange?: (state: EditorState) => void;
	readOnly?: string;
	autoFocus?: boolean;
	placeholder?: string;
	className?: string;
	style?: CSSProperties;
};

export function BlockEditor({
	onChange,
	defaultValue,
	value,
	autoFocus = true,
	className,
	placeholder,
	readOnly,
	style,
}: BlockEditorProps) {
	const {
		blocks,
		selection,
		updateBlock,
		splitBlock,
		mergeBlockBackward,
		deleteBlockBackward,
		changeBlockType,
		setSelection,
	} = useBlockEditor({ onChange, defaultValue, value });

	const blocksRef = useRef(new Map<string, HTMLElement>());
	const isComposingRef = useRef(false);
	const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);

	const selectSlashItem = (type: BlockType) => {
		if (!slashMenu) return;
		const element = blocksRef.current.get(slashMenu.blockId);
		const content = element?.textContent ?? "";
		const nextContent = content === "/" ? "" : content.replace(/ \/$/, "");

		changeBlockType(slashMenu.blockId, type, nextContent);
		setSlashMenu(null);
	};

	const syncSelectionFromDom = () => {
		setSelection(readSelectionFromDom(blocksRef.current));
	};

	// commit helper. commit: confirm editor state update
	const commitBlockContent = (
		blockId: string,
		content: string,
		element: HTMLElement,
	) => {
		const shortcut = matchTextShortcut(content);
		if (shortcut) {
			changeBlockType(blockId, shortcut.type, "");
			setSlashMenu(null);
			return;
		}

		// update editor state
		updateBlock(blockId, { content });

		// show slash menu
		if (isSlashTrigger(content)) {
			const { offsetHeight, offsetLeft, offsetTop } = element;

			setSlashMenu({
				blockId,
				activeIndex: 0,
				top: offsetTop + offsetHeight + 4,
				left: offsetLeft,
			});
		} else {
			setSlashMenu(null);
		}
	};

	const handleNativeBeforeInput = (
		event: InputEvent,
		blockId: string,
		blockContent: string,
		blockElement: HTMLElement,
	) => {
		if (readOnly) return;
		if (isComposingRef.current || event.isComposing) return;
		if (isCompositionInput(event.inputType)) return;

		const selection = window.getSelection();
		const offset = getCollapsedOffsetInBlock(blockElement, selection);
		if (offset === null) return;

		if (event.inputType === "insertText") {
			const text = event.data;
			if (!text) return;

			event.preventDefault();

			const nextContent = insertTextAt(blockContent, offset, text);
			const nextOffset = offset + text.length;

			commitBlockContent(blockId, nextContent, blockElement);
			setSelection({
				anchor: { blockId, offset: nextOffset },
				focus: { blockId, offset: nextOffset },
			});
			return;
		}

		if (event.inputType === "insertParagraph") {
			event.preventDefault();
			splitBlock(blockId, offset);
		}
	};

	useLayoutEffect(() => {
		applySelectionToDom(blocksRef.current, selection);
	}, [selection]);

	const firstBlockId = blocks[0]?.id;
	useLayoutEffect(() => {
		if (!autoFocus || !firstBlockId || selection || readOnly) return;

		setSelection({
			anchor: { blockId: firstBlockId, offset: 0 },
			focus: { blockId: firstBlockId, offset: 0 },
		});
	}, [autoFocus, firstBlockId, selection, readOnly, setSelection]);

	return (
		<div
			className={["mb-editor", className].filter(Boolean).join(" ")}
			style={style}
		>
			<div className="mb-editor__page">
				{blocks.map((block) => {
					const Block = block.type as BlockType;
					const showPlaceholder =
						Boolean(placeholder) &&
						blocks.length === 1 &&
						block.content.length === 0;
					return (
						<Block
							className="mb-block"
							onCompositionStart={() => {
								isComposingRef.current = true;
							}}
							onCompositionEnd={(event) => {
								isComposingRef.current = false;
								if (readOnly) return;
								const content = event.currentTarget.textContent ?? "";
								const shortcut = matchTextShortcut(content);

								if (shortcut) {
									changeBlockType(block.id, shortcut.type, "");
									setSlashMenu(null);
									return;
								}

								updateBlock(block.id, {
									content,
								});

								if (content === "/" || content.endsWith(" /")) {
									const { offsetHeight, offsetLeft, offsetTop } =
										event.currentTarget;

									setSlashMenu({
										blockId: block.id,
										activeIndex: 0,
										top: offsetTop + offsetHeight + 4,
										left: offsetLeft,
									});
								} else {
									setSlashMenu(null);
								}
								syncSelectionFromDom();
							}}
							data-block-type={block.type}
							data-placeholder={showPlaceholder ? placeholder : undefined}
							onMouseUp={syncSelectionFromDom}
							onKeyUp={(e) => {
								if (isComposingRef.current || e.nativeEvent.isComposing) return;
								syncSelectionFromDom();
							}}
							ref={(el: HTMLElement | null) => {
								if (el) {
									blocksRef.current.set(block.id, el);

									if (!el.dataset.beforeInputAttached) {
										el.dataset.beforeInputAttached = "true";
										el.addEventListener("beforeinput", (event) => {
											handleNativeBeforeInput(
												event,
												block.id,
												block.content,
												el,
											);
										});
									}

									if (
										!isComposingRef.current &&
										el.textContent !== block.content
									) {
										el.textContent = block.content;
									}
								} else {
									blocksRef.current.delete(block.id);
								}
							}}
							key={block.id}
							contentEditable={!readOnly}
							suppressContentEditableWarning
							// onBeforeInput={(event) => {
							// 	// Let's update editor state
							// 	if (readOnly) return;

							// 	const inputEvent = event.nativeEvent as InputEvent;
							// 	const inputType = inputEvent.inputType;
							// 	if (isComposingRef.current || inputEvent.isComposing) return;
							// 	if (isCompositionInput(inputType)) return;

							// 	const selection = window.getSelection();
							// 	const offset = getCollapsedOffsetInBlock(
							// 		event.currentTarget,
							// 		selection,
							// 	);
							// 	if (offset === null) return;

							// 	if (inputType === "insertText") {
							// 		const text = inputEvent.data;
							// 		if (!text) return;

							// 		event.preventDefault();
							// 		const nextContent = insertTextAt(block.content, offset, text);
							// 		const nextOffset = offset + text.length;

							// 		commitBlockContent(
							// 			block.id,
							// 			nextContent,
							// 			event.currentTarget,
							// 		);

							// 		// set collapsed selection
							// 		setSelection({
							// 			anchor: {
							// 				blockId: block.id,
							// 				offset: nextOffset,
							// 			},
							// 			focus: {
							// 				blockId: block.id,
							// 				offset: nextOffset,
							// 			},
							// 		});

							// 		return;
							// 	}

							// 	if (inputType === "insertParagraph") {
							// 		event.preventDefault();
							// 		splitBlock(block.id, offset);
							// 		return;
							// 	}
							// }}
							onInput={(event) => {
								return;
								if (readOnly) return;
								// if (isComposingRef.current || event.nativeEvent.isComposing)
								// 	return;
								const content = event.currentTarget.textContent ?? "";
								// match shortcut
								const shortcut = matchTextShortcut(content);

								if (shortcut) {
									changeBlockType(block.id, shortcut.type, "");
									setSlashMenu(null);
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
								if (readOnly) return;
								if (isComposingRef.current || event.nativeEvent.isComposing)
									return;
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
									if (isBeforeInputSupported()) return;
									event.preventDefault();

									const selection = window.getSelection();
									const offset = selection?.anchorOffset ?? 0;

									splitBlock(block.id, offset);
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

									isEmpty
										? deleteBlockBackward(block.id)
										: mergeBlockBackward(block.id);

									return;
								}

								if (event.key === "ArrowUp" || event.key === "ArrowDown") {
									event.preventDefault();

									const index = blocks.findIndex(
										(item) => item.id === block.id,
									);

									if (index === -1) return;

									const nextIndex =
										event.key === "ArrowUp" ? index - 1 : index + 1;
									const nextBlock = blocks[nextIndex];
									if (!nextBlock) return;

									const offset = getCaretOffset();
									setSelection({
										anchor: { blockId: nextBlock.id, offset },
										focus: { blockId: nextBlock.id, offset },
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
	const anchorTextNode = ensureTextNode(anchorBlockElement);
	const focusTextNode = ensureTextNode(focusBlockElement);
	if (!anchorTextNode || !focusTextNode) return;

	const anchorOffset = Math.min(
		editorSelection.anchor.offset,
		anchorTextNode.textContent?.length ?? 0,
	);
	const focusOffset = Math.min(
		editorSelection.focus.offset,
		focusTextNode.textContent?.length ?? 0,
	);

	const domSelection = document.getSelection();
	domSelection?.removeAllRanges();
	domSelection?.setBaseAndExtent(
		anchorTextNode,
		anchorOffset,
		focusTextNode,
		focusOffset,
	);
}

function ensureTextNode(element: HTMLElement): Text | null {
	let textNode = element.firstChild;

	if (!textNode) {
		textNode = document.createTextNode("");
		element.appendChild(textNode);
	}

	return textNode instanceof Text ? textNode : null;
}

function isSlashTrigger(content: string) {
	return content === "/" || content.endsWith(" /");
}

function isCompositionInput(inputType: string) {
	return (
		inputType === "insertCompositionText" ||
		inputType === "deleteCompositionText"
	);
}

function getCollapsedOffsetInBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
) {
	// Guard

	if (!selection?.isCollapsed) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;
	if (!isNodeInsideElement(blockElement, selection.anchorNode)) return null;
	if (!isNodeInsideElement(blockElement, selection.focusNode)) return null;

	const contentLength = blockElement.textContent?.length ?? 0;

	if (selection.anchorNode === blockElement) {
		return Math.max(0, Math.min(selection.anchorOffset, contentLength));
	}

	if (selection.anchorNode instanceof Text) {
		return Math.max(0, Math.min(selection.anchorOffset, contentLength));
	}

	return null;
}

function isNodeInsideElement(element: HTMLElement, node: Node) {
	if (node === element) return true;
	return element.contains(node);
}

function insertTextAt(content: string, offset: number, text: string) {
	const safeOffset = Math.max(0, Math.min(offset, content.length));
	return content.slice(0, safeOffset) + text + content.slice(safeOffset);
}

function isBeforeInputSupported() {
	return (
		typeof InputEvent !== "undefined" &&
		typeof InputEvent.prototype.getTargetRanges === "function"
	);
}
