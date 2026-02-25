const STYLE_SELECTION_TTL_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

function testCase(selectedState, desc) {
    const isSelectionValid = selectedState && (now - selectedState.selectedAt <= STYLE_SELECTION_TTL_MS);
    let reason = '';
    if (!isSelectionValid) {
        reason = !selectedState
            ? 'A (선행되어야 합니다)'
            : 'B (만료되어 다시 확인)';
    } else {
        reason = 'VALID (통과)';
    }
    console.log(`[${desc}] -> Result: ${reason}`);
}

testCase(undefined, "Case 1: No selectedState");
testCase({ selectedAt: now - 1000 }, "Case 2: Valid selectedState (1s ago)");
testCase({ selectedAt: now - (25 * 60 * 60 * 1000) }, "Case 3: Expired selectedState (25h ago)");
testCase({ selectedAt: undefined }, "Case 4: selectedAt is undefined");
testCase({ selectedAt: NaN }, "Case 5: selectedAt is NaN");
