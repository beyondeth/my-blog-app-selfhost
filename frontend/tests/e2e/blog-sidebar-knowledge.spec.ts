import { expect, test } from "@playwright/test";

function decodePathname(url: string) {
  return decodeURIComponent(new URL(url).pathname);
}

test.describe("blog sidebar knowledge tabs", () => {
  test("switches from categories to knowledge and opens the map view", async ({ page }) => {
    await page.goto("/@park1818");

    await expect(
      page.locator('[data-sidebar-view-tab="categories"][data-state="active"]'),
    ).toBeVisible();
    await expect(page.locator('[data-blog-sidebar-panel="categories"]')).toBeVisible();
    await expect(
      page.locator('[data-sidebar-view-tab="knowledge"][data-state="inactive"]'),
    ).toBeVisible();

    await page.locator('[data-sidebar-view-tab="knowledge"]').click();

    await expect(
      page.locator('[data-sidebar-view-tab="knowledge"][data-state="active"]'),
    ).toBeVisible();
    await expect(page.locator('[data-blog-sidebar-panel="knowledge"]')).toBeVisible();

    const openKnowledgeMapLink = page
      .locator('[data-blog-sidebar-panel="knowledge"]')
      .getByRole("link", { name: "지식 지도 열기" });

    await expect(openKnowledgeMapLink).toBeVisible();
    await openKnowledgeMapLink.click();

    await expect
      .poll(() => decodePathname(page.url()))
      .toBe("/@park1818/kb/map");
  });
});
