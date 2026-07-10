import type { Block, BlockType } from "@miniblock/core";
import type { EditorDomAdapter } from "@miniblock/dom";
import {
	type CSSProperties,
	type ElementType,
	useCallback,
	useLayoutEffect,
	useRef,
} from "react";

type EditorBlockProps = {
	block: Block;
	dom: EditorDomAdapter;
	readOnly: boolean;
	placeholder?: string;
};

const BLOCK_TAG_BY_TYPE: Record<BlockType, ElementType> = {
	paragraph: "p",
	heading1: "h1",
	heading2: "h2",
	heading3: "h3",
	quote: "blockquote",
	codeBlock: "pre",
	bulletedListItem: "div",
};

export function EditorBlock({
	block,
	dom,
	readOnly,
	placeholder,
}: EditorBlockProps) {
	const elementRef = useRef<HTMLElement | null>(null);
	const contentRef = useRef(block.content);
	contentRef.current = block.content;
	const setElement = useCallback(
		(element: HTMLElement | null) => {
			elementRef.current = element;
			dom.setBlockElement(block.id, element);
			if (element) {
				dom.syncBlockContent(block.id, contentRef.current);
			}
		},
		[block.id, dom],
	);

	useLayoutEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		dom.setBlockElement(block.id, element);
		return () => dom.setBlockElement(block.id, null);
	}, [block.id, dom]);

	useLayoutEffect(() => {
		if (elementRef.current) {
			dom.syncBlockContent(block.id, block.content);
		}
	}, [block.id, block.content, dom]);

	const BlockTag = BLOCK_TAG_BY_TYPE[block.type];
	const indent = block.indent ?? 0;
	const style = { "--mb-indent-level": indent } as CSSProperties;

	return (
		<BlockTag
			data-block-id={block.id}
			data-block-type={block.type}
			data-indent={indent}
			data-placeholder={placeholder}
			contentEditable={!readOnly}
			suppressContentEditableWarning
			className="mb-block"
			style={style}
			ref={setElement}
		/>
	);
}
