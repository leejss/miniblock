import type {
	BlockType,
	EditorSelection,
	EditorState,
	MiniBlockCore,
} from "@miniblock/core";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import {
	applySelectionToDom,
	getCaretOffsetWithinBlock,
	getCollapsedOffsetInBlock,
	getSelectionRangeInBlock,
	isSelectionEqual,
	readSelectionFromDom,
	type TextRange,
} from "./dom-selection";
import { matchTextShortcut } from "./shortcuts";
import "./styles.css";
import {
	BlockEditorActionsContext,
	BlockEditorStateContext,
	type KeyDownInterceptor,
} from "./context";
import { SlashMenu } from "./slash-menu";
import { useBlockEditor } from "./use-block-editor";

type InputIntent =
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
	placeholder?: string;
	className?: string;
	style?: CSSProperties;
};

export function BlockEditor({
	onChange,
	defaultValue,
	value,
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
	} = useBlockEditor({
		onChange,
		defaultValue,
		value,
	});

	const editorRootRef = useRef<HTMLDivElement | null>(null);
	const blocksRef = useRef(new Map<string, HTMLElement>());
	const isComposingRef = useRef(false);
	const prevSelectionRef = useRef<EditorSelection | null>(null);
	const beforeInputHandlerRef = useRef<(event: InputEvent) => void>(() => {});

	const interceptorsRef = useRef<Set<KeyDownInterceptor>>(new Set());

	const registerKeyDownInterceptor = useCallback(
		(interceptor: KeyDownInterceptor) => {
			interceptorsRef.current.add(interceptor);
			return () => {
				interceptorsRef.current.delete(interceptor);
			};
		},
		[],
	);

	const syncSelectionFromDom = useCallback(() => {
		setSelection(readSelectionFromDom(blocksRef.current));
	}, [setSelection]);

	const commitBlockContent = useCallback(
		(blockId: string, content: string) => {
			const shortcut = matchTextShortcut(content);
			if (shortcut) {
				changeBlockType(blockId, shortcut.type, "");
				// TODO:
				// maybe we can call like
				// updateBlock(blockId, {type: shortcut.type})
				return;
			}
			updateBlock(blockId, { content });
		},
		[changeBlockType, updateBlock],
	);

	const handleInputIntent = useCallback(
		(command: InputIntent) => {
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
				const shortcut = matchTextShortcut(nextContent);

				if (shortcut) {
					changeBlockType(command.blockId, shortcut.type, "");
					return;
				}

				editor.dispatch(
					{
						type: "insertText",
						payload: {
							blockId: command.blockId,
							offset: command.offset,
							text: command.text,
						},
					},
					{ history: "merge" },
				);
				return;
			}

			if (command.type === "splitBlock") {
				splitBlock(command.blockId, command.offset);
			}

			if (command.type === "deleteBackward") {
				const { start, end } = command.range;
				// Range Deletion
				if (start !== end) {
					editor.dispatch(
						{
							type: "deleteText",
							payload: {
								blockId: command.blockId,
								start,
								end,
							},
						},
						{ history: "merge" },
					);
					return;
				}

				// Character Deletion
				if (start > 0) {
					const nextOffset = start - 1;
					editor.dispatch(
						{
							type: "deleteText",
							payload: {
								blockId: command.blockId,
								start: nextOffset,
								end: start,
							},
						},
						{ history: "merge" },
					);
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
					editor.dispatch(
						{
							type: "deleteText",
							payload: {
								blockId: command.blockId,
								start,
								end,
							},
						},
						{ history: "merge" },
					);
					return;
				}

				if (start < block.content.length) {
					editor.dispatch(
						{
							type: "deleteText",
							payload: {
								blockId: command.blockId,
								start,
								end: start + 1,
							},
						},
						{ history: "merge" },
					);
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
			changeBlockType,
			editor,
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

			if (event.inputType === "historyUndo") {
				event.preventDefault();
				editor.undo();
				return;
			}

			if (event.inputType === "historyRedo") {
				event.preventDefault();
				editor.redo();
				return;
			}

			if (event.inputType === "insertText") {
				const offset = getCollapsedOffsetInBlock(blockElement, selection);
				if (offset === null) return;
				const text = event.data;
				if (!text) return;
				event.preventDefault();

				handleInputIntent({
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
				handleInputIntent({
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

				handleInputIntent({
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
				handleInputIntent({
					type: "deleteForward",
					blockId,
					range,
					blockElement,
				});
			}
		},
		[editor, handleInputIntent, readOnly],
	);

	const handleCompositionStart = useCallback(() => {
		isComposingRef.current = true;
	}, []);

	const handleCompositionEnd = useCallback(
		(event: React.CompositionEvent<HTMLDivElement>) => {
			isComposingRef.current = false;
			if (readOnly) return;

			const blockElement = findClosestBlockElement(event.target);
			if (!blockElement) return;

			const blockId = blockElement.dataset.blockId;
			if (!blockId) return;

			const content = blockElement.textContent ?? "";
			commitBlockContent(blockId, content);
			syncSelectionFromDom();
		},
		[commitBlockContent, readOnly, syncSelectionFromDom],
	);

	const handleInput = useCallback(
		(event: React.SyntheticEvent<HTMLDivElement>) => {
			if (readOnly) return;
			if (
				isComposingRef.current ||
				(event.nativeEvent as unknown as { isComposing?: boolean }).isComposing
			)
				return;

			const blockElement = findClosestBlockElement(event.target);
			if (!blockElement) return;

			const blockId = blockElement.dataset.blockId;
			if (!blockId) return;

			const content = blockElement.textContent ?? "";
			commitBlockContent(blockId, content);
			syncSelectionFromDom();
		},
		[commitBlockContent, readOnly, syncSelectionFromDom],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (readOnly) return;
			if (isComposingRef.current || event.nativeEvent.isComposing) return;

			const blockElement = findClosestBlockElement(event.target);
			if (!blockElement) return;

			const blockId = blockElement.dataset.blockId;
			if (!blockId) return;

			// 1. Run keydown interceptors in reverse order (LIFO)
			const interceptors = Array.from(interceptorsRef.current).reverse();
			for (const interceptor of interceptors) {
				if (interceptor(event, { blockId, blockElement })) {
					return;
				}
			}

			if (handleHistoryShortcut(event, editor)) return;

			if (
				handleBlockMutationKeys(event, blockId, blockElement, {
					splitBlock,
					deleteBlockBackward,
					mergeBlockBackward,
				})
			) {
				return;
			}

			handleCaretNavigation(event, blockId, blockElement, blocks, setSelection);
		},
		[
			readOnly,
			editor,
			splitBlock,
			deleteBlockBackward,
			mergeBlockBackward,
			blocks,
			setSelection,
		],
	);

	useLayoutEffect(() => {
		beforeInputHandlerRef.current = handleNativeBeforeInput;
	}, [handleNativeBeforeInput]);

	useLayoutEffect(() => {
		if (isComposingRef.current || !selection) {
			prevSelectionRef.current = selection;
			return;
		}

		const currentDomSelection = readSelectionFromDom(blocksRef.current);
		if (!isSelectionEqual(currentDomSelection, selection)) {
			applySelectionToDom(blocksRef.current, selection);
		}

		prevSelectionRef.current = selection;
	}, [selection]);
	// core selection이 바뀌면 DOM selection을 반영한다

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

	useEffect(() => {
		if (readOnly) return;

		const handleSelectionChange = () => {
			if (isComposingRef.current) return;
			const selection = window.getSelection();
			if (selection && editorRootRef.current?.contains(selection.anchorNode)) {
				syncSelectionFromDom();
			}
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
		};
	}, [readOnly, syncSelectionFromDom]);

	const stateValue = useMemo(
		() => ({ selection, blocks, readOnly: !!readOnly }),
		[selection, blocks, readOnly],
	);

	const actionsValue = useMemo(
		() => ({
			editor,
			blocksRef,
			registerKeyDownInterceptor,
		}),
		[editor, registerKeyDownInterceptor],
	);

	return (
		<BlockEditorStateContext.Provider value={stateValue}>
			<BlockEditorActionsContext.Provider value={actionsValue}>
				<div
					className={["mb-editor", className].filter(Boolean).join(" ")}
					style={style}
				>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: delegated event handler container */}
					<div
						ref={editorRootRef}
						className="mb-editor__page"
						onCompositionStart={handleCompositionStart}
						onCompositionEnd={handleCompositionEnd}
						onInput={handleInput}
						onKeyDown={handleKeyDown}
					>
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
								/>
							);
						})}
						<SlashMenu />
					</div>
				</div>
			</BlockEditorActionsContext.Provider>
		</BlockEditorStateContext.Provider>
	);
}

function handleHistoryShortcut(
	event: React.KeyboardEvent<HTMLDivElement>,
	editor: MiniBlockCore,
): boolean {
	const key = event.key.toLowerCase();
	const isModifierKey = event.metaKey || event.ctrlKey;
	const isUndoKey = isModifierKey && key === "z" && !event.shiftKey;
	const isRedoKey =
		isModifierKey && ((key === "z" && event.shiftKey) || key === "y");

	if (isUndoKey) {
		event.preventDefault();
		editor.undo();
		return true;
	}

	if (isRedoKey) {
		event.preventDefault();
		editor.redo();
		return true;
	}

	return false;
}

function handleBlockMutationKeys(
	event: React.KeyboardEvent<HTMLDivElement>,
	blockId: string,
	blockElement: HTMLElement,
	actions: {
		splitBlock: (blockId: string, offset: number) => void;
		deleteBlockBackward: (blockId: string) => void;
		mergeBlockBackward: (blockId: string) => void;
	},
): boolean {
	if (event.key === "Enter") {
		if (isBeforeInputSupported()) return false;
		event.preventDefault();

		const offset =
			getCollapsedOffsetInBlock(blockElement, window.getSelection()) ?? 0;

		actions.splitBlock(blockId, offset);
		return true;
	}

	if (event.key === "Backspace") {
		if (isBeforeInputSupported()) return false;
		const range = getSelectionRangeInBlock(blockElement, window.getSelection());
		const isAtStart = range?.start === 0 && range.end === 0;
		if (!isAtStart) return false;
		event.preventDefault();

		const isEmpty = (blockElement.textContent ?? "") === "";

		if (isEmpty) {
			actions.deleteBlockBackward(blockId);
		} else {
			actions.mergeBlockBackward(blockId);
		}

		return true;
	}

	return false;
}

function handleCaretNavigation(
	event: React.KeyboardEvent<HTMLDivElement>,
	blockId: string,
	blockElement: HTMLElement,
	blocks: EditorState["blocks"],
	setSelection: (selection: EditorSelection | null) => void,
): boolean {
	if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;

	event.preventDefault();

	const index = blocks.findIndex((item) => item.id === blockId);

	if (index === -1) return true;
	const idxCandidate = event.key === "ArrowUp" ? index - 1 : index + 1;
	// Handle Out of Bound.
	const nextIdx = Math.max(0, Math.min(idxCandidate, blocks.length - 1));
	const nextBlock = blocks[nextIdx];
	if (!nextBlock) return true;
	// Calculate offset
	const offset = getCaretOffsetWithinBlock(blockElement);
	// Move caret to next block.
	setSelection({
		anchor: { blockId: nextBlock.id, offset },
		focus: { blockId: nextBlock.id, offset },
	});

	return true;
}

function isCompositionInput(inputType: string) {
	return (
		inputType === "insertCompositionText" ||
		inputType === "deleteCompositionText"
	);
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

function findClosestBlockElement(target: EventTarget | null) {
	if (!(target instanceof Node)) return null;

	const element = target instanceof HTMLElement ? target : target.parentElement;
	return element?.closest<HTMLElement>("[data-block-id]") ?? null;
}
