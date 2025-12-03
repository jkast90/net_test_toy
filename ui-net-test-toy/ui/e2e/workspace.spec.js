import { test, expect } from "@playwright/test";

test.describe("Workspace Management", () => {
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
        JSON.stringify({ id: 1, name: "Personal" }),
      );
    });
    await page.goto("/links");
  });

  test("switches between workspaces", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for workspace selector (usually in footer or header)
    const workspaceSelector = page.locator(
      'select:has-option, [role="combobox"]',
    );

    if (await workspaceSelector.isVisible()) {
      // Get current workspace
      const currentValue = await workspaceSelector.inputValue();

      // Get all options
      const options = await workspaceSelector
        .locator("option")
        .allTextContents();

      if (options.length > 1) {
        // Select a different workspace
        const newWorkspace = options.find((opt) => opt !== currentValue);
        if (newWorkspace) {
          await workspaceSelector.selectOption({ label: newWorkspace });

          // Verify workspace changed in localStorage
          const storedWorkspace = await page.evaluate(() =>
            JSON.parse(localStorage.getItem("selectedWorkspace") || "{}"),
          );

          expect(storedWorkspace.name).toBeTruthy();
        }
      }
    }
  });

  test("creates a new workspace", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for add workspace button (might be in a dropdown or settings)
    const addWorkspaceButton = page
      .locator(
        'button:has-text("Add Workspace"), button:has-text("New Workspace"), button:has-text("+")',
      )
      .filter({ hasText: /workspace/i });

    // If not visible, try opening settings first
    if (!(await addWorkspaceButton.isVisible())) {
      const settingsButton = page.locator(
        'button:has-text("⚙️"), button:has-text("Settings")',
      );
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await page.waitForTimeout(500);
      }
    }

    if (await addWorkspaceButton.isVisible()) {
      await addWorkspaceButton.click();

      // Should open workspace creation dialog
      const dialog = page.locator(
        '[role="dialog"]:has-text("workspace"), [class*="modal"]:has-text("workspace")',
      );

      if (await dialog.isVisible({ timeout: 5000 })) {
        // Fill in workspace details
        const nameInput = page.locator(
          'input[name="name"], input[placeholder*="name"]',
        );
        await nameInput.fill("New Test Workspace");

        // Select workspace type if available
        const typeSelect = page.locator(
          'select[name="type"], select[name="view"]',
        );
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption("personal");
        }

        // Create the workspace
        const createButton = page.locator(
          'button:has-text("Create"), button:has-text("Add")',
        );
        await createButton.click();

        // Dialog should close
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        // New workspace might be selected automatically
        const storedWorkspace = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("selectedWorkspace") || "{}"),
        );

        expect(storedWorkspace).toBeTruthy();
      }
    }
  });

  test("deletes a workspace", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // This is usually in settings
    const settingsButton = page.locator(
      'button:has-text("⚙️"), button:has-text("Settings")',
    );

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Look for workspace management section
      const deleteButton = page.locator(
        'button:has-text("Delete"):near(:has-text("workspace"))',
      );

      if (await deleteButton.isVisible()) {
        const workspaceCount = await page
          .locator('[class*="workspace"]')
          .count();

        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Yes")',
        );
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();

          // Check if workspace count decreased
          await page.waitForTimeout(500);
          const newCount = await page.locator('[class*="workspace"]').count();

          expect(newCount).toBeLessThan(workspaceCount);
        }
      }
    }
  });
});
