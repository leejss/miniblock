import type { EditorState } from "@miniblock/core";
import { EditorDomAdapter } from "@miniblock/dom";
import {
	type CSSProperties,
	forwardRef,
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
import "../styles.css";
import { EditorBlock } from "./editor-block";
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

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(
	function BlockEditor(
		{ defaultValue, className, placeholder, readOnly, style },
		ref,
	) {
		const { editor, blocks, selection } = useBlockEditor({
			defaultValue,
		});
		const domAdapterRef = useRef<EditorDomAdapter | null>(null);
		if (!domAdapterRef.current) {
			domAdapterRef.current = new EditorDomAdapter(editor, { readOnly });
		}
		const dom = domAdapterRef.current;
		const editorRootRef = useRef<HTMLDivElement | null>(null);

		useImperativeHandle(
			ref,
			() => ({
				getState: () => editor.getState(),
			}),
			[editor],
		);

		useLayoutEffect(() => {
			const root = editorRootRef.current;
			if (!root) return;

			dom.connect(root);
			return () => dom.disconnect();
		}, [dom]);

		useLayoutEffect(() => {
			dom.setReadOnly(!!readOnly);
		}, [dom, readOnly]);

		// Core selection changes are the signal to apply the latest snapshot after render.
		// biome-ignore lint/correctness/useExhaustiveDependencies: selection intentionally triggers this DOM synchronization
		useLayoutEffect(() => {
			dom.syncSelectionToDom();
		}, [dom, selection]);

		const stateValue = useMemo(
			() => ({ selection, blocks, readOnly: !!readOnly }),
			[selection, blocks, readOnly],
		);

		const actionsValue = useMemo(
			() => ({
				editor,
				dom,
			}),
			[editor, dom],
		);

		return (
			<BlockEditorStateContext.Provider value={stateValue}>
				<BlockEditorActionsContext.Provider value={actionsValue}>
					<div
						className={["mb-editor", className].filter(Boolean).join(" ")}
						style={style}
					>
						<div ref={editorRootRef} className="mb-editor__page">
							{blocks.map((block) => {
								const showPlaceholder =
									Boolean(placeholder) &&
									blocks.length === 1 &&
									block.content.length === 0;
								return (
									<EditorBlock
										key={block.id}
										block={block}
										dom={dom}
										readOnly={!!readOnly}
										placeholder={showPlaceholder ? placeholder : undefined}
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
