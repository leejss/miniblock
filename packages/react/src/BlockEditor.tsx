import type { BlockType, EditorSelection, EditorState } from "@miniblock/core";
import {
	type CSSProperties,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
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

type TextRange = {
	start: number;
	end: number;
};

type BeforeInputCommand =
	| {
			type: "insertText";
			blockId: string;
			offset: number;
			text: string;
			blockElement: HTMLElement;
	  }
	| {
			type: "splitBlock";
			blockId: string;
			offset: number;
	  }
	| {
			type: "deleteBackward";
			blockId: string;
			range: TextRange;
			blockElement: HTMLElement;
	  }
	| {
			type: "deleteForward";
			blockId: string;
			range: TextRange;
			blockElement: HTMLElement;
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
		editor,
		blocks,
		selection,
		updateBlock,
		splitBlock,
		mergeBlockBackward,
		deleteBlockBackward,
		changeBlockType,
		setSelection,
	} = useBlockEditor({ onChange, defaultValue, value });

	const editorRootRef = useRef<HTMLDivElement | null>(null);
	const blocksRef = useRef(new Map<string, HTMLElement>());
	const isComposingRef = useRef(false);
	const beforeInputHandlerRef = useRef<(event: InputEvent) => void>(() => {});
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
	const commitBlockContent = useCallback(
		(blockId: string, content: string, element: HTMLElement) => {
			const shortcut = matchTextShortcut(content);
			if (shortcut) {
				changeBlockType(blockId, shortcut.type, "");
				// TODO:
				// maybe we can call like
				// updateBlock(blockId, {type: shortcut.type})
				setSlashMenu(null);
				return;
			}
			updateBlock(blockId, { content });
			if (isSlashTrigger(content)) {
				const { offsetHeight, offsetLeft, offsetTop } = element;
				setSlashMenu({
					blockId,
					activeIndex: 0,
					top: offsetTop + offsetHeight + 4,
					left: offsetLeft,
				});
				return;
			} else {
				setSlashMenu(null);
			}
		},
		[changeBlockType, updateBlock],
	);

	const dispatchBeforeInputCommand = useCallback(
		(command: BeforeInputCommand) => {
			const blocks = editor.getBlocks();
			const block = blocks.find((block) => block.id === command.blockId);
			if (!block) return;

			// insertText
			if (command.type === "insertText") {
				const nextContent = insertTextAt(
					block.content,
					command.offset,
					command.text,
				);
				const nextOffset = command.offset + command.text.length;
				commitBlockContent(command.blockId, nextContent, command.blockElement);
				setSelection({
					anchor: { blockId: command.blockId, offset: nextOffset },
					focus: { blockId: command.blockId, offset: nextOffset },
				});
				return;
			}

			if (command.type === "splitBlock") {
				splitBlock(command.blockId, command.offset);
			}

			if (command.type === "deleteBackward") {
				const { start, end } = command.range;
				// Range Deletion
				if (start !== end) {
					const nextContent = deleteTextRange(block.content, start, end);
					commitBlockContent(
						command.blockId,
						nextContent,
						command.blockElement,
					);
					setSelection({
						anchor: { blockId: command.blockId, offset: start },
						focus: { blockId: command.blockId, offset: start },
					});
					return;
				}

				// Character Deletion
				if (start > 0) {
					const nextOffset = start - 1;
					const nextContent = deleteTextRange(block.content, nextOffset, start);
					commitBlockContent(
						command.blockId,
						nextContent,
						command.blockElement,
					);
					setSelection({
						anchor: { blockId: command.blockId, offset: nextOffset },
						focus: { blockId: command.blockId, offset: nextOffset },
					});
					return;
				}

				// Block Deletion
				if (block.content.length === 0) {
					deleteBlockBackward(command.blockId);
				} else {
					mergeBlockBackward(command.blockId);
				}

				return;
			}

			if (command.type === "deleteForward") {
				const { start, end } = command.range;

				if (start !== end) {
					const nextContent = deleteTextRange(block.content, start, end);
					commitBlockContent(
						command.blockId,
						nextContent,
						command.blockElement,
					);
					setSelection({
						anchor: { blockId: command.blockId, offset: start },
						focus: { blockId: command.blockId, offset: start },
					});
					return;
				}

				if (start < block.content.length) {
					const nextContent = deleteTextRange(block.content, start, start + 1);
					commitBlockContent(
						command.blockId,
						nextContent,
						command.blockElement,
					);
					setSelection({
						anchor: { blockId: command.blockId, offset: start },
						focus: { blockId: command.blockId, offset: start },
					});
					return;
				}

				const blockIndex = blocks.findIndex(
					(block) => block.id === command.blockId,
				);
				const nextBlock = blocks[blockIndex + 1];
				if (!nextBlock) return;

				mergeBlockBackward(nextBlock.id);
				return;
			}
		},
		[
			commitBlockContent,
			editor,
			setSelection,
			splitBlock,
			deleteBlockBackward,
			mergeBlockBackward,
		],
	);

	const handleNativeBeforeInput = useCallback(
		(event: InputEvent) => {
			if (readOnly) return;
			if (isComposingRef.current || event.isComposing) return;
			if (isCompositionInput(event.inputType)) return;

			const blockElement = findClosestBlockElement(event.target);
			if (!blockElement) return;

			const blockId = blockElement.dataset.blockId;
			if (!blockId) return;

			const selection = window.getSelection();

			if (event.inputType === "insertText") {
				const offset = getCollapsedOffsetInBlock(blockElement, selection);
				if (offset === null) return;
				const text = event.data;
				if (!text) return;
				event.preventDefault();

				dispatchBeforeInputCommand({
					type: "insertText",
					blockId,
					offset,
					text,
					blockElement,
				});

				return;
			}

			if (event.inputType === "insertParagraph") {
				const offset = getCollapsedOffsetInBlock(blockElement, selection);
				if (offset === null) return;
				event.preventDefault();
				dispatchBeforeInputCommand({
					type: "splitBlock",
					blockId,
					offset,
				});
				return;
			}

			if (event.inputType === "deleteContentBackward") {
				const range = getSelectionRangeInBlock(blockElement, selection);
				if (!range) return;
				event.preventDefault();

				dispatchBeforeInputCommand({
					type: "deleteBackward",
					blockId,
					range,
					blockElement,
				});

				return;
			}
			if (event.inputType === "deleteContentForward") {
				const range = getSelectionRangeInBlock(blockElement, selection);
				if (!range) return;
				event.preventDefault();
				dispatchBeforeInputCommand({
					type: "deleteForward",
					blockId,
					range,
					blockElement,
				});
			}
		},
		[dispatchBeforeInputCommand, readOnly],
	);

	useLayoutEffect(() => {
		beforeInputHandlerRef.current = handleNativeBeforeInput;
	}, [handleNativeBeforeInput]);

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

	useLayoutEffect(() => {
		const root = editorRootRef.current;
		if (!root) return;

		const listener = (event: Event) => {
			beforeInputHandlerRef.current(event as InputEvent);
		};

		root.addEventListener("beforeinput", listener);

		return () => {
			root.removeEventListener("beforeinput", listener);
		};
	}, []);

	return (
		<div
			className={["mb-editor", className].filter(Boolean).join(" ")}
			style={style}
		>
			<div ref={editorRootRef} className="mb-editor__page">
				{blocks.map((block) => {
					const Block = block.type as BlockType;
					const showPlaceholder =
						Boolean(placeholder) &&
						blocks.length === 1 &&
						block.content.length === 0;

					return (
						<Block
							key={block.id}
							data-block-id={block.id}
							data-block-type={block.type}
							data-placeholder={showPlaceholder ? placeholder : undefined}
							contentEditable={!readOnly}
							suppressContentEditableWarning
							className="mb-block"
							ref={(el: HTMLElement | null) => {
								if (el) {
									blocksRef.current.set(block.id, el);
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
							onCompositionStart={() => {
								isComposingRef.current = true;
							}}
							onCompositionEnd={(event) => {
								isComposingRef.current = false;
								if (readOnly) return;
								const content = event.currentTarget.textContent ?? "";
								commitBlockContent(block.id, content, event.currentTarget);
								syncSelectionFromDom();
							}}
							onMouseUp={syncSelectionFromDom}
							onKeyUp={(e) => {
								if (isComposingRef.current || e.nativeEvent.isComposing) return;
								syncSelectionFromDom();
							}}
							onInput={(event) => {
								if (readOnly) return;
								if (isComposingRef.current || event.nativeEvent.isComposing)
									return;

								const content = event.currentTarget.textContent ?? "";
								commitBlockContent(block.id, content, event.currentTarget);
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
									if (isBeforeInputSupported()) return;
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
	const range = getSelectionRangeInBlock(blockElement, selection);
	if (!range || range.start !== range.end) return null;
	return range.start;
}

function isNodeInsideElement(element: HTMLElement, node: Node) {
	if (node === element) return true;
	return element.contains(node);
}

function insertTextAt(content: string, offset: number, text: string) {
	const safeOffset = Math.max(0, Math.min(offset, content.length));
	return content.slice(0, safeOffset) + text + content.slice(safeOffset);
}

function deleteTextRange(content: string, start: number, end: number) {
	const safeStart = Math.max(0, Math.min(start, content.length));
	const safeEnd = Math.max(safeStart, Math.min(end, content.length));
	return content.slice(0, safeStart) + content.slice(safeEnd);
}

function isBeforeInputSupported() {
	return (
		typeof InputEvent !== "undefined" &&
		typeof InputEvent.prototype.getTargetRanges === "function"
	);
}

function findClosestBlockElement(target: EventTarget | null) {
	if (!(target instanceof Node)) return null;

	const element = target instanceof HTMLElement ? target : target.parentElement;
	return element?.closest<HTMLElement>("[data-block-id]") ?? null;
}

function getSelectionRangeInBlock(
	blockElement: HTMLElement,
	selection: Selection | null,
): TextRange | null {
	if (!selection || selection.rangeCount === 0) return null;
	if (!selection.anchorNode || !selection.focusNode) return null;
	if (!isNodeInsideElement(blockElement, selection.anchorNode)) return null;
	if (!isNodeInsideElement(blockElement, selection.focusNode)) return null;

	const anchorOffset = getDomPointOffsetInBlock(
		blockElement,
		selection.anchorNode,
		selection.anchorOffset,
	);

	const focusOffset = getDomPointOffsetInBlock(
		blockElement,
		selection.focusNode,
		selection.focusOffset,
	);

	if (anchorOffset === null || focusOffset === null) return null;

	return {
		start: Math.min(anchorOffset, focusOffset),
		end: Math.max(anchorOffset, focusOffset),
	};
}

function getDomPointOffsetInBlock(
	blockElement: HTMLElement,
	node: Node,
	offset: number,
) {
	const range = document.createRange();
	range.selectNodeContents(blockElement);

	try {
		range.setEnd(node, offset);
		const contentLength = blockElement.textContent?.length ?? 0;
		return Math.max(0, Math.min(range.toString().length, contentLength));
	} catch {
		return null;
	}
}
