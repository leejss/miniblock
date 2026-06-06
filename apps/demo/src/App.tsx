import type { Block } from "@miniblock/core";
import { BlockEditor } from "@miniblock/react";
import { useState } from "react";

const initialBlocks: Block[] = [
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
	const [blocks, setBlocks] = useState(initialBlocks);
	return (
		<main className="demo-shell">
			<section className="editor-surface" aria-label="miniblock editor demo">
				<BlockEditor initialBlocks={initialBlocks} onChange={setBlocks} />
			</section>
			<aside className="state-panel" aria-label="editor state">
				<pre>{JSON.stringify(blocks, null, 2)}</pre>
			</aside>
		</main>
	);
}
