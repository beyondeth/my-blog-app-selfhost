
// Mocking the generateSlug function from backend/src/posts/utils/post.utils.ts
// to avoid complexity with running the actual backend environment in this script context.
// This validates the LOGIC that is now being used.

function generateSlug(title: string, createdAt?: Date): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
  const now = createdAt || new Date();
  const date = now.toISOString().split("T")[0];
  const timestamp = now.getTime().toString().slice(-6);
  return `${date}-${baseSlug}-${timestamp}`;
}

const testCases = [
  "Hello World",
  "This is a very long title that should be truncated because it exceeds the eighty character limit set in the function",
  "안녕하세요 이것은 한글 제목입니다",
  "Mixed English and 한글 title with 123 numbers!",
  "Special !@#$%^&*() Characters",
  "   Trim Me   ",
];

console.log("=== SEO Slug Generation Verification ===\n");

testCases.forEach(title => {
    const slug = generateSlug(title);
    console.log(`Title: "${title}"`);
    console.log(`Slug:  "${slug}"`);
    console.log("-".repeat(50));
});
