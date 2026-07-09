import { type EditorState, MiniBlockCore } from "@miniblock/core";
import { useMemo, useRef, useSyncExternalStore } from "react";

export type UseBlockEditorOptions = {
	defaultValue?: EditorState;
};

export function useBlockEditor(options: UseBlockEditorOptions = {}) {
	const editorRef = useRef<MiniBlockCore | null>(null);
	if (!editorRef.current) {
		editorRef.current = new MiniBlockCore(options.defaultValue);
	}
	const editor = editorRef.current;
	const actions = useMemo(
		() => ({
			replaceText: editor.replaceText.bind(editor),
			setSelection: editor.setSelection.bind(editor),
			updateBlock: editor.updateBlock.bind(editor),
			splitBlock: editor.splitBlock.bind(editor),
			mergeBlockBackward: editor.mergeBlockBackward.bind(editor),
			deleteBlockBackward: editor.deleteBlockBackward.bind(editor),
			changeBlockType: editor.changeBlockType.bind(editor),
			undo: editor.undo.bind(editor),
			redo: editor.redo.bind(editor),
		}),
		[editor],
	);
	const { state, selection } = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(onStoreChange),
		() => editor.getSnapshot(),
		() => editor.getSnapshot(),
	);

	return {
		editor,
		state,
		selection,
		blocks: state.blocks,
		...actions,
	};
}
