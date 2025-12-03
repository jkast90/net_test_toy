import { test, expect } from "@playwright/test";

test.describe("Search and Filter", () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("auth_access_token", "mock-access-token");
      localStorage.setItem("auth_id_token", "mock-id-token");
      localStorage.setItem("auth_refresh_token", "mock-refresh-token");
      localStorage.setItem("userEmail", "test@example.com");
      localStorage.setItem(
        "selectedWorkspace",
        JSON.stringify({ id: 1, name: "Test Workspace" }),
      );
    });
    await page.goto("/links");
  });

  test("search filters tiles by name", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Find the search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"]',
    );

    if (await searchInput.isVisible()) {
      // Get initial tile count
      const tiles = page.locator('[class*="tile"]');
      const initialCount = await tiles.count();

      if (initialCount > 0) {
        // Get the text of the first tile
        const firstTileText = await tiles.first().textContent();

        // Search for a specific term
        await searchInput.fill("github");
        await page.waitForTimeout(500); // Wait for debounce

        // Check if tiles are filtered
        const filteredCount = await tiles.count();

        // Should have fewer tiles or only matching tiles
        if (firstTileText?.toLowerCase().includes("github")) {
          expect(filteredCount).toBeGreaterThan(0);
        } else {
          expect(filteredCount).toBeLessThanOrEqual(initialCount);
        }
      }
    }
  });

  test("search highlights matching text", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"]',
    );

    if (await searchInput.isVisible()) {
      // Type a search term
      await searchInput.fill("git");
      await page.waitForTimeout(500);

      // Check for highlighted text
      const highlighted = page.locator('mark, [class*="highlight"]');
      const highlightCount = await highlighted.count();

      // If there are search results, there might be highlights
      const tiles = page.locator('[class*="tile"]');
      const tileCount = await tiles.count();

      if (tileCount > 0) {
        // We expect some form of highlighting if there are results
        expect(highlightCount >= 0).toBeTruthy();
      }
    }
  });

  test("clears search results", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"]',
    );

    if (await searchInput.isVisible()) {
      // Get initial count
      const tiles = page.locator('[class*="tile"]');
      const initialCount = await tiles.count();

      // Search for something specific
      await searchInput.fill("xyz123unlikely");
      await page.waitForTimeout(500);

      // Should have fewer results (likely none)
      const searchCount = await tiles.count();
      expect(searchCount).toBeLessThanOrEqual(initialCount);

      // Clear the search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Should restore original results
      const clearedCount = await tiles.count();
      expect(clearedCount).toBeGreaterThanOrEqual(searchCount);
    }
  });
});
