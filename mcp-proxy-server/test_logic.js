const STYLE_SELECTION_TTL_MS = 24 * 60 * 60 * 1000;
const selectedState = { selectedAt: Date.now() };
const now = Date.now();
const isSelectionValid = selectedState && (now - selectedState.selectedAt <= STYLE_SELECTION_TTL_MS);

console.log("isSelectionValid:", isSelectionValid);
console.log("selectedState:", selectedState);
console.log("!isSelectionValid:", !isSelectionValid);
console.log("!selectedState:", !selectedState);
console.log("reason:", !selectedState ? 'A' : 'B');
