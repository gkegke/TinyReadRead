import { expect, test } from "@playwright/test";

test.describe("Tiny-ReadRead Critical Path", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/projects**", async (route) => {
			const url = route.request().url();
			const method = route.request().method();

			if (method === "GET" && url.endsWith("/api/projects")) {
				await route.fulfill({ json: [] });
			} else if (method === "POST" && url.endsWith("/api/projects")) {
				await route.fulfill({
					json: { id: "test-p-123", name: "Mock Project" },
				});
			} else if (method === "POST" && url.includes("/import")) {
				await route.fulfill({ json: { status: "success", count: 2 } });
			} else {
				await route.continue();
			}
		});

		await page.route("**/api/projects/test-p-123/chunks", async (route) => {
			await route.fulfill({
				json: [
					{
						id: "c1",
						project_id: "test-p-123",
						text_content: "Sentence one.",
						status: "generated",
						ordinal_index: 0,
						role: "paragraph",
					},
					{
						id: "c2",
						project_id: "test-p-123",
						text_content: "Sentence two.",
						status: "generated",
						ordinal_index: 1,
						role: "paragraph",
					},
				],
			});
		});

		await page.route("**/api/generate", async (route) => {
			await route.fulfill({ json: { status: "success" } });
		});

		await page.route("**/api/audio/**", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "audio/wav",
				body: Buffer.alloc(1000),
			});
		});

		await page.route("**/api/voices", async (route) => {
			await route.fulfill({ json: { voices: ["Jasper", "Luna"] } });
		});

		await page.addInitScript(() => {
			// [CRITICAL] Purged ghost settings and legacy localStorage initialization flags
			window.localStorage.setItem(
				"trr-ui-v4",
				JSON.stringify({
					state: { activeModelId: "kitten-nano", hiddenChapters: {} },
					version: 1,
				}),
			);
		});
	});

	test("Should import text, generate chunks, and reflect health status", async ({
		page,
	}) => {
		await page.goto("/");

		const branding = page
			.getByRole("heading", { name: "Tiny ReadRead" })
			.first();
		await expect(branding).toBeVisible({ timeout: 15000 });

		const textArea = page.locator('textarea[placeholder*="Paste your text"]');
		await textArea.fill("Sentence one. \n\n Sentence two.");

		await page.getByRole("button", { name: /Process Text/i }).click();

		await expect(page).toHaveURL(/.*project\/test-p-123/, { timeout: 10000 });

		await expect(page.locator('text="2/2"').first()).toBeVisible();

		const firstChunk = page.getByTestId("chunk-card").first();
		const playButton = firstChunk
			.locator("button")
			.filter({ hasText: "" })
			.last();

		await playButton.click();

		const iconLocator = firstChunk.locator(
			"svg.lucide-pause-circle, svg.lucide-loader-2",
		);
		await expect(iconLocator).toBeVisible({ timeout: 10000 });

		const secondChunk = page.getByTestId("chunk-card").nth(1);
		await expect(secondChunk).toHaveClass(/opacity-10/);
	});
});
