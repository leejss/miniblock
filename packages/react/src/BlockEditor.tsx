import type { Block } from "@miniblock/core";
import type { JSX } from "react";
import { useBlockEditor } from "./useBlockEditor";

export type BlockEditorProps = {
	initialState: Block[];
};

export function BlockEditor({ initialState }: BlockEditorProps) {
	const { blocks, updateBlock } = useBlockEditor({ initialState });

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
					>
						{block.content}
					</Tag>
				);
			})}
		</div>
	);
}
