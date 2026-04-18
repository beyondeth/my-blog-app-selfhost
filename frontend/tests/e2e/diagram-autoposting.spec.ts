import { expect, test } from "@playwright/test";

test.describe("diagram autoposting previews", () => {
  test("renders the sample page through the actual content renderer path", async ({
    page,
  }) => {
    await page.goto("/sample");

    await page.getByRole("button", { name: "실제 렌더 경로" }).click();

    const pipelinePreview = page.locator('[data-sample-pipeline-preview="true"]');
    await expect(pipelinePreview).toBeVisible();

    const diagram = pipelinePreview.locator("[data-diagram-id]").first();
    await expect(diagram).toBeVisible();
    await expect(diagram.locator("svg").first()).toBeVisible();
    await expect(page.getByText("diagram block 렌더링 실패")).toHaveCount(0);
  });

  test("renders the diagram playground comparison cards", async ({ page }) => {
    await page.goto("/d2");

    await expect(
      page.getByText("Mermaid vs D2 vs custom diagram block"),
    ).toBeVisible();
    await expect(page.locator("[data-mermaid-id]").first()).toBeVisible();
    await expect(page.locator("[data-diagram-id]").first()).toBeVisible();
    await expect(page.getByText("diagram block 렌더링 실패")).toHaveCount(0);
  });

  test("opens the zoom modal for diagram blocks in the actual content renderer path", async ({
    page,
  }) => {
    await page.goto("/sample");

    await page.getByRole("button", { name: "실제 렌더 경로" }).click();

    const pipelinePreview = page.locator('[data-sample-pipeline-preview="true"]');
    await expect(pipelinePreview).toBeVisible();

    const diagram = pipelinePreview.locator("[data-diagram-id]").first();
    await expect(diagram).toBeVisible();
    await pipelinePreview
      .locator('button[aria-label="다이어그램 확대 보기"]')
      .first()
      .click();

    await expect(page.getByTitle("확대")).toBeVisible();
    await expect(page.getByText("드래그로 이동")).toBeVisible();
  });
});
