const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const app = require('../../backend/server.js');
const db = require('../../backend/db/database.js');
const sandboxManager = require('../../backend/fixes/sandbox-manager.js');
const faultInjector = require('../../backend/fixes/fault-injector.js');
const fixEngine = require('../../backend/fixes/fix-engine.js');
const Crawler = require('../../backend/crawler/crawler.js');
const ruleEngine = require('../../backend/rules/rule-engine.js');

test('SearchForge Live SEO Operations Center Integration Suite', async (t) => {
  let server;
  let port;
  let baseUrl;

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  await t.test('1. Static routes & SEO server routing are active', async () => {
    // Root route
    const resRoot = await fetch(`${baseUrl}/`);
    assert.strictEqual(resRoot.status, 200);
    const htmlRoot = await resRoot.text();
    assert.ok(htmlRoot.includes('SearchForge SEO'));

    // Operations Center UI route
    const resOps = await fetch(`${baseUrl}/operations-center.html`);
    assert.strictEqual(resOps.status, 200);
    const htmlOps = await resOps.text();
    assert.ok(htmlOps.includes('Live SEO Operations Center'));

    // Intentional 404 test route (SEO-003)
    const res404 = await fetch(`${baseUrl}/services/social-media-seo.html`);
    assert.strictEqual(res404.status, 404);

    // Redirect chain (SEO-012)
    const resRedir = await fetch(`${baseUrl}/old-audit`, { redirect: 'manual' });
    assert.strictEqual(resRedir.status, 302);
    assert.ok(resRedir.headers.get('location').includes('audit-temp'));
  });

  await t.test('2. Sandbox security & path traversal defense', async () => {
    // Reset sandbox
    sandboxManager.reset();

    // Verify valid allowlisted path
    const safe = sandboxManager.resolveSafePath('case-studies/retail-growth.html');
    assert.ok(safe.fullPath.includes(path.join('tests', 'fixtures', 'sandbox')));

    // Verify invalid or non-allowlisted path is rejected
    assert.throws(() => {
      sandboxManager.resolveSafePath('package.json');
    }, /Access Denied/);

    // Verify path traversal is rejected
    assert.throws(() => {
      sandboxManager.resolveSafePath('../../server.ps1');
    }, /Access Denied/);
  });

  await t.test('3. Fault injection & unified diff preview (SEO-005)', async () => {
    sandboxManager.reset();

    // Inject SEO-005
    const injectResult = faultInjector.inject('SEO-005');
    assert.strictEqual(injectResult.success, true);
    assert.strictEqual(injectResult.issueId, 'SEO-005');

    // Verify sandbox file contains noindex
    const flawedContent = sandboxManager.readFile('case-studies/retail-growth.html');
    assert.ok(flawedContent.includes('content="noindex, follow"'));

    // Verify preview produces valid diff
    const preview = fixEngine.previewFix('SEO-005');
    assert.strictEqual(preview.canAutoFix, true);
    assert.ok(preview.diff.includes('sandbox/case-studies/retail-growth.html'));
    assert.ok(preview.diff.includes('+'));
    assert.ok(preview.diff.includes('-'));
  });

  await t.test('4. Live crawl execution, SSE events, and rule detection', async () => {
    const runId = `test_run_${Date.now()}`;
    const targetUrl = `${baseUrl}/sandbox/case-studies/retail-growth.html`;
    db.createAudit(runId, targetUrl);

    const crawler = new Crawler(runId, {
      targetUrl,
      maxPages: 10,
      maxDepth: 3,
      isSandbox: true
    });

    const summary = await crawler.run(ruleEngine);
    assert.ok(summary.crawledCount > 0);
    assert.strictEqual(summary.status, 'completed');

    // Verify findings in SQLite
    const findings = db.getFindings(runId);
    assert.ok(findings.length > 0);

    // Finding SEO-005 must be detected with inspectable evidence
    const finding005 = findings.find(f => f.issueId === 'SEO-005');
    assert.ok(finding005, 'Expected finding SEO-005 to be detected in flawed sandbox');
    assert.strictEqual(finding005.severity, 'Critical');
    assert.ok(finding005.evidence.robotsMetaSnippet.includes('noindex'));

    // Verify events recorded monotonically in SQLite
    const events = db.getEvents(runId);
    assert.ok(events.length >= 5);
    for (let i = 1; i < events.length; i++) {
      assert.ok(events[i].eventId > events[i - 1].eventId, 'Event IDs must be monotonic');
    }
  });

  await t.test('5. Safe sandbox fix application & atomic backup', async () => {
    const runId = `fix_run_${Date.now()}`;
    const applyResult = fixEngine.applyFix('SEO-005', runId);
    assert.strictEqual(applyResult.success, true);
    assert.ok(applyResult.backupId);

    // Verify sandbox file is rescued
    const rescuedContent = sandboxManager.readFile('case-studies/retail-growth.html');
    assert.ok(rescuedContent.includes('content="index, follow"'));
    assert.ok(!/<meta\s+name=["']robots["']\s+content=["']noindex/i.test(rescuedContent));

    // Verify backup exists in SQLite
    const backup = db.getBackup(applyResult.backupId);
    assert.strictEqual(backup.status, 'applied');
    assert.strictEqual(backup.issue_id, 'SEO-005');

    // Rollback test
    const rollbackResult = fixEngine.rollback(applyResult.backupId, runId);
    assert.strictEqual(rollbackResult.success, true);

    // Verify file returned to flawed state
    const rolledBackContent = sandboxManager.readFile('case-studies/retail-growth.html');
    assert.ok(/<meta\s+name=["']robots["']\s+content=["']noindex/i.test(rolledBackContent));
  });

  await t.test('6. Downloadable report evidence endpoints', async () => {
    const runId = `report_run_${Date.now()}`;
    db.createAudit(runId, `${baseUrl}/sandbox/index.html`);
    db.finishAudit(runId, 'completed', { healthScore: 92, crawledCount: 8 });

    // JSON report
    const resJson = await fetch(`${baseUrl}/api/audits/${runId}/report?format=json`);
    assert.strictEqual(resJson.status, 200);
    const dataJson = await resJson.json();
    assert.strictEqual(dataJson.metadata.runId, runId);
    assert.strictEqual(dataJson.summary.healthScore, 92);

    // HTML report
    const resHtml = await fetch(`${baseUrl}/api/audits/${runId}/report?format=html`);
    assert.strictEqual(resHtml.status, 200);
    const textHtml = await resHtml.text();
    assert.ok(textHtml.includes('Technical SEO Live Audit Report'));
    assert.ok(textHtml.includes(runId));
  });
});
