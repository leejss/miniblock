import {
	type EditorSnapshot,
	type EditorState,
	MiniBlockCore,
} from "@miniblock/core";
import { createStore, type StoreApi } from "zustand/vanilla";

export type BlockEditorStoreState = {
	editor: MiniBlockCore;
	snapshot: EditorSnapshot;
};

export type BlockEditorStoreApi = StoreApi<BlockEditorStoreState>;

export type BlockEditorStoreController = {
	store: BlockEditorStoreApi;
	connect: () => void;
	dispose: () => void;
};

export function createBlockEditorStore(
	defaultValue?: EditorState,
): BlockEditorStoreController {
	const editor = new MiniBlockCore(defaultValue);
	const store = createStore<BlockEditorStoreState>()(() => ({
		editor,
		snapshot: editor.getSnapshot(),
	}));
	let unsubscribe: (() => void) | null = null;

	const syncSnapshot = () => {
		const snapshot = editor.getSnapshot();
		if (store.getState().snapshot !== snapshot) {
			store.setState({ snapshot });
		}
	};

	const connect = () => {
		if (unsubscribe) return;

		unsubscribe = editor.subscribe(syncSnapshot);
		syncSnapshot();
	};

	const dispose = () => {
		unsubscribe?.();
		unsubscribe = null;
	};

	connect();

	return { store, connect, dispose };
}
