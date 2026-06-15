import { type EditorState, MiniBlockCore } from "@miniblock/core";
import { useEffect, useRef, useSyncExternalStore } from "react";
export type UseBlockEditorOptions = {
	initialState: EditorState;
	onChange?: (state: EditorState) => void;
};
export function useBlockEditor(options: UseBlockEditorOptions) {
	const editorRef = useRef<MiniBlockCore | null>(null);
	if (!editorRef.current) {
		editorRef.current = new MiniBlockCore(options.initialState);
	}

	const editor = editorRef.current;

	const state = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(() => onStoreChange()),
		() => editor.getState(),
		() => editor.getState(),
	);

	useEffect(() => {
		options.onChange?.(state);
	}, [state, options.onChange]);

	return {
		editor,
		state,
		blocks: state.blocks,
		selection: state.selection,
		setSelection: editor.setSelection.bind(editor),
		updateBlock: editor.updateBlock.bind(editor),
		splitBlock: editor.splitBlock.bind(editor),
		mergeBlockBackward: editor.mergeBlockBackward.bind(editor),
		deleteBlockBackward: editor.deleteBlockBackward.bind(editor),
		changeBlockType: editor.changeBlockType.bind(editor),
	};
}
