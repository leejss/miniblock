import {
	type EditorSelection,
	type EditorState,
	MiniBlockCore,
} from "@miniblock/core";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
} from "react";

export type UseBlockEditorOptions = {
	value?: EditorState;
	defaultValue?: EditorState;
	selection?: EditorSelection | null;
	defaultSelection?: EditorSelection | null;
	onChange?: (state: EditorState) => void;
	onSelectionChange?: (selection: EditorSelection | null) => void;
};

export function useBlockEditor(options: UseBlockEditorOptions) {
	const isControlled = options.value !== undefined;
	const isSelectionControlled = options.selection !== undefined;
	const editorRef = useRef<MiniBlockCore | null>(null);
	if (!editorRef.current) {
		editorRef.current = new MiniBlockCore(
			options.value ?? options.defaultValue,
			options.selection ?? options.defaultSelection,
		);
	}

	const editor = editorRef.current;

	const storedSnapshot = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(() => onStoreChange()),
		() => editor.getSnapshot(),
		() => editor.getSnapshot(),
	);

	const state = options.value ?? storedSnapshot.state;
	const selection = isSelectionControlled
		? (options.selection ?? null)
		: storedSnapshot.runtime.selection;

	useLayoutEffect(() => {
		if (!isControlled || !options.value) return;
		editor.setState(options.value, { emit: false });
	}, [isControlled, options.value, editor]);

	useLayoutEffect(() => {
		if (!isSelectionControlled) return;
		editor.setSelection(options.selection ?? null, { emit: false });
	}, [isSelectionControlled, options.selection, editor]);

	useEffect(() => {
		return editor.subscribe((snapshot, change) => {
			if (change.stateChanged) {
				options.onChange?.(snapshot.state);
			}
			if (change.selectionChanged) {
				options.onSelectionChange?.(snapshot.runtime.selection);
			}
		});
	}, [options.onChange, options.onSelectionChange, editor]);

	return {
		editor,
		state,
		blocks: state.blocks,
		selection,
		dispatch: editor.dispatch.bind(editor),
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
