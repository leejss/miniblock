import type { MiniBlockCore } from "@miniblock/core";
import { type RefObject, useCallback, useLayoutEffect, useMemo } from "react";
import {
	applyInputIntent,
	EditorInputEngine,
	getInputIntent,
} from "../editor-engine/editor-input-engine";
import type { KeyDownInterceptor } from "./use-block-editor-context";

type UseEditorInputEventsOptions = {
	editor: MiniBlockCore;
	editorRootRef: RefObject<HTMLDivElement | null>;
	isComposingRef: RefObject<boolean>;
	readOnly?: boolean;
	syncSelectionFromDom: () => void;
};

export function useEditorInputEvents({
	editor,
	editorRootRef,
	isComposingRef,
	readOnly,
	syncSelectionFromDom,
}: UseEditorInputEventsOptions) {
	const engine = useMemo(() => {
		return new EditorInputEngine({
			editor,
			readOnly,
			syncSelectionFromDom,
		});
	}, [editor, readOnly, syncSelectionFromDom]);

	// Delegate React component events to native handlers in engine
	const handleCompositionStart = useCallback(() => {
		engine.handleCompositionStart();
		isComposingRef.current = engine.getIsComposing();
	}, [engine, isComposingRef]);

	const handleCompositionEnd = useCallback(
		(event: React.CompositionEvent<HTMLDivElement>) => {
			engine.handleCompositionEnd({
				target: event.target,
				isComposing: false,
			});
			isComposingRef.current = engine.getIsComposing();
		},
		[engine, isComposingRef],
	);

	const handleInput = useCallback(
		(event: React.SyntheticEvent<HTMLDivElement>) => {
			const nativeEvent = event.nativeEvent as unknown as {
				isComposing?: boolean;
			};
			engine.handleInput({
				target: event.target,
				isComposing: !!nativeEvent.isComposing,
			});
		},
		[engine],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			engine.handleKeyDown({
				key: event.key,
				metaKey: event.metaKey,
				ctrlKey: event.ctrlKey,
				shiftKey: event.shiftKey,
				isComposing: event.nativeEvent.isComposing,
				target: event.target,
				preventDefault: () => event.preventDefault(),
			});
		},
		[engine],
	);

	const registerKeyDownInterceptor = useCallback(
		(interceptor: KeyDownInterceptor) => {
			return engine.registerKeyDownInterceptor(interceptor);
		},
		[engine],
	);

	// Bind native beforeinput listener to the editor root DOM element
	useLayoutEffect(() => {
		const root = editorRootRef.current;
		if (!root) return;

		const listener = (event: InputEvent) => {
			const intent = getInputIntent({
				event,
				isComposing: isComposingRef.current || event.isComposing,
				readOnly,
			});
			if (!intent) return;
			event.preventDefault();
			applyInputIntent(editor, intent);
		};

		root.addEventListener("beforeinput", listener);
		return () => {
			root.removeEventListener("beforeinput", listener);
		};
	}, [editorRootRef, editor, isComposingRef, readOnly]);

	return {
		handleCompositionStart,
		handleCompositionEnd,
		handleInput,
		handleKeyDown,
		registerKeyDownInterceptor,
	};
}
