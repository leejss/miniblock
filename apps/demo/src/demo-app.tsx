import type { EditorState } from "@miniblock/core";
import { BlockEditor } from "@miniblock/react";
import { useEffect, useState } from "react";

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
			content:
				"Type '/' to trigger the slash commands. Edit content and split blocks with Enter.",
		},
		{
			id: "quote-example",
			type: "blockquote",
			content:
				"Capture highlights, callouts or notes in this cozy styled blockquote.",
		},
		{
			id: "code-example",
			type: "pre",
			content:
				"// Linear-inspired code block\nconst greeting = 'Hello, Miniblock!';\nconsole.log(greeting);",
		},
	],
};

export function App() {
	const [state, setState] = useState(initialState);
	const [theme, setTheme] = useState<"dark" | "light">("dark");

	// Synchronize the body class for the outer demo shell styling
	useEffect(() => {
		if (theme === "light") {
			document.body.classList.add("demo-light");
		} else {
			document.body.classList.remove("demo-light");
		}
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prev) => (prev === "dark" ? "light" : "dark"));
	};

	return (
		<div className="demo-shell">
			<div className="theme-toggle-container">
				<button
					type="button"
					className="theme-toggle-btn"
					onClick={toggleTheme}
				>
					{theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
				</button>
			</div>

			<div className="editor-wrapper">
				<BlockEditor
					value={state}
					onChange={setState}
					className={theme === "light" ? "mb-editor--light" : ""}
					placeholder="Press '/' for commands..."
				/>
			</div>
		</div>
	);
}
