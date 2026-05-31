import { BlockEditor } from "@miniblock/react";
import type { Block } from "@miniblock/core";

const initialState: Block[] = [
	{
		id: "intro",
		type: "h1",
		content: "miniblock",
	},
	{
		id: "first",
		type: "p",
		content: "A lightweight block editor adapter running in React.",
	},
	{
		id: "second",
		type: "p",
		content: "Edit this text and split blocks with Enter.",
	},
];

export function App() {
	return (
		<main className="demo-shell">
			<section className="editor-surface" aria-label="miniblock editor demo">
				<BlockEditor initialState={initialState} />
			</section>
		</main>
	);
}
