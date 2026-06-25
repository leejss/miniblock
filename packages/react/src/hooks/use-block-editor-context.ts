import type {
	EditorSelection,
	EditorState,
	MiniBlockCore,
} from "@miniblock/core";
import { createContext, type RefObject, useContext } from "react";

import type { KeyboardInputInfo } from "../editor-engine/editor-input-engine";

export type KeyDownInterceptorContext = {
	blockId: string;
	blockElement: HTMLElement;
};

export type KeyDownInterceptor = (
	info: KeyboardInputInfo,
	context: KeyDownInterceptorContext,
) => boolean;

export interface BlockEditorStateContextType {
	selection: EditorSelection | null;
	blocks: EditorState["blocks"];
	readOnly: boolean;
}

export interface BlockEditorActionsContextType {
	editor: MiniBlockCore;
	blocksRef: RefObject<Map<string, HTMLElement>>;
	registerKeyDownInterceptor: (interceptor: KeyDownInterceptor) => () => void;
}

export const BlockEditorStateContext =
	createContext<BlockEditorStateContextType | null>(null);
export const BlockEditorActionsContext =
	createContext<BlockEditorActionsContextType | null>(null);

export function useBlockEditorState() {
	const context = useContext(BlockEditorStateContext);
	if (!context) {
		throw new Error(
			"useBlockEditorState must be used within a BlockEditorProvider",
		);
	}
	return context;
}

export function useBlockEditorActions() {
	const context = useContext(BlockEditorActionsContext);
	if (!context) {
		throw new Error(
			"useBlockEditorActions must be used within a BlockEditorProvider",
		);
	}
	return context;
}
