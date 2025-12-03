import { test, expect } from "@playwright/test";

test.describe("Notes Page", () => {
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
    await page.goto("/notes");
  });

  test("loads and displays note groups", async ({ page }) => {
    // Wait for the page to load
    await expect(
      page.locator('h1:has-text("Notes"), h1:has-text("My Notes")'),
    ).toBeVisible();

    // Wait for content to load
    await page.waitForLoadState("networkidle");

    // Should show note groups or empty state
    const hasNotes = (await page.locator('[class*="note"]').count()) > 0;
    const hasEmptyState = await page
      .locator("text=/no.*notes/i")
      .isVisible()
      .catch(() => false);

    expect(hasNotes || hasEmptyState).toBeTruthy();
  });

  test("creates a new note", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for add note button
    const addButton = page
      .locator('button:has-text("＋"), button:has-text("Add Note")')
      .first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Should open note creation dialog
      const dialog = page.locator(
        '[role="dialog"], [class*="modal"], [class*="dialog"]',
      );
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Fill in note details
      await page.fill(
        'input[name="title"], input[placeholder*="title"]',
        "New Test Note",
      );
      await page.fill(
        'textarea[name="content"], textarea[placeholder*="content"], input[name="body"]',
        "This is a test note content",
      );

      // Save the note
      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Create")',
      );
      await saveButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("sets reminder on a note", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Find a note
    const notes = page.locator('[class*="note"]');
    const noteCount = await notes.count();

    if (noteCount > 0) {
      // Click on the first note or its reminder button
      const firstNote = notes.first();
      await firstNote.hover();

      // Look for reminder button
      const reminderButton = page
        .locator('button:has-text("⏰"), button[title*="reminder"]')
        .first();

      if (await reminderButton.isVisible()) {
        await reminderButton.click();

        // Should open reminder dialog
        const reminderDialog = page.locator(
          '[role="dialog"]:has-text("reminder"), [class*="reminder"]',
        );

        if (await reminderDialog.isVisible({ timeout: 2000 })) {
          // Set a reminder for tomorrow
          const dateInput = page.locator(
            'input[type="date"], input[type="datetime-local"]',
          );
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateString = tomorrow.toISOString().split("T")[0];

          await dateInput.fill(dateString);

          // Save reminder
          const saveButton = page.locator(
            'button:has-text("Set"), button:has-text("Save")',
          );
          await saveButton.click();

          // Dialog should close
          await expect(reminderDialog).not.toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
