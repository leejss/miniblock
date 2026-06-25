import type { EditorSelection } from "@miniblock/core";
import { type RefObject, useCallback, useEffect, useLayoutEffect } from "react";
import {
	applySelectionToDom,
	isSelectionEqual,
	readSelectionFromDom,
} from "../utils/dom-selection";

type UseEditorSelectionSyncOptions = {
	blocksRef: RefObject<Map<string, HTMLElement>>;
	editorRootRef: RefObject<HTMLDivElement | null>;
	isComposingRef: RefObject<boolean>;
	readOnly?: boolean;
	selection: EditorSelection | null;
	setSelection: (selection: EditorSelection | null) => void;
};

export function useEditorSelectionSync({
	blocksRef,
	editorRootRef,
	isComposingRef,
	readOnly,
	selection,
	setSelection,
}: UseEditorSelectionSyncOptions) {
	const syncSelectionFromDom = useCallback(() => {
		setSelection(readSelectionFromDom(blocksRef.current));
	}, [blocksRef, setSelection]);

	useLayoutEffect(() => {
		if (isComposingRef.current || !selection) return;

		const currentDomSelection = readSelectionFromDom(blocksRef.current);
		if (!isSelectionEqual(currentDomSelection, selection)) {
			applySelectionToDom(blocksRef.current, selection);
		}
	}, [blocksRef, isComposingRef, selection]);

	useEffect(() => {
		if (readOnly) return;

		const handleSelectionChange = () => {
			if (isComposingRef.current) return;
			const selection = window.getSelection();
			if (selection && editorRootRef.current?.contains(selection.anchorNode)) {
				syncSelectionFromDom();
			}
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
		};
	}, [editorRootRef, isComposingRef, readOnly, syncSelectionFromDom]);

	return { syncSelectionFromDom };
}
