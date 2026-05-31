import { type Block, MiniBlockCore } from "@miniblock/core";
import { useEffect, useMemo, useSyncExternalStore } from "react";
export type UseBlockEditorOptions = {
	initialState: Block[];
	onChange?: (blocks: Block[]) => void;
};
export function useBlockEditor(options: UseBlockEditorOptions) {
	const editor = useMemo(() => {
		return new MiniBlockCore(options.initialState);
	}, [options.initialState]);

	const blocks = useSyncExternalStore(
		(onStoreChange) => editor.subscribe(() => onStoreChange()),
		() => editor.getBlocks(),
		() => editor.getBlocks(),
	);

	useEffect(() => {
		options.onChange?.(blocks);
	}, [blocks, options.onChange]);

	return {
		editor,
		blocks,
		// meaning of bind:
		updateBlock: editor.updateBlock.bind(editor),
		insertBlockAfter: editor.insertBlockAfter.bind(editor),
		deleteBlock: editor.deleteBlock.bind(editor),
		splitBlock: editor.splitBlock.bind(editor),
		mergeBlockBackward: editor.mergeBlockBackward.bind(editor),
		deleteBlockBackward: editor.deleteBlockBackward.bind(editor),
	};
}
