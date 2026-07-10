import type { EditorState } from "@miniblock/core";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import {
	type BlockEditorStoreApi,
	type BlockEditorStoreController,
	createBlockEditorStore,
} from "../stores/block-editor-store";

export type UseBlockEditorOptions = {
	defaultValue?: EditorState;
};

export function useBlockEditorStoreApi(
	options: UseBlockEditorOptions = {},
): BlockEditorStoreApi {
	const controllerRef = useRef<BlockEditorStoreController | null>(null);
	if (!controllerRef.current) {
		controllerRef.current = createBlockEditorStore(options.defaultValue);
	}
	const controller = controllerRef.current;

	useEffect(() => {
		controller.connect();
		return () => controller.dispose();
	}, [controller]);

	return controller.store;
}

export function useBlockEditor(options: UseBlockEditorOptions = {}) {
	const store = useBlockEditorStoreApi(options);
	const editor = useStore(store, (storeState) => storeState.editor);
	const snapshot = useStore(store, (storeState) => storeState.snapshot);
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
	const { state, selection } = snapshot;

	return {
		editor,
		state,
		selection,
		blocks: state.blocks,
		...actions,
	};
}
