import type {
	EditorSelection,
	EditorState,
	MiniBlockCore,
} from "@miniblock/core";
import type { EditorDomAdapter } from "@miniblock/dom";
import { createContext, useContext } from "react";

export interface BlockEditorStateContextType {
	selection: EditorSelection | null;
	blocks: EditorState["blocks"];
	readOnly: boolean;
}

export interface BlockEditorActionsContextType {
	editor: MiniBlockCore;
	dom: EditorDomAdapter;
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
