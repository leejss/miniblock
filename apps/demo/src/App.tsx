import type { EditorState } from "@miniblock/core";
import { BlockEditor } from "@miniblock/react";
import { useState } from "react";

const initialState: EditorState = {
	schemaVersion: 1,
	blocks: [
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
	],
	selection: null,
};

export function App() {
	const [state, setState] = useState(initialState);

	return (
		<main className="demo-shell">
			<section className="editor-surface" aria-label="miniblock editor demo">
				<BlockEditor value={state} onChange={setState} />
			</section>
			<aside className="state-panel" aria-label="editor state">
				<pre>{JSON.stringify(state, null, 2)}</pre>
			</aside>
		</main>
	);
}
