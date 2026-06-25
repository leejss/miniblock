export function findClosestBlockElement(target: EventTarget | null) {
	if (!(target instanceof Node)) return null;

	const element = target instanceof HTMLElement ? target : target.parentElement;
	return element?.closest<HTMLElement>("[data-block-id]") ?? null;
}
