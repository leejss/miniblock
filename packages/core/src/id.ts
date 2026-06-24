let fallbackId = 0;
export function createBlockId(): string {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}
	fallbackId += 1;
	return `block-${fallbackId}`;
}
