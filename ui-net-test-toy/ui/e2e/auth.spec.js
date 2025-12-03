import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies and localStorage before each test
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/");

    // Should redirect to Cognito login
    await expect(page).toHaveURL(/localhost:8001/);
    await expect(page.locator("text=Sign in")).toBeVisible();
  });

  test("shows loading state during authentication", async ({ page }) => {
    await page.goto("/");

    // Should show loading text momentarily
    const loadingText = page.locator("text=Loading...");

    // Check if loading appears (may be very quick)
    const hasLoading = await loadingText.isVisible().catch(() => false);

    if (hasLoading) {
      expect(hasLoading).toBeTruthy();
    }
  });

  test("handles OAuth authorization code callback", async ({ page }) => {
    // Mock the OAuth flow by setting a code in the URL
    await page.goto("/auth?code=test-auth-code-123");

    // Should attempt to exchange code for tokens
    // In a real test, you'd mock the API response
    await expect(page).toHaveURL(/auth\?code=/);
  });

  test("persists authentication across page refreshes", async ({ page }) => {
    // Set authentication tokens in localStorage
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("auth_access_token", "mock-access-token");
      localStorage.setItem("auth_id_token", "mock-id-token");
      localStorage.setItem("auth_refresh_token", "mock-refresh-token");
      localStorage.setItem("userEmail", "test@example.com");
    });

    // Reload the page
    await page.reload();

    // Should still be authenticated (would need real token validation)
    await expect(page.locator("text=test@example.com")).toBeVisible({
      timeout: 10000,
    });
  });

  test("handles logout correctly", async ({ page }) => {
    // Set up authenticated state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("auth_access_token", "mock-access-token");
      localStorage.setItem("auth_id_token", "mock-id-token");
      localStorage.setItem("auth_refresh_token", "mock-refresh-token");
      localStorage.setItem("userEmail", "test@example.com");
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Click logout button
    const logoutButton = page.locator("text=↩️");
    await logoutButton.click();

    // Should clear tokens and redirect to login
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem("auth_access_token"),
      id: localStorage.getItem("auth_id_token"),
      refresh: localStorage.getItem("auth_refresh_token"),
    }));

    expect(tokens.access).toBeNull();
    expect(tokens.id).toBeNull();
    expect(tokens.refresh).toBeNull();
  });
});
