import { test, expect } from "@playwright/test";

test.describe("Links Page", () => {
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

  test("loads and displays link groups", async ({ page }) => {
    // Wait for the page to load
    await expect(page.locator('h1:has-text("My Links")')).toBeVisible();

    // Check if groups are loaded (may take a moment)
    await page.waitForLoadState("networkidle");

    // Should show link groups or empty state
    const hasGroups = (await page.locator('[class*="tileGroup"]').count()) > 0;
    const hasEmptyState = await page
      .locator("text=/no.*links/i")
      .isVisible()
      .catch(() => false);

    expect(hasGroups || hasEmptyState).toBeTruthy();
  });

  test("creates a new link tile", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for add button (usually a + button)
    const addButton = page.locator('button:has-text("＋")').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Should open a dialog or form
      const dialog = page.locator(
        '[role="dialog"], [class*="modal"], [class*="dialog"]',
      );
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Fill in link details
      await page.fill(
        'input[name="name"], input[placeholder*="name"]',
        "New Test Link",
      );
      await page.fill(
        'input[name="url"], input[placeholder*="url"]',
        "https://example.com",
      );

      // Submit the form
      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Create"), button:has-text("Add")',
      );
      await saveButton.click();

      // Should close dialog and show new link
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("edits an existing link tile", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // First, check if there are any links
    const linkTiles = page.locator('[class*="tile"]');
    const linkCount = await linkTiles.count();

    if (linkCount > 0) {
      // Hover over the first tile to reveal edit button
      await linkTiles.first().hover();

      // Click edit button if visible
      const editButton = page
        .locator('button:has-text("✎"), button:has-text("Edit")')
        .first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // Should open edit dialog
        const dialog = page.locator(
          '[role="dialog"], [class*="modal"], [class*="dialog"]',
        );
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Modify the name
        const nameInput = page
          .locator('input[name="name"], input[value*=""]')
          .first();
        await nameInput.fill("Updated Link Name");

        // Save changes
        const saveButton = page.locator(
          'button:has-text("Save"), button:has-text("Update")',
        );
        await saveButton.click();

        // Dialog should close
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("deletes a link tile", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Get initial link count
    const linkTiles = page.locator('[class*="tile"]');
    const initialCount = await linkTiles.count();

    if (initialCount > 0) {
      // Hover over the first tile
      await linkTiles.first().hover();

      // Click delete button
      const deleteButton = page
        .locator('button:has-text("🗑"), button:has-text("Delete")')
        .first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Confirm deletion if there's a confirmation dialog
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
        );
        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
        }

        // Check that tile count decreased
        await page.waitForTimeout(500);
        const newCount = await linkTiles.count();
        expect(newCount).toBeLessThan(initialCount);
      }
    }
  });

  test("supports drag and drop reordering", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const tiles = page.locator('[draggable="true"]');
    const tileCount = await tiles.count();

    if (tileCount >= 2) {
      const firstTile = tiles.first();
      const secondTile = tiles.nth(1);

      // Get initial positions
      const firstBox = await firstTile.boundingBox();
      const secondBox = await secondTile.boundingBox();

      if (firstBox && secondBox) {
        // Drag first tile to second tile's position
        await firstTile.dragTo(secondTile);

        // Verify positions changed (may need to wait for animation)
        await page.waitForTimeout(500);
        const newFirstBox = await firstTile.boundingBox();

        // Position should have changed
        expect(newFirstBox?.y).not.toBe(firstBox.y);
      }
    }
  });
});
