import { type EditorState, MiniBlockCore } from "@miniblock/core";
import { useRef, useSyncExternalStore } from "react";

export type UseBlockEditorOptions = {
	defaultValue?: EditorState;
};

export function useBlockEditor(options: UseBlockEditorOptions = {}) {
	const editorRef = useRef<MiniBlockCore | null>(null);
	if (!editorRef.current) {
		editorRef.current = new MiniBlockCore(options.defaultValue);
	}

	const editor = editorRef.current;

	const storedSnapshot = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(onStoreChange),
		() => editor.getSnapshot(),
		() => editor.getSnapshot(),
	);

	const state = storedSnapshot.state;
	const selection = storedSnapshot.selection;

	return {
		editor,
		state,
		blocks: state.blocks,
		selection,
		replaceText: editor.replaceText.bind(editor),
		setSelection: editor.setSelection.bind(editor),
		updateBlock: editor.updateBlock.bind(editor),
		splitBlock: editor.splitBlock.bind(editor),
		mergeBlockBackward: editor.mergeBlockBackward.bind(editor),
		deleteBlockBackward: editor.deleteBlockBackward.bind(editor),
		changeBlockType: editor.changeBlockType.bind(editor),
		undo: editor.undo.bind(editor),
		redo: editor.redo.bind(editor),
	};
}
