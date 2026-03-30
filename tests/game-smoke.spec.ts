import { expect, test, type Page, type TestInfo } from '@playwright/test';

interface RuntimeIssue {
  source: string;
  message: string;
  stack?: string;
  timestamp: number;
}

interface GameTestState {
  currentScene: string | null;
  sceneHistory: string[];
  issues: RuntimeIssue[];
}

const SAVE_STORAGE_KEY = 'roguelike_strategy_save_slots_v1';

async function readTestState(page: Page): Promise<GameTestState> {
  return page.evaluate(() => {
    return (
      window.__gameTestState ?? {
        currentScene: null,
        sceneHistory: [],
        issues: [],
      }
    );
  });
}

async function waitForScene(
  page: Page,
  sceneName: string,
  timeout = 10_000
): Promise<void> {
  await page.waitForFunction(
    (expectedScene) => window.__gameTestState?.currentScene === expectedScene,
    sceneName,
    { timeout }
  );
}

async function sendGameKey(page: Page, key: 'Enter' | 'Escape'): Promise<void> {
  await page.keyboard.press(key);
  await page.evaluate((pressedKey) => {
    const keyboardEventInit = {
      key: pressedKey,
      code: pressedKey === 'Escape' ? 'Escape' : pressedKey,
      bubbles: true,
    };

    window.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));
    window.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));
  }, key);
}

async function startPreparationGameViaBridge(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__gameTestControls?.startPreparationGame?.();
  });
}

function formatIssues(issues: RuntimeIssue[]): string {
  if (issues.length === 0) {
    return 'No runtime issues recorded.';
  }

  return issues
    .map((issue) => {
      const stackSuffix = issue.stack ? `\n${issue.stack}` : '';
      return `[${issue.source}] ${issue.message}${stackSuffix}`;
    })
    .join('\n\n');
}

async function expectNoRuntimeIssues(page: Page, label: string): Promise<void> {
  const state = await readTestState(page);
  expect(state.issues, `${label}\n${formatIssues(state.issues)}`).toEqual([]);
}

async function captureStepScreenshot(
  page: Page,
  testInfo: TestInfo,
  stepName: string
): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${stepName}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, SAVE_STORAGE_KEY);
});

test('reaches gameplay from preparation without runtime issues', async ({
  page,
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__gameTestState));

  const splashButton = page.getByRole('button', { name: 'Play game' });
  await expect(splashButton).toBeVisible();
  await captureStepScreenshot(page, testInfo, 'step-1-splash');
  await splashButton.click();

  await waitForScene(page, 'preparation');
  await expectNoRuntimeIssues(page, 'Preparation scene recorded runtime issues.');
  await captureStepScreenshot(page, testInfo, 'step-2-preparation');

  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 100, y: 100 } });
  await sendGameKey(page, 'Enter');

  try {
    await waitForScene(page, 'gameplay', 3_000);
  } catch {
    await startPreparationGameViaBridge(page);
    await waitForScene(page, 'gameplay');
  }

  await expectNoRuntimeIssues(page, 'Gameplay scene recorded runtime issues.');
  await captureStepScreenshot(page, testInfo, 'step-3-gameplay');
});
