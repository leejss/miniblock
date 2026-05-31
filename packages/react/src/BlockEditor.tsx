import type { Block } from "@miniblock/core";
import type { JSX } from "react";
import { useBlockEditor } from "./useBlockEditor";

export type BlockEditorProps = {
	initialState: Block[];
};

export function BlockEditor({ initialState }: BlockEditorProps) {
	const { blocks, updateBlock, splitBlock } = useBlockEditor({ initialState });

	return (
		<div>
			{blocks.map((block) => {
				const Tag = block.type as keyof JSX.IntrinsicElements;

				return (
					<Tag
						key={block.id}
						contentEditable
						suppressContentEditableWarning
						onInput={(event) => {
							updateBlock(block.id, {
								content: event.currentTarget.textContent ?? "",
							});
						}}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;

							event.preventDefault();

							const selection = window.getSelection();
							const offset = selection?.anchorOffset ?? 0;

							splitBlock(block.id, offset);
						}}
					>
						{block.content}
					</Tag>
				);
			})}
		</div>
	);
}
