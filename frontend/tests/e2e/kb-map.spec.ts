import { expect, test, type Locator } from "@playwright/test";

function decodeFocus(url: string) {
  return decodeURIComponent(new URL(url).searchParams.get("focus") ?? "");
}

function decodeDetail(url: string) {
  return decodeURIComponent(new URL(url).searchParams.get("detail") ?? "");
}

function decodePathname(url: string) {
  return decodeURIComponent(new URL(url).pathname);
}

function readViewParam(url: string) {
  return new URL(url).searchParams.get("view");
}

function readPanelParam(url: string) {
  return new URL(url).searchParams.get("panel");
}

async function getBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    throw new Error("Expected visible bounding box");
  }

  return box;
}

test.describe("knowledge map", () => {
  test("renders the d2 map with the structure rail by default and keeps node clicks in structure mode", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=정책-분석");

    await expect(page.locator("[data-d2-view]")).toBeVisible();
    await expect(page.locator("[data-map-view]")).toHaveCount(0);
    await expect(page.locator('[data-sidebar-view-tab="knowledge"][data-state="active"]')).toBeVisible();
    await expect(page.locator('[data-sidebar-view-tab="categories"][data-state="inactive"]')).toBeVisible();
    await expect(page.locator("[data-tree-panel]")).toBeVisible();
    await expect(page.locator("[data-tree-node]").first()).toBeVisible();
    await expect(page.locator('[data-tree-node="정책-분석"]')).toBeVisible();
    await expect(page.locator('[data-sidebar-tab="structure"]')).toHaveCount(0);
    await expect(page.locator('[data-sidebar-tab="detail"]')).toHaveCount(0);
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();

    const currentActiveSlug = "정책-분석";
    const targetSlug = await page
      .locator("[data-d2-view] [data-flow-nav]")
      .evaluateAll((elements, activeFocus) => {
        const target = elements.find(
          (element) =>
            element instanceof HTMLElement &&
            element.dataset.flowNav &&
            element.dataset.flowNav !== activeFocus &&
            (() => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom > 0 &&
                rect.right > 0 &&
                rect.top < window.innerHeight &&
                rect.left < window.innerWidth
              );
            })(),
        ) as HTMLElement | undefined;

        return target?.dataset.flowNav ?? null;
      }, currentActiveSlug);

    expect(targetSlug).toBeTruthy();
    await page.locator(`[data-flow-nav="${targetSlug}"]`).first().click();

    await expect
      .poll(() => decodeFocus(page.url()))
      .toBe(targetSlug);
    await expect
      .poll(() => decodeDetail(page.url()))
      .toBe("");
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();
    await expect(page.locator("[data-map-detail-panel]")).toHaveCount(0);
    await expect
      .poll(() => readViewParam(page.url()))
      .toBeNull();
  });

  test("lets the right structure rail change map focus without leaving structure mode", async ({ page }) => {
    await page.goto("/@park1818/kb/map?focus=정책-분석");

    await expect(page.locator("[data-d2-view]")).toBeVisible();

    const activeFocus = decodeFocus(page.url()) || "정책-분석";
    const targetSlug = await page
      .locator('[data-tree-nav][data-tree-node-type="leaf"]')
      .evaluateAll((elements, currentSlug) => {
        const target = elements.find(
          (element) =>
            element instanceof HTMLElement &&
            element.dataset.treeNav &&
            element.dataset.treeNav !== currentSlug,
        ) as HTMLElement | undefined;

        return target?.dataset.treeNav ?? null;
      }, activeFocus);

    expect(targetSlug).toBeTruthy();
    await page.locator(`[data-tree-nav="${targetSlug}"]`).first().click();

    await expect
      .poll(() => decodeFocus(page.url()))
      .toBe(targetSlug);
    await expect
      .poll(() => decodeDetail(page.url()))
      .toBe("");
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();
    await expect(page.locator("[data-map-detail-panel]")).toHaveCount(0);
  });

  test("switches to the category tab and navigates to the filtered blog home", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=기타");

    await page.locator('[data-sidebar-view-tab="categories"]').click();
    await expect(page.locator('[data-sidebar-view-tab="categories"][data-state="active"]')).toBeVisible();
    await expect(page.locator("[data-map-category-panel]")).toBeVisible();

    const targetCategory = await page
      .locator("[data-map-category-panel] [data-category-path]")
      .first()
      .getAttribute("data-category-path");

    expect(targetCategory).toBeTruthy();
    await page.locator(`[data-category-path="${targetCategory}"]`).first().click();

    await expect
      .poll(() => decodePathname(page.url()))
      .toBe("/@park1818");
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).searchParams.get("category") ?? ""))
      .toBe(targetCategory);
  });

  test("shows the same category and knowledge tabs inside the mobile drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/@park1818/kb/map?focus=기타");

    await page.getByRole("button", { name: "구조 보기" }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.locator('[data-sidebar-view-tab="knowledge"][data-state="active"]'),
    ).toBeVisible();
    await expect(drawer.locator("[data-tree-panel]")).toBeVisible();

    await drawer.locator('[data-sidebar-view-tab="categories"]').click();
    await expect(
      drawer.locator('[data-sidebar-view-tab="categories"][data-state="active"]'),
    ).toBeVisible();
    await expect(drawer.locator("[data-map-category-panel]")).toBeVisible();
  });

  test("normalizes invalid focus and strips legacy detail, panel, and view query params", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=backend&detail=정책-분석&panel=detail&view=flow");

    await expect(page.locator("[data-d2-view]")).toBeVisible();
    await expect
      .poll(() => decodeFocus(page.url()) !== "backend")
      .toBe(true);
    await expect
      .poll(() => decodeDetail(page.url()))
      .toBe("");
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();
    await expect
      .poll(() => readViewParam(page.url()))
      .toBeNull();

    const resolvedFocus = decodeFocus(page.url());
    const navigationTargets = page.locator("[data-d2-view] [data-flow-nav]");
    await expect(navigationTargets.first()).toBeVisible();

    const targetSlug = await navigationTargets.evaluateAll((elements, activeFocus) => {
      const target = elements.find(
        (element) =>
          element instanceof HTMLElement &&
          element.dataset.flowNav &&
          element.dataset.flowNav !== activeFocus,
      ) as HTMLElement | undefined;

      return target?.dataset.flowNav ?? null;
    }, resolvedFocus);

    expect(targetSlug).toBeTruthy();
    await page.locator(`[data-flow-nav="${targetSlug}"]`).first().click();

    await expect
      .poll(() => decodeFocus(page.url()))
      .toBe(targetSlug);
    await expect
      .poll(() => decodeDetail(page.url()))
      .toBe("");
    await expect
      .poll(() => readViewParam(page.url()))
      .toBeNull();
  });

  test("redirects the legacy tree route to the map entry", async ({ page }) => {
    await page.goto("/@park1818/kb");

    await expect
      .poll(() => decodePathname(page.url()))
      .toBe("/@park1818/kb/map");
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();
    await expect(page.locator("[data-d2-view]")).toBeVisible();
  });

  test("redirects the legacy node route to focused map structure", async ({ page }) => {
    await page.goto("/@park1818/kb/정책-분석");

    await expect
      .poll(() => decodePathname(page.url()))
      .toBe("/@park1818/kb/map");
    await expect
      .poll(() => decodeFocus(page.url()))
      .toBe("정책-분석");
    await expect
      .poll(() => decodeDetail(page.url()))
      .toBe("");
    await expect
      .poll(() => readPanelParam(page.url()))
      .toBeNull();
    await expect(page.locator("[data-map-detail-panel]")).toHaveCount(0);
  });

  test("removes detail affordances and keeps the kb experience structure-only", async ({ page }) => {
    await page.goto("/@park1818/kb/map?focus=정책-분석");

    await expect(page.locator("[data-d2-view]")).toBeVisible();
    await expect(page.getByRole("link", { name: "블로그 홈" })).toHaveCount(0);
    await expect(page.getByText("블로그 홈 > 지식 지도")).toHaveCount(0);
    await expect(page.getByText("대표 포스트").first()).toBeVisible();
    await expect(page.getByText("관련 포스트")).toHaveCount(0);
    await expect(page.getByText("Truth-First Knowledge Canvas")).toHaveCount(0);
    await expect(page.getByText("주제 상세")).toHaveCount(0);
    await expect(page.getByText("현재 주제")).toHaveCount(0);
    await expect(page.getByText("근거")).toHaveCount(0);
    await expect(page.getByText("상세")).toHaveCount(0);
    await expect(page.getByText("전체 주제 구조")).toHaveCount(0);
    await expect(page.getByText(/개 주제$/)).toHaveCount(0);
    await expect(page.getByText(/나머지 .*분류 보기/)).toHaveCount(0);
    await expect(page.locator("[data-flow-detail]")).toHaveCount(0);
    await expect(page.locator("[data-tree-detail]")).toHaveCount(0);
    await expect(page.locator("[data-map-detail-panel]")).toHaveCount(0);
    await expect(page.locator('[data-sidebar-tab="structure"]')).toHaveCount(0);
    await expect(page.locator('[data-sidebar-tab="detail"]')).toHaveCount(0);
  });

  test("replaces the evidence badge with an inline expand toggle in d2 view", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=경험-축약");

    const panel = page.locator('[data-d2-panel-id="root-path"]');
    const toggle = panel.locator("[data-evidence-toggle]");
    const postLinks = panel.locator("[data-flow-post]");

    await expect(panel).toBeVisible();
    await expect(postLinks).toHaveCount(2);
    await expect(panel.getByText("+1")).toHaveCount(0);
    await expect(toggle).toHaveText("1개 더 보기");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();

    await expect(postLinks).toHaveCount(3);
    await expect(toggle).toHaveText("접기");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.click();

    await expect(postLinks).toHaveCount(2);
    await expect(toggle).toHaveText("1개 더 보기");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("renders a single right-lane panel as a centered stacked column in d2 view", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=경험-축약");

    const d2View = page.locator("[data-d2-view]");
    const stack = page.locator("[data-d2-stack]");

    await expect(d2View).toHaveAttribute("data-d2-layout", "stacked");
    await expect(page.locator('[data-d2-connector="single"]')).toBeVisible();
    await expect(page.locator('[data-d2-connector="split"]')).toHaveCount(0);
    await expect(stack).toBeVisible();
    await expect(page.locator('[data-d2-panel-id="root-path"]')).toBeVisible();

    const [viewBox, stackBox] = await Promise.all([getBox(d2View), getBox(stack)]);
    const viewCenterX = viewBox.x + viewBox.width / 2;
    const stackCenterX = stackBox.x + stackBox.width / 2;

    expect(Math.abs(stackCenterX - viewCenterX)).toBeLessThan(32);
  });

  test("keeps a single child branch in the same centered stacked layout in d2 view", async ({
    page,
  }) => {
    await page.goto("/@park1818/kb/map?focus=문화");

    const d2View = page.locator("[data-d2-view]");
    const stack = page.locator("[data-d2-stack]");

    await expect(d2View).toHaveAttribute("data-d2-layout", "stacked");
    await expect(page.locator('[data-d2-connector="single"]')).toBeVisible();
    await expect(page.locator('[data-d2-connector="split"]')).toHaveCount(0);
    await expect(page.locator("[data-d2-column]")).toHaveCount(0);
    await expect(page.locator('[data-d2-panel-id="children"]')).toBeVisible();

    const [viewBox, stackBox] = await Promise.all([getBox(d2View), getBox(stack)]);
    const viewCenterX = viewBox.x + viewBox.width / 2;
    const stackCenterX = stackBox.x + stackBox.width / 2;

    expect(Math.abs(stackCenterX - viewCenterX)).toBeLessThan(32);
  });
});
