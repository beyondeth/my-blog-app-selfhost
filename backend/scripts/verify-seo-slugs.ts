import { generateSlug } from "../src/posts/utils/post.utils";
import { UrlSanitizerUtil } from "../src/common/utils/url-sanitizer.util";

const testCases = [
  "Hello World",
  "테스트 제목",
  "안녕하세요",
  "Mixed 한글 & English",
  "", // Empty string test
];

console.log("=== Real Module Verification ===\n");

testCases.forEach(title => {
    // Mimic the service logic
    const sanitized = UrlSanitizerUtil.sanitizeDisplayText(title, 500);
    const slug = generateSlug(sanitized);
    
    console.log(`Original:  "${title}"`);
    console.log(`Sanitized: "${sanitized}"`);
    console.log(`Slug:      "${slug}"`);
    console.log("-".repeat(50));
});
