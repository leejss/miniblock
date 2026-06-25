export function isCompositionInput(inputType: string) {
	return (
		inputType === "insertCompositionText" ||
		inputType === "deleteCompositionText"
	);
}

export function isBeforeInputSupported() {
	return (
		typeof InputEvent !== "undefined" &&
		typeof InputEvent.prototype.getTargetRanges === "function"
	);
}
