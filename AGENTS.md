# BlockEditor Learning Project Guidelines

Welcome! This is a **from-scratch learning project** designed to implement a high-fidelity Notion-style block editor.

The goal is to understand how block editors operate under the hood by slowly building up capabilities (such as block splitting, merging, commands, selection context, and document state databases) step-by-step.

---

## 🏗️ Architectural Guidelines & Rules

All agents and developers working on this codebase **MUST ALWAYS** follow these guidelines:

### 1. No Custom Logic in `index.html`
* `index.html` must remain strictly a **visual shell and DOM mountpoint**.
* Do **NOT** add custom JavaScript classes, event listeners, caret splitting algorithms, or floating dropdown commands inside `index.html`.
* The only JavaScript allowed in `index.html` is the core initialization script:
  ```html
  <script type="module">
    import { BlockEditor } from './src/main.ts';
    new BlockEditor('app');
  </script>
  ```

### 2. Slow Build-up Inside `src/main.ts`
* All rich editing behaviors must be designed, engineered, and integrated **directly within the `BlockEditor` class in `src/main.ts`** (or through imported TypeScript modules inside `src/`).
* Target features to slowly implement inside `src/main.ts`:
  * **Enter key block-splitting**: Intercept `Enter`, extract text after caret, insert new block in state, and shift focus.
  * **Backspace key block-merging**: Intercept `Backspace` at caret position 0, merge content up, and delete current block.
  * **Arrow key navigation**: Enable arrow-key traversal between blocks.
  * **Slash command menu (`/`)**: Detect `/` input, render option selectors, and transform block types.
  * **Persistent Storage**: Save document states and configuration in `localStorage`.

### 3. Separation of Concerns
* Keep the beautiful styling classes in `src/style.css` so that the editor canvas, sidebars, headers, blocks, and overlays are visually outstanding.
* Only manipulate the DOM through standard, class-driven rendering cycles inside `BlockEditor`.
