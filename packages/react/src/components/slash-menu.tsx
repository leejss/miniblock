import type { BlockType } from "@miniblock/core";
import type { EditorDomAdapter } from "@miniblock/dom";
import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useSlashMenu } from "../hooks/use-slash-menu";
import type { BlockEditorStoreApi } from "../stores/block-editor-store";
import { matchSlashTrigger } from "../utils/slash-trigger";

const COMMAND_ICONS: Record<BlockType, React.ReactNode> = {
	paragraph: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<line x1="21" y1="6" x2="3" y2="6" />
			<line x1="21" y1="12" x2="9" y2="12" />
			<line x1="21" y1="18" x2="3" y2="18" />
		</svg>
	),
	heading1: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 12h6M4 6v12M10 6v12M15 8h2v10M14 18h4" />
		</svg>
	),
	heading2: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 12h6M4 6v12M10 6v12M14 9a2.5 2.5 0 0 1 5 0c0 2-3 3-5 5h5" />
		</svg>
	),
	heading3: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 12h6M4 6v12M10 6v12M14 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2.5-2.5 2.5 1 0 2.5 1 2.5 2.5a2.5 2.5 0 0 1-5 0" />
		</svg>
	),
	quote: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v4c0 1.25.75 2 2 2h3c0 4-2 6-4 6M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v4c0 1.25.75 2 2 2h3c0 4-2 6-4 6" />
		</svg>
	),
	codeBlock: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	),
	bulletedListItem: (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
		</svg>
	),
};

type SlashMenuProps = {
	store: BlockEditorStoreApi;
	dom: EditorDomAdapter;
	readOnly: boolean;
};

export function SlashMenu({ store, dom, readOnly }: SlashMenuProps) {
	const selection = useStore(
		store,
		(storeState) => storeState.snapshot.selection,
	);
	const blocks = useStore(
		store,
		(storeState) => storeState.snapshot.state.blocks,
	);
	const editor = useStore(store, (storeState) => storeState.editor);
	const changeBlockType = useMemo(
		() => editor.changeBlockType.bind(editor),
		[editor],
	);

	const {
		menuState: slashMenu,
		filteredCommands,
		openMenu,
		closeMenu,
		selectItem: selectSlashItem,
		handleKeyDown: handleSlashKeyDown,
	} = useSlashMenu(changeBlockType);

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

		const layout = dom.getBlockLayout(blockId);
		if (layout) {
			openMenu(blockId, triggerMatch.query, layout);
		} else {
			closeMenu();
		}
	}, [selection, blocks, openMenu, closeMenu, readOnly, dom]);

	useEffect(() => {
		if (!slashMenu) return;

		const unregister = dom.registerKeyDownInterceptor((event, context) => {
			if (context.blockId !== slashMenu.blockId) {
				return false;
			}

			const blockContent =
				blocks.find((block) => block.id === context.blockId)?.content ?? "";
			return handleSlashKeyDown(event, blockContent);
		});

		return unregister;
	}, [slashMenu, blocks, handleSlashKeyDown, dom]);

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
						const blockContent =
							blocks.find((block) => block.id === slashMenu.blockId)?.content ??
							"";
						selectSlashItem(item.type, blockContent);
					}}
				>
					<span className="mb-slash-menu__item-icon">
						{COMMAND_ICONS[item.type]}
					</span>
					<span className="mb-slash-menu__item-content">
						<span className="mb-slash-menu__item-label">{item.label}</span>
						<span className="mb-slash-menu__item-description">
							{item.description}
						</span>
					</span>
					{item.shortcut && (
						<kbd className="mb-slash-menu__item-shortcut">{item.shortcut}</kbd>
					)}
				</button>
			))}
		</div>
	);
}
