import type { BlockType } from "@miniblock/core";
import { useCallback, useState } from "react";
import { blockCommands } from "./commands";

export type SlashMenuState = {
	blockId: string;
	activeIndex: number;
	query: string;
	top: number;
	left: number;
};

export function useSlashMenu(
	changeBlockType: (id: string, type: BlockType, content: string) => void,
) {
	const [menuState, setMenuState] = useState<SlashMenuState | null>(null);

	const filteredCommands = menuState
		? blockCommands.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
					cmd.type.toLowerCase().includes(menuState.query.toLowerCase()),
			)
		: [];

	const openMenu = useCallback(
		(blockId: string, query: string, element: HTMLElement) => {
			const { offsetHeight, offsetLeft, offsetTop } = element;
			setMenuState((prev) => {
				const prevActiveIndex =
					prev?.blockId === blockId ? prev.activeIndex : 0;

				const currentFilteredCommands = blockCommands.filter(
					(cmd) =>
						cmd.label.toLowerCase().includes(query.toLowerCase()) ||
						cmd.type.toLowerCase().includes(query.toLowerCase()),
				);
				const nextActiveIndex =
					currentFilteredCommands.length > 0
						? prevActiveIndex >= currentFilteredCommands.length
							? 0
							: prevActiveIndex
						: 0;

				return {
					blockId,
					activeIndex: nextActiveIndex,
					query,
					top: offsetTop + offsetHeight + 4,
					left: offsetLeft,
				};
			});
		},
		[],
	);

	const closeMenu = useCallback(() => {
		setMenuState(null);
	}, []);

	const selectItem = useCallback(
		(type: BlockType, blockElement: HTMLElement | null) => {
			if (!menuState) return;
			const content = blockElement?.textContent ?? "";

			// 입력된 텍스트 중 슬래시 트리거 및 쿼리 부분을 제거합니다.
			// 예: " /h1" -> " ", "/h1" -> "", "/h" -> ""
			const escapedQuery = menuState.query.replace(
				/[.*+?^${}()|[\]\\]/g,
				"\\$&",
			);
			const regex = new RegExp(`( |\\b)/${escapedQuery}$|/${escapedQuery}$`);
			const nextContent = content.replace(regex, "");

			changeBlockType(menuState.blockId, type, nextContent);
			closeMenu();
		},
		[menuState, changeBlockType, closeMenu],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent, blockElement: HTMLElement | null) => {
			if (!menuState) return false;

			const moveActive = (direction: 1 | -1) => {
				setMenuState((prev) => {
					if (!prev) return null;
					const commandCount = filteredCommands.length;

					return {
						...prev,
						activeIndex:
							commandCount > 0
								? (prev.activeIndex + direction + commandCount) % commandCount
								: 0,
					};
				});
			};

			const handlers: Record<string, () => void> = {
				ArrowDown: () => moveActive(1),
				ArrowUp: () => moveActive(-1),
				Enter: () => {
					const activeCommand = filteredCommands[menuState.activeIndex];

					if (activeCommand) {
						selectItem(activeCommand.type, blockElement);
					}
				},
				Escape: closeMenu,
			};

			const handler = handlers[event.key];

			if (!handler) return false;

			event.preventDefault();
			handler();

			return true;
		},
		[menuState, filteredCommands, selectItem, closeMenu],
	);

	return {
		menuState,
		filteredCommands,
		openMenu,
		closeMenu,
		selectItem,
		handleKeyDown,
	};
}
