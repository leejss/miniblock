import type { BlockType, EditorState } from "@miniblock/core";
import {
	type CSSProperties,
	type ElementType,
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import { useBlockEditor } from "../hooks/use-block-editor";
import {
	BlockEditorActionsContext,
	BlockEditorStateContext,
} from "../hooks/use-block-editor-context";
import { useEditorInputEvents } from "../hooks/use-editor-input-events";
import "../styles.css";
import {
	applySelectionToDom,
	isSelectionEqual,
	readSelectionFromDom,
} from "../utils/dom-selection";
import { SlashMenu } from "./slash-menu";

export type BlockEditorProps = {
	defaultValue?: EditorState;
	readOnly?: boolean;
	placeholder?: string;
	className?: string;
	style?: CSSProperties;
};

export type BlockEditorHandle = {
	getState: () => EditorState;
};

const BLOCK_TAG_BY_TYPE: Record<BlockType, ElementType> = {
	paragraph: "p",
	heading1: "h1",
	heading2: "h2",
	heading3: "h3",
	quote: "blockquote",
	codeBlock: "pre",
	bulletedListItem: "div",
};

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(
	function BlockEditor(
		{ defaultValue, className, placeholder, readOnly, style },
		ref,
	) {
		const { editor, blocks, selection, setSelection } = useBlockEditor({
			defaultValue,
		});

		useImperativeHandle(
			ref,
			() => ({
				getState: () => editor.getState(),
			}),
			[editor],
		);

		const editorRootRef = useRef<HTMLDivElement | null>(null);
		const blocksRef = useRef(new Map<string, HTMLElement>());
		const isComposingRef = useRef(false);

		const syncSelectionFromDom = useCallback(() => {
			setSelection(readSelectionFromDom(blocksRef.current));
		}, [setSelection]);

		useLayoutEffect(() => {
			if (isComposingRef.current || !selection) return;

			const currentDomSelection = readSelectionFromDom(blocksRef.current);
			if (!isSelectionEqual(currentDomSelection, selection)) {
				applySelectionToDom(blocksRef.current, selection);
			}
		}, [selection]);

		useEffect(() => {
			if (readOnly) return;

			const handleSelectionChange = () => {
				if (isComposingRef.current) return;
				const domSelection = window.getSelection();
				if (
					domSelection &&
					editorRootRef.current?.contains(domSelection.anchorNode)
				) {
					syncSelectionFromDom();
				}
			};

			document.addEventListener("selectionchange", handleSelectionChange);
			return () => {
				document.removeEventListener("selectionchange", handleSelectionChange);
			};
		}, [readOnly, syncSelectionFromDom]);

		const {
			handleCompositionStart,
			handleCompositionEnd,
			handleInput,
			handleKeyDown,
			registerKeyDownInterceptor,
		} = useEditorInputEvents({
			editor,
			editorRootRef,
			isComposingRef,
			readOnly,
			syncSelectionFromDom,
		});

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
								const BlockTag = BLOCK_TAG_BY_TYPE[block.type];
								const indent = block.indent ?? 0;
								const blockStyle = {
									"--mb-indent-level": indent,
								} as CSSProperties;

								const showPlaceholder =
									Boolean(placeholder) &&
									blocks.length === 1 &&
									block.content.length === 0;
								return (
									<BlockTag
										key={block.id}
										data-block-id={block.id}
										data-block-type={block.type}
										data-indent={indent}
										data-placeholder={showPlaceholder ? placeholder : undefined}
										contentEditable={!readOnly}
										suppressContentEditableWarning
										className="mb-block"
										style={blockStyle}
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
	},
);

BlockEditor.displayName = "BlockEditor";
