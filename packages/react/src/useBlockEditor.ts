import { type EditorState, MiniBlockCore } from "@miniblock/core";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useSyncExternalStore,
} from "react";

export type UseBlockEditorOptions = {
	value?: EditorState;
	defaultValue?: EditorState;
	onChange?: (state: EditorState) => void;
};

export function useBlockEditor(options: UseBlockEditorOptions) {
	const isControlled = options.value !== undefined;
	const editorRef = useRef<MiniBlockCore | null>(null);
	if (!editorRef.current) {
		editorRef.current = new MiniBlockCore(
			options.value ?? options.defaultValue,
		);
	}

	const editor = editorRef.current;

	const storedState = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(() => onStoreChange()),
		() => editor.getState(),
		() => editor.getState(),
	);

	const state = isControlled ? options.value! : storedState;

	useLayoutEffect(() => {
		if (!isControlled || !options.value) return;
		editor.setState(options.value, { emit: false });
	}, [isControlled, options.value, editor]);

	useEffect(() => {
		return editor.subscribe((nextState) => {
			options.onChange?.(nextState);
		});
	}, [options.onChange, editor]);

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
