import type { BlockType, EditorState } from "@miniblock/core";
import { type CSSProperties, type ElementType, useMemo, useRef } from "react";
import { useBlockEditor } from "../hooks/use-block-editor";
import {
	BlockEditorActionsContext,
	BlockEditorStateContext,
} from "../hooks/use-block-editor-context";
import { useEditorInputEvents } from "../hooks/use-editor-input-events";
import { useEditorSelectionSync } from "../hooks/use-editor-selection-sync";
import "../styles.css";
import { SlashMenu } from "./slash-menu";

export type BlockEditorProps = {
	value?: EditorState;
	defaultValue?: EditorState;
	onChange?: (state: EditorState) => void;
	readOnly?: boolean;
	placeholder?: string;
	className?: string;
	style?: CSSProperties;
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

export function BlockEditor({
	onChange,
	defaultValue,
	value,
	className,
	placeholder,
	readOnly,
	style,
}: BlockEditorProps) {
	const { editor, blocks, selection, setSelection } = useBlockEditor({
		onChange,
		defaultValue,
		value,
	});

	const editorRootRef = useRef<HTMLDivElement | null>(null);
	const blocksRef = useRef(new Map<string, HTMLElement>());
	const isComposingRef = useRef(false);
	const { syncSelectionFromDom } = useEditorSelectionSync({
		blocksRef,
		editorRootRef,
		isComposingRef,
		readOnly,
		selection,
		setSelection,
	});

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
}
