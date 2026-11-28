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
  let lastDomAudit = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (response && response.ok()) {
      await page.waitForTimeout(1200);
      lastDomAudit = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        mentor: document.querySelectorAll('#mentor').length,
        practiceBank: document.querySelectorAll('#pyqSearch').length,
        anbuuAnchor: document.querySelectorAll('#sidebar a.nav-link[data-nav="anbuu"]').length,
        bodyStart: document.body?.innerText?.slice(0, 220) || ''
      }));
      if (lastDomAudit.mentor === 1 && lastDomAudit.practiceBank === 1 && lastDomAudit.anbuuAnchor === 1) {
        publishedVersionReady = true;
        break;
      }
    }
    await page.waitForTimeout(15000);
  }
  if (!publishedVersionReady) throw new Error('Latest build did not appear on Pages within ten minutes; HTTP=' + (response?.status() ?? 'no response') + '; DOM=' + JSON.stringify(lastDomAudit));
  await page.waitForTimeout(4000);
  // Public practice-bank API must expose published questions only; owner tools
  // remain hidden in the guest session used by this smoke test.
  const practiceBankAccess = await page.evaluate(async () => {
    const client = window.TAD_SUPABASE;
    if (!client) return { error: 'Supabase browser client missing', statuses: [] };
    const { data, error } = await client.from('practice_question_bank').select('status').limit(50);
    return { error: error?.message || null, statuses: (data || []).map(row => row.status) };
  });
  if (practiceBankAccess.error || practiceBankAccess.statuses.some(status => status !== 'published')) {
    throw new Error('Public practice bank access policy failed: ' + JSON.stringify(practiceBankAccess));
  }
  const guestOwnerControls = await page.locator('#mockExamRoot').evaluate(el =>
    Boolean(el.querySelector('#mockAdminPanel') || el.querySelector('#questionReviewAdmin'))
  );
  if (guestOwnerControls) throw new Error('Owner question publishing controls must not exist in the guest examination workspace');
  // Exercise the owner-only bulk-import preview in an isolated browser fixture.
  // The fake Supabase client is in-memory: this test creates no real database rows.
  const reviewScriptResponse = await page.request.get(base + 'assets/js/question-review-dashboard.js');
  if (!reviewScriptResponse.ok()) throw new Error('Question review client script could not be fetched');
  const reviewScriptSource = await reviewScriptResponse.text();
  for (const required of ['function previewBulk()', 'function exportBulkReport()', 'qReviewBulkPreviewBtn', 'qReviewBulkExport']) {
    if (!reviewScriptSource.includes(required)) throw new Error('Question import preview feature is missing: ' + required);
  }
  const reviewFixture = await browser.newPage({ acceptDownloads: true });
  reviewFixture.on('dialog', dialog => dialog.accept());
  await reviewFixture.setContent([
    '<section id="questionReviewAdmin" hidden>',
    '<p id="qReviewStatus"></p><input id="qReviewFilter" value="all"><input id="qReviewSearch">',
    '<button id="qReviewNew"></button><button id="qReviewReload"></button>',
    '<button id="qReviewSaveDraft"></button><button id="qReviewSendReview"></button>',
    '<button id="qReviewPublish"></button><button id="qReviewArchive"></button>',
    '<form id="qReviewForm"><input id="qReviewSubject"><input id="qReviewTopic"><input id="qReviewQuestion"><input id="qReviewAnswer"><textarea id="qReviewWrong"></textarea><input id="qReviewExplanation"><input id="qReviewDifficulty"><input id="qReviewSourceTitle"><input id="qReviewSourceUrl"><input id="qReviewRecordMeta"><input id="qReviewEditorTitle"><div id="qReviewDuplicate"></div>',
    '<input type="checkbox" id="qReviewCheck_answer"><input type="checkbox" id="qReviewCheck_distractors"><input type="checkbox" id="qReviewCheck_explanation"><input type="checkbox" id="qReviewCheck_metadata"><input type="checkbox" id="qReviewCheck_duplicates"></form>',
    '<div id="qReviewEditor"></div><div id="qReviewStats"></div><div id="qReviewCount"></div><div id="qReviewList"></div>',
    '<input id="qReviewBulkFile" type="file"><textarea id="qReviewBulkJson"></textarea>',
    '<button id="qReviewBulkPreviewBtn"></button><button id="qReviewBulkImport" disabled></button>',
    '<button id="qReviewBulkExport" disabled></button><div id="qReviewBulkSummary"></div>',
    '<div id="qReviewBulkPreview"></div><div id="qReviewBulkResult"></div>',
    '<button id="qReviewBatchRefresh"></button><div id="qReviewBatchList"></div>',
    '<section id="qReviewHistory"></section><section id="qReviewVersionCompare"></section>',
    '</section>'
  ].join(''));
  await reviewFixture.evaluate(() => {
    const bankRows = [{
      id: 'existing-question',
      subject: 'Polity',
      topic: 'President',
      question_text: 'The President is elected by an electoral college consisting of elected members of both Houses of Parliament and elected members of State Legislative Assemblies within India.',
      correct_answer: 'Electoral college',
      wrong_options: ['Cabinet', 'Supreme Court', 'Election Commission'],
      explanation: 'A constitutional electoral college elects the President.',
      difficulty: 'medium',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
    const batchRows=[];
    const snapshots=[
      {question_key:'inserted-0-0',version_no:2,event_type:'updated',snapshot:{subject:'Polity',topic:'Elections',question_text:'Which body conducts national elections in India?',correct_answer:'Election Commission of India',wrong_options:['Union Cabinet','Supreme Court','Finance Commission'],explanation:'Updated explanation text.',difficulty:'easy',status:'draft',source_title:'',source_url:'',review_checks:{}},actor_id:null,created_at:new Date().toISOString()},
      {question_key:'inserted-0-0',version_no:1,event_type:'created',snapshot:{subject:'Polity',topic:'Elections',question_text:'Which institution conducts national elections in India?',correct_answer:'Election Commission of India',wrong_options:['Union Cabinet','Supreme Court','Finance Commission'],explanation:'Initial explanation text.',difficulty:'medium',status:'draft',source_title:'',source_url:'',review_checks:{}},actor_id:null,created_at:new Date(Date.now()-60000).toISOString()}
    ];
    window.__reviewInserted = [];
    window.__reviewBatchRows = batchRows;
    window.TAD_SUPABASE = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-fixture' } } } }) },
      rpc: async (name,args) => {
        if(name!=='rollback_practice_question_import_batch')return {data:null,error:{message:'Unexpected RPC'}};
        const batch=batchRows.find(x=>x.id===args.p_batch_id);
        if(!batch)return {data:null,error:{message:'Batch not found'}};
        if(batch.status==='rolled_back')return {data:null,error:{message:'Already rolled back'}};
        const rows=bankRows.filter(row=>row.import_batch_id===args.p_batch_id);
        if(rows.some(row=>row.status!=='draft'))return {data:null,error:{message:'Rollback blocked because a question moved beyond Draft'}};
        rows.forEach(row=>row.status='archived');
        batch.status='rolled_back';batch.rollback_count=rows.length;batch.rolled_back_at=new Date().toISOString();
        return {data:{records_archived:rows.length,status:'rolled_back'},error:null};
      },
      from: table => {
        const query = {
          pendingInsert:null,pendingUpdate:null,filterId:null,
          select() { return this; },
          eq(column,value) { if(column==='id')this.filterId=value;return this; },
          in: async () => ({data:[],error:null}),
          order() { return this; },
          maybeSingle: async () => ({ data: { role: 'admin' }, error: null }),
          limit: async () => ({ data: table==='practice_question_bank'?bankRows:table==='practice_question_import_batches'?batchRows:table==='practice_question_versions'?snapshots:[], error: null }),
          range: async (start, end) => ({ data: bankRows.slice(start, end + 1), error: null }),
          insert(values) {
            if(table==='practice_question_import_batches'){this.pendingInsert=values;return this;}
            const added=(Array.isArray(values)?values:[values]).map((row,index)=>({...row,id:'inserted-'+window.__reviewInserted.length+'-'+index,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}));
            window.__reviewInserted.push(...added);bankRows.push(...added);
            return Promise.resolve({error:null});
          },
          single: async () => {
            const row={...this.pendingInsert,id:'batch-'+(batchRows.length+1),created_at:new Date().toISOString(),rolled_back_at:null,rollback_count:0};
            batchRows.push(row);return {data:{id:row.id},error:null};
          },
          update(values) { this.pendingUpdate=values;return this; },
          then(resolve,reject) {
            if(table==='practice_question_import_batches'&&this.pendingUpdate){
              const row=batchRows.find(x=>x.id===this.filterId);
              if(row)Object.assign(row,this.pendingUpdate);
              return Promise.resolve({error:null}).then(resolve,reject);
            }
            return Promise.resolve({error:null}).then(resolve,reject);
          }
        };
        return query;
      }
    };
  });
  await reviewFixture.addScriptTag({ content: reviewScriptSource });
  const reviewRows = [
    {
      subject: 'Polity', topic: 'Elections',
      q: 'Which body conducts national elections in India?',
      a: 'Election Commission of India',
      w: ['Union Cabinet', 'Supreme Court', 'Finance Commission'],
      e: 'The Election Commission supervises and conducts elections.'
    },
    {
      subject: 'Polity', topic: 'Elections',
      q: 'Which body conducts national elections in India?',
      a: 'Election Commission of India',
      w: ['Union Cabinet', 'Supreme Court', 'Finance Commission'],
      e: 'The Election Commission supervises and conducts elections.'
    },
    { subject: '', q: 'Too short', a: '', w: [], e: 'No valid content' },
    {
      subject: 'Polity', topic: 'President',
      q: 'The President is elected by an electoral college consisting of elected members of both Houses of Parliament and elected members of State Legislative Assemblies across India.',
      a: 'Electoral college',
      w: ['Union Cabinet', 'Supreme Court', 'Election Commission'],
      e: 'The President is elected by a constitutional electoral college.'
    }
  ];
  await reviewFixture.locator('#qReviewBulkJson').fill(JSON.stringify(reviewRows));
  await reviewFixture.locator('#qReviewBulkPreviewBtn').click();
  await reviewFixture.waitForFunction(() => document.querySelector('#qReviewBulkSummary')?.textContent.includes('4 rows'));
  const previewAudit = await reviewFixture.evaluate(() => ({
    summary: document.querySelector('#qReviewBulkSummary').textContent,
    badges: [...document.querySelectorAll('#qReviewBulkPreview .qreview-preview-status')].map(el => el.textContent.trim()),
    importEnabled: !document.querySelector('#qReviewBulkImport').disabled,
    reportEnabled: !document.querySelector('#qReviewBulkExport').disabled
  }));
  if (!previewAudit.summary.includes('1 duplicate(s)') || !previewAudit.summary.includes('1 invalid') ||
      !previewAudit.summary.includes('1 similar-question warning(s)') ||
      previewAudit.badges.join('|') !== 'Ready|Duplicate|Invalid|Similar' ||
      !previewAudit.importEnabled || !previewAudit.reportEnabled) {
    throw new Error('Question bulk import preview validation mismatch: ' + JSON.stringify(previewAudit));
  }
  await reviewFixture.locator('#qReviewBulkImport').click();
  await reviewFixture.waitForFunction(() => document.querySelector('#qReviewBulkResult')?.textContent.includes('Imported 2 draft(s)'));
  const importAudit = await reviewFixture.evaluate(() => ({
    insertedCount: window.__reviewInserted.length,
    statuses: window.__reviewInserted.map(row => row.status),
    checks: window.__reviewInserted.map(row => row.review_checks),
    badges: [...document.querySelectorAll('#qReviewBulkPreview .qreview-preview-status')].map(el => el.textContent.trim())
  }));
  if (importAudit.insertedCount !== 2 || importAudit.statuses.some(value => value !== 'draft') ||
      importAudit.checks.some(value => Object.values(value || {}).some(Boolean)) ||
      importAudit.badges.join('|') !== 'Imported|Duplicate|Invalid|Imported') {
    throw new Error('Question bulk import did not preserve draft-only and validation rules: ' + JSON.stringify(importAudit));
  }
  const reportDownloadPromise = reviewFixture.waitForEvent('download');
  await reviewFixture.locator('#qReviewBulkExport').click();
  const reportDownload = await reportDownloadPromise;
  if (reportDownload.suggestedFilename() !== 'aspirants-desk-question-import-review.csv') {
    throw new Error('Question import review report filename was unexpected: ' + reportDownload.suggestedFilename());
  }
  const batchCard = reviewFixture.locator('.qreview-batch-card');
  if (await batchCard.count() !== 1 || !(await batchCard.innerText()).includes('Imported 2')) {
    throw new Error('Import batch history did not preserve the imported totals');
  }
  await reviewFixture.locator('[data-qreview-edit="inserted-0-0"]').click();
  await reviewFixture.waitForFunction(() => document.querySelector('#qReviewCompareResult')?.textContent.includes('Highlighted rows changed'));
  const compareAudit = await reviewFixture.evaluate(() => ({
    selectors: Boolean(document.querySelector('#qReviewCompareLeft') && document.querySelector('#qReviewCompareRight')),
    changedRows: document.querySelectorAll('#qReviewCompareResult .qreview-field-changed').length,
    questionText: document.querySelector('#qReviewCompareResult').innerText.includes('Which institution conducts national elections in India?')
  }));
  if (!compareAudit.selectors || compareAudit.changedRows < 1 || !compareAudit.questionText) {
    throw new Error('Side-by-side version comparison did not highlight changed question fields: ' + JSON.stringify(compareAudit));
  }
  const rollbackButton = reviewFixture.locator('.qreview-rollback');
  if (await rollbackButton.count() !== 1) throw new Error('Eligible import batch did not expose its rollback control');
  await rollbackButton.click();
  await reviewFixture.waitForFunction(() => document.querySelector('.qreview-batch-status')?.textContent.includes('rolled back'));
  const rollbackAudit = await reviewFixture.evaluate(() => ({
    batchStatus: document.querySelector('.qreview-batch-status')?.textContent.trim(),
    archived: window.__reviewInserted.length === 2 && window.__reviewInserted.every(row => row.status === 'archived'),
    rollbackMessage: document.querySelector('.qreview-batch-card')?.innerText.includes('2 question(s) archived')
  }));
  if (rollbackAudit.batchStatus !== 'rolled back' || !rollbackAudit.archived || !rollbackAudit.rollbackMessage) {
    throw new Error('Import batch rollback did not archive only its draft records: ' + JSON.stringify(rollbackAudit));
  }
  await reviewFixture.close();

  // Audit the published PYQ catalogue and its paper-level tracker. This guards
  // against a verified PDF being counted without a matching tracker row, and
  // against unverified question records becoming publicly available.
  const pyqAudit = await page.evaluate(async () => {
    const read = async path => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
      return response.json();
    };
    const [manifest, questions, inventory] = await Promise.all([
      read('data/pyq/verified-documents.json'),
      read('data/pyq/questions.json'),
      read('data/pyq/documents.json'),
    ]);
    const docs = Array.isArray(manifest.documents) ? manifest.documents : [];
    const rows = Array.isArray(inventory.documents) ? inventory.documents : [];
    const official = value => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && ['upsc.gov.in', 'www.upsc.gov.in'].includes(url.hostname);
      } catch { return false; }
    };
    const ids = docs.map(doc => doc.id);
    const invalidDocs = docs.filter(doc =>
      !doc || doc.status !== 'verified' || !doc.verification?.verified_at ||
      !doc.verification?.method || !doc.title || !official(doc.document_url)
    );
    const unmatchedDocs = docs.filter(doc => {
      const paper = doc.category === 'General Studies' ? 'General Studies ' + doc.paper
        : ['Optional', 'Literature'].includes(doc.category) ? 'Optional ' + doc.paper
        : doc.paper;
      const subject = ['Optional', 'Literature'].includes(doc.category) ? doc.subject : '';
      const matches = rows.filter(row =>
        row.year === doc.year && row.stage === doc.stage && row.paper === paper &&
        (row.optional_subject || '') === subject
      );
      return matches.length !== 1 || !['verified', 'published'].includes(matches[0]?.status) ||
        matches[0]?.document_url !== doc.document_url;
    });
    const invalidQuestions = (Array.isArray(questions) ? questions : []).filter(row =>
      !row || row.status !== 'published' || row.verification?.status !== 'verified' ||
      !row.question || !official(row.source?.document_url)
    );
    return {
      manifestCount: docs.length,
      uniqueIds: new Set(ids).size,
      invalidDocs: invalidDocs.length,
      unmatchedDocs: unmatchedDocs.length,
      trackerVerifiedCount: rows.filter(row => ['verified', 'published'].includes(row.status)).length,
      trackerPublishedCount: rows.filter(row => row.status === 'published').length,
      questionRows: Array.isArray(questions) ? questions.length : -1,
      invalidQuestions: invalidQuestions.length,
    };
  });
  if (!pyqAudit.manifestCount || pyqAudit.uniqueIds !== pyqAudit.manifestCount ||
      pyqAudit.invalidDocs || pyqAudit.unmatchedDocs ||
      pyqAudit.trackerVerifiedCount !== pyqAudit.manifestCount ||
      pyqAudit.invalidQuestions) {
    throw new Error('Published PYQ provenance audit failed: ' + JSON.stringify(pyqAudit));
  }
  // The PYQ page is intentionally login-gated. Activate its section in the
  // guest smoke-test DOM so public catalogue rendering/filter behavior can be
  // tested without bypassing the real navigation/authentication controls.
  await page.locator('#pyq').evaluate(el => el.classList.add('active'));
  // Verify that the official PDF catalogue filters independently of question records.
  const verifiedDocCards = page.locator('#verifiedPyqDocuments .verified-doc-card');
  await page.locator('#verifiedPyqDocuments').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('#verifiedPyqDocuments .verified-doc-card').length > 0, { timeout: 15000 });
  const allDocumentCards = await verifiedDocCards.count();
  if (allDocumentCards !== pyqAudit.manifestCount) {
    throw new Error('Verified PDF catalogue UI count does not match its manifest: ' + allDocumentCards + ' vs ' + pyqAudit.manifestCount);
  }
  // The paper-level coverage explorer must load the full inventory and filter safely.
  await page.waitForFunction(() => document.querySelector('#pyqExplorerTotal')?.textContent.includes('planned paper records'), { timeout: 15000 });
  const trackerTotal = await page.locator('#pyqExplorerTotal').innerText();
  if (!trackerTotal.includes('2,575')) throw new Error('PYQ coverage explorer did not load the expected paper inventory: ' + trackerTotal);
  const trackerRows = page.locator('#pyqTrackerRows tr');
  await page.locator('#pyqTrackerYear').selectOption('2024');
  if (await trackerRows.count() < 1 || await trackerRows.count() > 25) throw new Error('PYQ tracker year filter or pagination returned an unexpected row count');
  await page.locator('#pyqTrackerStatus').selectOption('verified');
  const verifiedTrackerRows = await trackerRows.count();
  if (verifiedTrackerRows < 1 || verifiedTrackerRows > 25) throw new Error('PYQ tracker verified-status filter returned an unexpected row count');
  const trackerStatuses = await page.locator('#pyqTrackerRows .pyq-status').allTextContents();
  if (trackerStatuses.some(value => value.trim() !== 'Verified')) throw new Error('PYQ tracker status filter returned a non-verified row');
  await page.locator('#pyqTrackerSubject').selectOption({ label: 'Anthropology' });
  const anthropologyRows = await trackerRows.count();
  if (anthropologyRows < 1 || anthropologyRows > 25) throw new Error('PYQ tracker optional-subject filter returned an unexpected row count');
  const anthropologySubjects = await page.locator('#pyqTrackerRows tr td:nth-child(4)').allTextContents();
  if (anthropologySubjects.some(value => value.trim() !== 'Anthropology')) throw new Error('PYQ tracker optional-subject filter returned a different subject');
  await page.locator('#pyqTrackerSearch').fill('Anthropology');
  if (await trackerRows.count() < 1) throw new Error('PYQ tracker search did not find verified Anthropology paper records');
  await page.locator('#pyqTrackerSearch').fill('');
  await page.locator('#pyqTrackerYear').selectOption('ALL');
  await page.locator('#pyqTrackerStage').selectOption('ALL');
  await page.locator('#pyqTrackerSubject').selectOption('ALL');
  await page.locator('#pyqTrackerStatus').selectOption('ALL');
  if (!(await page.locator('#pyqTrackerPageInfo').innerText()).includes('of 2,575 matching records')) {
    throw new Error('PYQ tracker reset did not restore the full inventory');
  }
  await page.locator('#verifiedPyqYear').selectOption('2021');
  if (await verifiedDocCards.count() !== 1) throw new Error('Verified PDF year filter did not isolate the 2021 document');
  await page.locator('#verifiedPyqYear').selectOption('ALL');
  await page.locator('#verifiedPyqStage').selectOption('Prelims');
  const prelimsDocumentCount = await verifiedDocCards.count();
  if (prelimsDocumentCount < 1 || prelimsDocumentCount >= allDocumentCards) throw new Error('Verified PDF stage filter returned an unexpected count: ' + prelimsDocumentCount);
  await page.locator('#verifiedPyqStage').selectOption('ALL');
  await page.locator('#verifiedPyqSearch').fill('Anthropology');
  const anthropologyDocumentCount = await verifiedDocCards.count();
  if (anthropologyDocumentCount < 1 || anthropologyDocumentCount >= allDocumentCards) throw new Error('Verified PDF search filter returned an unexpected count: ' + anthropologyDocumentCount);
  await page.locator('#verifiedPyqSearch').fill('');
  if (await verifiedDocCards.count() !== allDocumentCards) throw new Error('Clearing the verified PDF search did not restore all documents');
  await page.locator('#verifiedPyqCategory').selectOption('Optional');
  const optionalDocumentCount = await verifiedDocCards.count();
  if (optionalDocumentCount !== 5) throw new Error('Verified PDF category filter returned an unexpected Optional count: ' + optionalDocumentCount);
  await page.locator('#verifiedPyqCategory').selectOption('ALL');
  await page.locator('#verifiedPyqSearch').fill('no-such-upsc-paper-xyz');
  if (await verifiedDocCards.count() !== 0) throw new Error('Verified PDF search should return zero cards for a no-match query');
  if (!(await page.locator('#verifiedPyqDocuments').innerText()).includes('No verified paper documents match')) {
    throw new Error('Verified PDF no-match state is missing its helpful message');
  }
  await page.locator('#verifiedPyqSearch').fill('');
  if (await verifiedDocCards.count() !== allDocumentCards) throw new Error('Resetting all verified PDF filters did not restore the catalogue');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCatalogueLayout = await page.evaluate(() => {
    const host = document.querySelector('#verifiedPyqDocuments');
    const cards = [...host.querySelectorAll('.verified-doc-card')];
    return {
      viewport: document.documentElement.clientWidth,
      host: host.getBoundingClientRect().width,
      hostScroll: host.scrollWidth,
      cardsFit: cards.every(card => card.getBoundingClientRect().width <= document.documentElement.clientWidth + 2),
    };
  });
  if (mobileCatalogueLayout.hostScroll > mobileCatalogueLayout.host + 2 || !mobileCatalogueLayout.cardsFit) {
    throw new Error('Verified PDF catalogue overflows its mobile layout: ' + JSON.stringify(mobileCatalogueLayout));
  }
  await page.setViewportSize({ width: 1365, height: 900 });

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
  await page.waitForFunction(() => document.querySelector('#pushDiagnostics')?.innerText.includes('Account:'), { timeout: 10000 });
  if (!(await page.locator('#pushDiagnostics').innerText()).includes('Account:')) {
    throw new Error('Push diagnostics did not finish rendering the account check');
  }
  const ownerNav = page.locator('a[data-nav="admin"]');
  if (await ownerNav.count() !== 1 || !(await ownerNav.isHidden())) {
    throw new Error('Owner admin navigation must remain hidden for a guest visitor');
  }
  // Verify the published guest sign-in modal exposes password recovery without
  // sending a real email or requiring a test account.
  await page.locator('#topLoginBtn').click();
  await page.locator('#authModal').waitFor({ state: 'visible' });
  if (await page.locator('#btnForgotPassword').count() !== 1 ||
      !(await page.locator('#btnForgotPassword').isVisible())) {
    throw new Error('Guest sign-in modal is missing its Forgot password action');
  }
  if (!(await page.locator('#authRecoveryPanel').isHidden())) {
    throw new Error('Password reset form should remain hidden until a recovery link is opened');
  }
  await page.locator('#btnForgotPassword').click();
  const recoveryPrompt = await page.locator('#authFeedback').innerText();
  if (!recoveryPrompt.toLowerCase().includes('email')) {
    throw new Error('Forgot password should request an account email before sending a reset link: ' + recoveryPrompt);
  }
  await page.locator('#closeAuthModal').click();
  if (!(await page.locator('#authModal').isHidden())) {
    throw new Error('Sign-in modal did not close after password recovery UI check');
  }
  const title = await page.title();
  if (!title.includes("The Aspirant")) throw new Error('Unexpected page title: ' + title);
  // Personal learning analytics must be present, styled, and private in guest mode.
  const learningAnalyticsAudit = await page.evaluate(() => {
    const scripts = [...document.scripts].map(script => script.textContent || '').join('\\n');
    const report = document.querySelector('#tadWeeklyStudyReport');
    return {
      intelligence: Boolean(document.querySelector('#tadIntelligenceTitle')),
      subjectMix: Boolean(document.querySelector('#tadSubjectMix')),
      rhythmInsight: Boolean(document.querySelector('#tadRhythmInsight')),
      editorialStyles: [...document.styleSheets].some(sheet => sheet.href && sheet.href.includes('dashboard-editorial.css')),
      includesTodayEndBoundary: scripts.includes('todayEnd'),
      guestHasNoPersonalStudyRows: Boolean(report && report.querySelectorAll('.tad-week-day').length === 0 &&
        document.querySelector('#tadSubjectMix')?.querySelectorAll('.tad-subject-mix-row').length === 0)
    };
  });
  if (!learningAnalyticsAudit.intelligence || !learningAnalyticsAudit.subjectMix ||
      !learningAnalyticsAudit.rhythmInsight || !learningAnalyticsAudit.editorialStyles ||
      !learningAnalyticsAudit.includesTodayEndBoundary || !learningAnalyticsAudit.guestHasNoPersonalStudyRows) {
    throw new Error('Personal learning analytics UI/privacy/date-boundary audit failed: ' + JSON.stringify(learningAnalyticsAudit));
  }
  // Allow the desktop sidebar's responsive transform to settle after the mobile-layout check.
  await page.waitForTimeout(350);
  const anbuuNav = page.locator('#sidebar a.nav-link[data-nav="anbuu"]');
  if (await anbuuNav.count() !== 1) {
    throw new Error('Anbuu main-navigation tab is missing from the sidebar');
  }
  await anbuuNav.scrollIntoViewIfNeeded();
  const anbuuNavState = await anbuuNav.evaluate(el => {
    const sidebar = document.querySelector('#sidebar');
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
    return {
      viewportWidth: document.documentElement.clientWidth,
      display: style.display,
      visibility: style.visibility,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      sidebarDisplay: sidebarStyle?.display ?? 'missing',
      sidebarVisibility: sidebarStyle?.visibility ?? 'missing',
      sidebarTransform: sidebarStyle?.transform ?? 'missing',
      loginGate: Boolean(el.querySelector('.lock-tag')),
      requiresAuth: el.classList.contains('requires-auth'),
    };
  });
  if (!(await anbuuNav.isVisible()) || !anbuuNavState.requiresAuth || !anbuuNavState.loginGate) {
    throw new Error('Anbuu main-navigation tab must be visible with a login gate for guest visitors: ' + JSON.stringify(anbuuNavState));
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
  const aiDeskScriptResponse = await page.request.get(base + 'assets/js/ai-desk.js');
  if (!aiDeskScriptResponse.ok()) throw new Error('Anbuu client script could not be fetched for checkpoint regression checks');
  const aiDeskSource = await aiDeskScriptResponse.text();
  for (const required of ['update_lesson_checkpoint', 'Understand the concept', 'Attempt practice', 'Complete a recap', 'Next priority:']) {
    if (!aiDeskSource.includes(required)) throw new Error('Anbuu learning checkpoint feature is missing: ' + required);
  }
  const lessonStudio = page.locator('.tad-anbuu-lesson-studio');
  if (await lessonStudio.count() !== 1) throw new Error('Anbuu guided-learning studio is missing');
  for (const selector of ['#tadLessonTrack', '#tadLessonSubject', '#tadLessonTopic', '#tadLessonLanguage', '#tadLessonLevel', '#tadStartLesson']) {
    if (await page.locator(selector).count() !== 1) throw new Error('Anbuu lesson control is missing: ' + selector);
  }
  const lessonLanguage = page.locator('#tadLessonLanguage');
  const languageChoices = await lessonLanguage.locator('option').allTextContents();
  if (languageChoices.length !== 3 || !languageChoices.some(value => value.includes('Tamil + English'))) {
    throw new Error('Anbuu lesson language choices must include English, Tamil and Tamil + English');
  }
  if (await lessonLanguage.inputValue() !== 'Tamil and English') {
    throw new Error('Anbuu guided lessons should default to bilingual Tamil + English teaching');
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
  for (const label of ['Understand the concept', 'Attempt practice', 'Complete a recap']) {
    if (!(await page.locator('#tadLessonHistoryList').count())) throw new Error('Anbuu lesson history host is missing for checkpoint rendering');
  }
  const checkpointStyles = await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.includes('ai-desk.css')));
  if (!checkpointStyles) throw new Error('Anbuu checkpoint styles are not loaded');
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

  // Mobile navigation regression check: the compact menu must open, route to a
  // public section, close again, and avoid horizontal page overflow.
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  mobilePage.on('pageerror', error => pageErrors.push('mobile: ' + error.message));
  mobilePage.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(base).origin) failedLocalRequests.push('mobile: ' + request.url() + ' :: ' + (request.failure()?.errorText || 'failed'));
  });
  await mobilePage.goto(base, { waitUntil: 'domcontentloaded' });
  await mobilePage.locator('#home').waitFor({ state: 'visible', timeout: 15000 });
  const mobileMenu = mobilePage.locator('#menuToggle');
  if (!(await mobileMenu.isVisible())) throw new Error('Mobile navigation menu button is not visible');
  await mobileMenu.click();
  if (await mobileMenu.getAttribute('aria-expanded') !== 'true') throw new Error('Mobile navigation did not report its expanded state');
  if (!(await mobilePage.locator('#sidebar').evaluate(el => el.classList.contains('open')))) throw new Error('Mobile sidebar did not open');
  await mobilePage.locator('.nav-link[data-nav="about-app"]').click();
  if (!(await mobilePage.locator('#about-app').evaluate(el => el.classList.contains('active')))) throw new Error('Mobile navigation did not open the selected public section');
  if (await mobilePage.locator('#sidebar').evaluate(el => el.classList.contains('open'))) throw new Error('Mobile sidebar did not close after selecting a section');
  const mobileLayout = await mobilePage.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    mainVisible: !!document.querySelector('#about-app.active')
  }));
  if (mobileLayout.document > mobileLayout.viewport + 1) throw new Error('Mobile page has horizontal overflow: ' + JSON.stringify(mobileLayout));
  await mobilePage.setViewportSize({ width: 320, height: 720 });
  const narrowLayout = await mobilePage.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  if (narrowLayout.document > narrowLayout.viewport + 1) throw new Error('Narrow mobile page has horizontal overflow: ' + JSON.stringify(narrowLayout));
  await mobilePage.close();
  if (pageErrors.length) throw new Error('Browser runtime errors: ' + pageErrors.join(' | '));
  if (failedLocalRequests.length) throw new Error('Failed same-origin requests: ' + failedLocalRequests.join(' | '));
  console.log(JSON.stringify({ result: 'PASS', url: base, title, anbuuNavigation: true, anbuuPage: true, aiForm, revisionTab: true, cssLoaded: css, pageErrors, failedLocalRequests }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', message: error.message, pageErrors, failedLocalRequests }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}