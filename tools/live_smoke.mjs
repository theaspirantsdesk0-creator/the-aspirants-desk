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
  let response = null;
  let publishedVersionReady = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (response && response.ok()) {
      await page.waitForTimeout(1200);
      const hasMentorWorkspace = await page.locator('#mentor').count() === 1;
      const hasPracticeBank = await page.locator('#pyqSearch').count() === 1;
      if (hasMentorWorkspace && hasPracticeBank) {
        publishedVersionReady = true;
        break;
      }
    }
    await page.waitForTimeout(15000);
  }
  if (!publishedVersionReady) throw new Error('The latest mentor/practice-bank build did not appear on Pages within five minutes; last HTTP status=' + (response?.status() ?? 'no response'));
  await page.waitForTimeout(4000);
  const mentorNav = page.locator('a[data-nav="mentor"]');
  const mentorSection = page.locator('#mentor');
  if (await mentorNav.count() !== 1 || !(await mentorNav.isHidden())) {
    throw new Error('Mentor navigation must remain hidden for a guest visitor');
  }
  if (await mentorSection.count() !== 1 || !(await mentorSection.isHidden())) {
    throw new Error('Mentor workspace content must remain hidden for a guest visitor');
  }
  const ownerNav = page.locator('a[data-nav="admin"]');
  if (await ownerNav.count() !== 1 || !(await ownerNav.isHidden())) {
    throw new Error('Owner admin navigation must remain hidden for a guest visitor');
  }
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
  // The PYQ bank is login-protected. Confirm its controls exist in the document,
  // but do not attempt to interact with a hidden protected view as a guest.
  const pyqSearch = page.locator('#pyqSearch');
  const pyqSubject = page.locator('#pyqSubject');
  const pyqDifficulty = page.locator('#pyqDifficulty');
  if (await pyqSearch.count() !== 1 || await pyqSubject.count() !== 1 || await pyqDifficulty.count() !== 1) {
    throw new Error('Practice-bank search, subject, or difficulty filter markup is missing');
  }
  if (await page.locator('#pyq').isVisible()) {
    throw new Error('The login-protected PYQ view must not be visible to a guest');
  }

  // Deep links must not bypass the owner/mentor role gate. Use fresh pages
  // so each fragment is present on the initial document load.
  const mentorDeepLinkPage = await browser.newPage();
  mentorDeepLinkPage.on('pageerror', error => pageErrors.push(error.message));
  mentorDeepLinkPage.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
  });
  await mentorDeepLinkPage.goto(base + '#mentor', { waitUntil: 'domcontentloaded' });
  await mentorDeepLinkPage.waitForTimeout(700);
  if (!(await mentorDeepLinkPage.locator('#authModal').isVisible())) {
    throw new Error('A guest deep-linking to Mentor Workspace must be asked to sign in');
  }
  if (await mentorDeepLinkPage.locator('#mentor').isVisible()) {
    throw new Error('A guest must not see Mentor Workspace after opening its deep link');
  }
  await mentorDeepLinkPage.close();

  const adminDeepLinkPage = await browser.newPage();
  adminDeepLinkPage.on('pageerror', error => pageErrors.push(error.message));
  adminDeepLinkPage.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
  });
  await adminDeepLinkPage.goto(base + '#admin', { waitUntil: 'domcontentloaded' });
  await adminDeepLinkPage.waitForTimeout(700);
  if (!(await adminDeepLinkPage.locator('#authModal').isVisible())) {
    throw new Error('A guest deep-linking to Owner Admin must be asked to sign in');
  }
  if (await adminDeepLinkPage.locator('#admin').isVisible()) {
    throw new Error('A guest must not see Owner Admin after opening its deep link');
  }
  await adminDeepLinkPage.close();

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