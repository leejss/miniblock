import { useEffect } from "react";
import { useBlockEditorActions, useBlockEditorState } from "./context";
import { useSlashMenu } from "./use-slash-menu";
import { matchSlashTrigger } from "./utils";

export function SlashMenu() {
	const { selection, blocks, readOnly } = useBlockEditorState();
	const { editor, blocksRef, registerKeyDownInterceptor } =
		useBlockEditorActions();

	const {
		menuState: slashMenu,
		filteredCommands,
		openMenu,
		closeMenu,
		selectItem: selectSlashItem,
		handleKeyDown: handleSlashKeyDown,
	} = useSlashMenu(editor.changeBlockType.bind(editor));

	useEffect(() => {
		if (readOnly) {
			closeMenu();
			return;
		}

		if (!selection) {
			closeMenu();
			return;
		}

		const isCollapsed =
			selection.anchor.blockId === selection.focus.blockId &&
			selection.anchor.offset === selection.focus.offset;

		if (!isCollapsed) {
			closeMenu();
			return;
		}

		const { blockId, offset } = selection.focus;
		const block = blocks.find((b) => b.id === blockId);
		if (!block) {
			closeMenu();
			return;
		}

		const triggerMatch = matchSlashTrigger(block.content, offset);
		if (!triggerMatch) {
			closeMenu();
			return;
		}

		const element = blocksRef.current?.get(blockId);
		if (element) {
			openMenu(blockId, triggerMatch.query, element);
		} else {
			closeMenu();
		}
	}, [selection, blocks, openMenu, closeMenu, readOnly, blocksRef]);

	useEffect(() => {
		if (!slashMenu) return;

		const unregister = registerKeyDownInterceptor((event, context) => {
			if (context.blockId !== slashMenu.blockId) {
				return false;
			}

			return handleSlashKeyDown(event, context.blockElement);
		});

		return unregister;
	}, [slashMenu, handleSlashKeyDown, registerKeyDownInterceptor, blocksRef]);

	if (!slashMenu || filteredCommands.length === 0) {
		return null;
	}

	return (
		<div
			className="mb-slash-menu"
			style={{ top: slashMenu.top, left: slashMenu.left }}
		>
			{filteredCommands.map((item, index) => (
				<button
					key={item.type}
					type="button"
					className={index === slashMenu.activeIndex ? "active" : ""}
					onMouseDown={(event) => {
						event.preventDefault();
						selectSlashItem(
							item.type,
							blocksRef.current?.get(slashMenu.blockId) ?? null,
						);
					}}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}
