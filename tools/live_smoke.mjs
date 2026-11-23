import { chromium } from 'playwright';

const base = process.env.DESK_BASE_URL || 'https://theaspirantsdesk0-creator.github.io/the-aspirants-desk/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
const failedLocalRequests = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('requestfailed', request => {
  if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
});
try {
  const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!response || !response.ok()) throw new Error('Homepage returned HTTP ' + (response?.status() ?? 'no response'));
  await page.waitForTimeout(7000);
  const title = await page.title();
  if (!title.includes("The Aspirant")) throw new Error('Unexpected page title: ' + title);
  const aiLauncher = await page.locator('#tadAiLauncher').count();
  if (aiLauncher !== 1) throw new Error('AI Desk launcher missing or duplicated; count=' + aiLauncher);
  await page.locator('#tadAiLauncher').click();
  await page.waitForTimeout(500);
  const aiPanelOpen = await page.locator('#tadAiPanel').evaluate(el => el.classList.contains('open'));
  if (!aiPanelOpen) throw new Error('AI Desk launcher did not open its panel');
  const aiForm = await page.locator('#tadAiForm').count();
  if (aiForm !== 1) throw new Error('AI Desk chat form is missing');
  const css = await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.includes('ai-desk.css')));
  if (!css) throw new Error('AI Desk stylesheet was not loaded');
  // Exercise the practice-bank controls, not just the homepage shell.
  const pyqSearch = page.locator('#pyqSearch');
  const pyqSubject = page.locator('#pyqSubject');
  const pyqDifficulty = page.locator('#pyqDifficulty');
  if (await pyqSearch.count() !== 1 || await pyqSubject.count() !== 1 || await pyqDifficulty.count() !== 1) {
    throw new Error('Practice-bank search, subject, or difficulty filter is missing');
  }
  await pyqSearch.fill('Lothal');
  await page.waitForFunction(() => document.querySelector('#pyqContainer')?.innerText.includes('Lothal'));
  const searchCards = await page.locator('#pyqContainer article.card').count();
  if (searchCards !== 1) throw new Error('Practice-bank search did not narrow to the expected single Lothal question; count=' + searchCards);
  await pyqSearch.fill('');
  await pyqSubject.selectOption({ label: 'Polity' });
  const subjectCards = await page.locator('#pyqContainer article.card').count();
  if (subjectCards < 1) throw new Error('Practice-bank subject filter returned no Polity questions');
  const nonPolityCards = await page.locator('#pyqContainer article.card').evaluateAll(cards =>
    cards.filter(card => !card.querySelector('.pill')?.textContent.trim().includes('Polity')).length
  );
  if (nonPolityCards) throw new Error('Practice-bank subject filter displayed questions from another subject');
  await pyqSubject.selectOption('ALL');
  await pyqDifficulty.selectOption('easy');
  const easyCountText = await page.locator('#pyqContainer').innerText();
  if (!easyCountText.includes('matching practice questions')) throw new Error('Practice-bank difficulty filter did not refresh results');
  await pyqDifficulty.selectOption('ALL');

  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('The Aspirant')) throw new Error('Expected site content is missing');
  if (pageErrors.length) throw new Error('Browser runtime errors: ' + pageErrors.join(' | '));
  if (failedLocalRequests.length) throw new Error('Failed same-origin requests: ' + failedLocalRequests.join(' | '));
  console.log(JSON.stringify({ result: 'PASS', url: base, title, aiLauncher, aiPanelOpen, aiForm, cssLoaded: css, pageErrors, failedLocalRequests }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', message: error.message, pageErrors, failedLocalRequests }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}