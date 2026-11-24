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
  // Public AI endpoint must reject requests without a signed-in Supabase session.
  const aiAuthProbe = await fetch('https://sqnpxlsprzbgnmgljigg.supabase.co/functions/v1/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://theaspirantsdesk0-creator.github.io' },
    body: JSON.stringify({ message: 'health check' }),
  });
  if (aiAuthProbe.status !== 401) {
    throw new Error('AI endpoint should reject unauthenticated requests with HTTP 401; received ' + aiAuthProbe.status);
  }
  // The user-triggered test-push endpoint must reject unauthenticated requests.
  const testPushAuthProbe = await fetch('https://sqnpxlsprzbgnmgljigg.supabase.co/functions/v1/send-test-study-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://theaspirantsdesk0-creator.github.io' },
    body: '{}',
  });
  if (testPushAuthProbe.status !== 401) {
    throw new Error('Test notification endpoint should reject unauthenticated requests with HTTP 401; received ' + testPushAuthProbe.status);
  }
  // Cron-triggered push sender must reject requests without its private cron header.
  const pushAuthProbe = await fetch('https://sqnpxlsprzbgnmgljigg.supabase.co/functions/v1/send-study-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (pushAuthProbe.status !== 401) {
    throw new Error('Push sender should reject requests without the cron secret with HTTP 401; received ' + pushAuthProbe.status);
  }
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
  const learnerFeedbackCard = page.locator('#learnerMentorFeedbackCard');
  if (await learnerFeedbackCard.count() !== 1 || !(await learnerFeedbackCard.isHidden())) {
    throw new Error('Shared learner feedback must remain hidden for a guest visitor');
  }
  const vapidPublicKeyLoaded = await page.evaluate(() => Boolean(window.DESK_VAPID_PUBLIC_KEY));
  if (!vapidPublicKeyLoaded) throw new Error('Public VAPID key is not loaded from config.js');
  if (await page.locator('#checkPushBtn').count() !== 1 || await page.locator('#pushDiagnostics').count() !== 1) {
    throw new Error('Push reminder device diagnostics controls are missing');
  }
  await page.locator('#checkPushBtn').click();
  await page.locator('#pushDiagnostics').waitFor({ state: 'visible' });
  if (!(await page.locator('#pushDiagnostics').innerText()).includes('sign in')) {
    throw new Error('Guest push diagnostics should explain that sign-in is required before account checks');
  }
  const ownerNav = page.locator('a[data-nav="admin"]');
  if (await ownerNav.count() !== 1 || !(await ownerNav.isHidden())) {
    throw new Error('Owner admin navigation must remain hidden for a guest visitor');
  }
  const title = await page.title();
  if (!title.includes("The Aspirant")) throw new Error('Unexpected page title: ' + title);
  const anbuuNav = page.locator('a[data-nav="anbuu"]');
  if (await anbuuNav.count() !== 1 || !(await anbuuNav.isVisible()) || !(await anbuuNav.evaluate(el => el.classList.contains('requires-auth'))) || await anbuuNav.locator('.lock-tag').count() !== 1) {
    throw new Error('Anbuu main-navigation tab must be visible with a login gate for guest visitors');
  }
  const anbuuPage = page.locator('#tadAiPanel');
  if (await anbuuPage.count() !== 1 || !(await anbuuPage.isHidden())) {
    throw new Error('Anbuu full-page workspace must remain hidden for a guest visitor');
  }
  const anbuuShortcuts = page.locator('#tadAiPanel .tad-anbuu-shortcuts button[data-nav]');
  if (await anbuuShortcuts.count() !== 6) throw new Error('Anbuu must expose shortcuts to the main study sections');
  await page.locator('#tadAiPanel .tad-anbuu-shortcuts button[data-nav="home"]').evaluate(el => el.click());
  if (!(await page.locator('#home').isVisible())) throw new Error('A dynamically injected Anbuu shortcut did not navigate to Dashboard');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#menuToggle').click();
  if (!(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')))) throw new Error('Mobile menu did not open');
  if (await page.locator('#sidebar .nav-link:visible').count() < 8) throw new Error('Mobile sidebar did not reveal the full study navigation');
  await page.locator('#sidebar a[data-nav="about-app"]').click();
  if (!(await page.locator('#about-app').isVisible()) || await page.locator('#sidebar').evaluate(el => el.classList.contains('open'))) {
    throw new Error('Mobile navigation did not switch sections and close the menu');
  }
  await page.setViewportSize({ width: 1365, height: 900 });
  if (!(await anbuuPage.locator('.tad-anbuu-page-hero h1').textContent()).includes('Meet Anbuu')) {
    throw new Error('Anbuu page hero is missing');
  }
  if (await page.locator('#tadAiNextSteps').count() !== 1) {
    throw new Error('Anbuu lesson-aware next-step recommendations are missing');
  }
  const aiForm = await page.locator('#tadAiForm').count();
  if (aiForm !== 1) throw new Error('Anbuu chat form is missing');
  const revisionTab = page.locator('#tadAiRevisionTab');
  if (await revisionTab.count() !== 1) throw new Error('Anbuu Revision Planner tab is missing');
  // Verify Anbuu guided-learning UI and the complete optional-subject catalogue.
  const lessonStudio = page.locator('.tad-anbuu-lesson-studio');
  if (await lessonStudio.count() !== 1) throw new Error('Anbuu guided-learning studio is missing');
  for (const selector of ['#tadLessonTrack', '#tadLessonSubject', '#tadLessonTopic', '#tadLessonLevel', '#tadStartLesson']) {
    if (await page.locator(selector).count() !== 1) throw new Error('Anbuu lesson control is missing: ' + selector);
  }
  await page.waitForFunction(() => {
    const select = document.querySelector('#tadLessonSubject');
    return select && select.options.length >= 12;
  }, { timeout: 15000 });
  const lessonCatalogue = await page.evaluate(async () => {
    const track = document.querySelector('#tadLessonTrack');
    const subject = document.querySelector('#tadLessonSubject');
    const countFor = async value => {
      track.value = value;
      track.dispatchEvent(new Event('change', { bubbles: true }));
      // Wait for the catalogue fetch to have populated the selected list.
      for (let i = 0; i < 40; i++) {
        if (subject.options.length > 1) return subject.options.length;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return subject.options.length;
    };
    const optional = await countFor('optional');
    const literature = await countFor('literature');
    return { optional, literature };
  });
  if (lessonCatalogue.optional !== 25 || lessonCatalogue.literature !== 23) {
    throw new Error('Anbuu optional catalogue mismatch: ' + JSON.stringify(lessonCatalogue) + ' (expected 25 optional and 23 literature subjects)');
  }
  for (const selector of ['#tadLessonHistoryTitle', '#tadLessonHistoryList', '#tadRefreshLessons']) {
    if (await page.locator(selector).count() !== 1) throw new Error('Anbuu saved lesson history UI is missing: ' + selector);
  }
  const css = await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.includes('ai-desk.css')));
  if (!css) throw new Error('Anbuu stylesheet was not loaded');
  // The PYQ bank is login-protected. Confirm its controls exist in the document,
  // but do not attempt to interact with a hidden protected view as a guest.
  // Course authoring must be present but remain unavailable to guest visitors.
  const courseNav = page.locator('a[data-nav="course-catalog"]');
  const courseStudio = page.locator('#courseStudio');
  const publishedCourses = page.locator('#publishedCourseList');
  if (await courseNav.count() !== 1) throw new Error('Courses & Learning navigation is missing');
  if (await courseStudio.count() !== 1 || !(await courseStudio.isHidden())) {
    throw new Error('Course Studio must remain hidden from guest visitors');
  }
  if (await publishedCourses.count() !== 1) throw new Error('Published course management container is missing');
  const communityPanel = page.locator('#communityCoursesPanel');
  if (await communityPanel.count() !== 1 || !(await communityPanel.isHidden())) {
    throw new Error('Staff-only published course management panel must remain hidden from guests');
  }
  const courseScript = page.locator('script[src="assets/js/courses.js"]');
  if (await courseScript.count() !== 1) throw new Error('Learner course integration script is missing');
  const courseStudioCss = await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.includes('course-studio.css')));
  if (!courseStudioCss) throw new Error('Course Studio stylesheet was not loaded');
  const courseSummary = page.locator('#courseLearningSummary');
  const courseCatalog = page.locator('#courseCatalog');
  const courseDetail = page.locator('#courseDetail');
  if (await courseSummary.count() !== 1 || await courseCatalog.count() !== 1 || await courseDetail.count() !== 1) {
    throw new Error('Learner course progress, catalogue, or detail containers are missing');
  }
  const learnerCourseCss = await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.includes('courses.css')));
  if (!learnerCourseCss) throw new Error('Learner course progress stylesheet was not loaded');

  // Exercise the mentor-course learner flow with an in-memory Supabase fixture.
  // This does not create or modify real accounts or database records.
  await page.evaluate(() => {
    const fixture = {
      from: () => ({
        select() { return this; },
        eq() { return this; },
        order() {
          return Promise.resolve({
            data: [{
              id: '00000000-0000-4000-8000-000000000001',
              title: 'Smoke mentor course',
              summary: 'A temporary browser fixture for learner catalogue integration.',
              category: 'Testing',
              level: 'Beginner',
              duration_minutes: 10,
              outcomes: ['Explain the test topic'],
              lessons: [{ title: 'Smoke lesson', body: ['Temporary lesson content.'], task: 'Summarise the lesson.' }],
              status: 'published'
            }],
            error: null
          });
        }
      })
    };
    window.dispatchEvent(new CustomEvent('tad:authStateChanged', {
      detail: { supabase: fixture, user: { id: 'smoke-learner' }, profile: { role: 'learner' } }
    }));
  });
  await page.waitForFunction(() => document.querySelector('#courseCatalog')?.textContent.includes('Smoke mentor course'));
  const mentorCourseResult = await page.evaluate(() => {
    const card = document.querySelector('[data-open-course="mentor-00000000-0000-4000-8000-000000000001"]');
    if (!card) throw new Error('Published mentor course did not enter the learner catalogue');
    card.click();
    const detail = document.querySelector('#courseDetail');
    const noQuizForm = !detail.querySelector('#tadCourseQuiz');
    const lessonButton = detail.querySelector('[data-complete-lesson="0"]');
    if (!lessonButton) throw new Error('Mentor course lesson completion control is missing');
    lessonButton.click();
    return {
      noQuizForm,
      completed: detail.textContent.includes('Course completed'),
      progressSaved: JSON.parse(localStorage.getItem('tad_state_v5') || '{}').learningHub?.courses?.['mentor-00000000-0000-4000-8000-000000000001']?.completedLessons?.includes(0) || false
    };
  });
  if (!mentorCourseResult.noQuizForm) throw new Error('Mentor course without a quiz displayed an empty assessment form');
  if (!mentorCourseResult.completed || !mentorCourseResult.progressSaved) throw new Error('Mentor course lesson completion was not reflected in learner progress');

  const pyqSearch = page.locator('#pyqSearch');
  const pyqSubject = page.locator('#pyqSubject');
  const pyqDifficulty = page.locator('#pyqDifficulty');
  const optionalCoverageSubject = page.locator('#optionalPyqCoverageSubject');
  const optionalCoverageGrid = page.locator('#optionalPyqCoverageGrid');
  if (await pyqSearch.count() !== 1 || await pyqSubject.count() !== 1 || await pyqDifficulty.count() !== 1) {
    throw new Error('Practice-bank search, subject, or difficulty filter markup is missing');
  }
  if (await optionalCoverageSubject.count() !== 1 || await optionalCoverageGrid.count() !== 1) {
    throw new Error('All-subject optional PYQ coverage controls are missing from the published page');
  }
  if (await page.locator('#pyq').isVisible()) {
    throw new Error('The login-protected PYQ view must not be visible to a guest');
  }

  // Deep links must not bypass the owner/mentor role gate. Use fresh pages
  // so each fragment is present on the initial document load.
  const anbuuDeepLinkPage = await browser.newPage();
  anbuuDeepLinkPage.on('pageerror', error => pageErrors.push(error.message));
  anbuuDeepLinkPage.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
  });
  await anbuuDeepLinkPage.goto(base + '#anbuu', { waitUntil: 'domcontentloaded' });
  await anbuuDeepLinkPage.locator('#authModal').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (!(await anbuuDeepLinkPage.locator('#authModal').isVisible())) {
    throw new Error('A guest deep-linking to Anbuu must be asked to sign in');
  }
  if (await anbuuDeepLinkPage.locator('#tadAiPanel').isVisible()) {
    throw new Error('A guest must not see Anbuu after opening its deep link');
  }
  await anbuuDeepLinkPage.close();

  const mentorDeepLinkPage = await browser.newPage();
  mentorDeepLinkPage.on('pageerror', error => pageErrors.push(error.message));
  mentorDeepLinkPage.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
  });
  await mentorDeepLinkPage.goto(base + '#mentor', { waitUntil: 'domcontentloaded' });
  await mentorDeepLinkPage.locator('#authModal').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
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
  await adminDeepLinkPage.locator('#authModal').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (!(await adminDeepLinkPage.locator('#authModal').isVisible())) {
    throw new Error('A guest deep-linking to Owner Admin must be asked to sign in');
  }
  if (await adminDeepLinkPage.locator('#admin').isVisible()) {
    throw new Error('A guest must not see Owner Admin after opening its deep link');
  }
  await adminDeepLinkPage.close();

  if (await page.locator('#tadAiLessonRevisionTasks').count() !== 1) {
    throw new Error('Anbuu Revision Planner guided-lesson review section is missing');
  }
  if (!(await page.locator('#tadLessonHistoryList').count())) {
    throw new Error('Anbuu lesson history UI is missing');
  }
  if (await page.locator('#tadAiLessons').count() !== 1) {
    throw new Error('Anbuu guided-lesson progress summary is missing from the learner dashboard');
  }

  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('The Aspirant')) throw new Error('Expected site content is missing');
  if (pageErrors.length) throw new Error('Browser runtime errors: ' + pageErrors.join(' | '));
  if (failedLocalRequests.length) throw new Error('Failed same-origin requests: ' + failedLocalRequests.join(' | '));
  console.log(JSON.stringify({ result: 'PASS', url: base, title, anbuuNavigation: true, anbuuPage: true, aiForm, revisionTab: true, cssLoaded: css, pageErrors, failedLocalRequests }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', message: error.message, pageErrors, failedLocalRequests }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}