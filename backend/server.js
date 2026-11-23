const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const db = require('./db/database.js');
const eventHub = require('./telemetry/event-hub.js');
const Crawler = require('./crawler/crawler.js');
const ruleEngine = require('./rules/rule-engine.js');
const faultInjector = require('./fixes/fault-injector.js');
const fixEngine = require('./fixes/fix-engine.js');
const sandboxManager = require('./fixes/sandbox-manager.js');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const SANDBOX_DIR = path.resolve(ROOT_DIR, 'tests', 'fixtures', 'sandbox');

app.use(cors());
app.use(express.json());

// In-memory active crawlers map for cancellation
const activeCrawlers = new Map();

// --- CONTROLLED SEO TEST ROUTES (FOR REAL SERVER BEHAVIOR) ---

// SEO-012: Redirect chain testing routes
app.get('/old-audit', (req, res) => {
  res.redirect(302, '/audit-temp');
});
app.get('/audit-temp', (req, res) => {
  res.redirect(302, '/services/seo-audits.html');
});
app.get('/sandbox/old-audit', (req, res) => {
  res.redirect(302, '/sandbox/audit-temp');
});
app.get('/sandbox/audit-temp', (req, res) => {
  res.redirect(302, '/sandbox/services/seo-audits.html');
});

// SEO-003: Intentional 404 route for broken internal link
app.get('/services/social-media-seo.html', (req, res) => {
  const notFoundHtml = fs.readFileSync(path.join(ROOT_DIR, '404.html'), 'utf8');
  res.status(404).type('html').send(notFoundHtml);
});
app.get('/sandbox/services/social-media-seo.html', (req, res) => {
  const notFoundHtml = fs.readFileSync(path.join(ROOT_DIR, '404.html'), 'utf8');
  res.status(404).type('html').send(notFoundHtml);
});

// SEO-015: Soft 404 test probe vs true 404
app.get('/soft-404-test', (req, res) => {
  // Returns HTTP 200 with 404 content (flawed soft 404)
  const notFoundHtml = fs.readFileSync(path.join(ROOT_DIR, '404.html'), 'utf8');
  res.status(200).type('html').send(notFoundHtml);
});

// --- API CONTRACT IMPLEMENTATION ---

// POST /api/audits - create a crawl run
app.post('/api/audits', async (req, res) => {
  try {
    const { targetUrl, maxPages = 30, maxDepth = 4 } = req.body;
    const defaultTarget = `http://localhost:${PORT}/sandbox/index.html`;
    const finalTarget = targetUrl || defaultTarget;

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const auditRecord = db.createAudit(runId, finalTarget);

    const crawler = new Crawler(runId, {
      targetUrl: finalTarget,
      maxPages: Math.min(Number(maxPages) || 30, 60),
      maxDepth: Math.min(Number(maxDepth) || 4, 6),
      isSandbox: finalTarget.includes('/sandbox/')
    });

    activeCrawlers.set(runId, crawler);

    // Kick off crawl asynchronously in background
    (async () => {
      try {
        const summary = await crawler.run(ruleEngine);
        const findings = db.getFindings(runId);
        const criticalCount = findings.filter(f => f.severity === 'Critical').length;
        const highCount = findings.filter(f => f.severity === 'High').length;
        const mediumCount = findings.filter(f => f.severity === 'Medium').length;
        const lowCount = findings.filter(f => f.severity === 'Low').length;

        // Calculate measured health score
        let score = 100 - (criticalCount * 15) - (highCount * 8) - (mediumCount * 3) - (lowCount * 1);
        if (score < 0) score = 0;

        const auditSummary = {
          ...summary,
          totalFindings: findings.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          healthScore: score
        };

        db.finishAudit(runId, summary.status, auditSummary);
      } catch (err) {
        eventHub.publish({
          runId,
          stage: 'verify',
          level: 'error',
          message: `Audit failed: ${err.message}`,
          status: 'failed'
        });
        db.finishAudit(runId, 'failed', { error: err.message });
      } finally {
        activeCrawlers.delete(runId);
      }
    })();

    res.status(201).json({
      success: true,
      runId,
      status: 'running',
      targetUrl: finalTarget,
      message: 'Audit crawl initiated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audits - list all runs
app.get('/api/audits', (req, res) => {
  const audits = db.listAudits();
  res.json({ success: true, audits });
});

// GET /api/audits/:id - run status and metrics
app.get('/api/audits/:id', (req, res) => {
  const audit = db.getAudit(req.params.id);
  if (!audit) {
    return res.status(404).json({ success: false, error: 'Audit run not found' });
  }
  const findings = db.getFindings(req.params.id);
  res.json({
    success: true,
    audit,
    findingsCount: findings.length,
    findings
  });
});

// GET /api/audits/:id/events - SSE stream of structured events
app.get('/api/audits/:id/events', (req, res) => {
  const runId = req.params.id;
  const lastEventId = parseInt(req.headers['last-event-id'] || req.query.lastEventId || '0', 10);
  eventHub.subscribe(runId, res, req, lastEventId);
});

// GET /api/audits/:id/findings - evidence-backed findings
app.get('/api/audits/:id/findings', (req, res) => {
  const findings = db.getFindings(req.params.id);
  res.json({ success: true, runId: req.params.id, findings });
});

// GET /api/audits/:id/graph - crawl link graph nodes and edges
app.get('/api/audits/:id/graph', (req, res) => {
  const edges = db.getCrawlEdges(req.params.id);
  const nodesMap = new Map();

  for (const edge of edges) {
    if (!nodesMap.has(edge.fromUrl)) {
      nodesMap.set(edge.fromUrl, { id: edge.fromUrl, label: new URL(edge.fromUrl).pathname, statusCode: 200 });
    }
    if (!nodesMap.has(edge.toUrl)) {
      nodesMap.set(edge.toUrl, { id: edge.toUrl, label: new URL(edge.toUrl).pathname, statusCode: edge.statusCode });
    }
  }

  res.json({
    success: true,
    runId: req.params.id,
    nodes: Array.from(nodesMap.values()),
    edges
  });
});

// POST /api/demo/inject - introduce an allowlisted fault into sandbox
app.post('/api/demo/inject', (req, res) => {
  try {
    const { issueId, runId } = req.body;
    if (!issueId) {
      return res.status(400).json({ success: false, error: 'Missing required issueId' });
    }
    const result = faultInjector.inject(issueId, runId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/demo/reset - reset sandbox to pristine baseline
app.post('/api/demo/reset', (req, res) => {
  try {
    const result = sandboxManager.reset();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/demo/scenarios - list available scenarios
app.get('/api/demo/scenarios', (req, res) => {
  res.json({
    success: true,
    scenarios: faultInjector.getAvailableFaults()
  });
});

// POST /api/fixes/preview - return proposed diff
app.post('/api/fixes/preview', (req, res) => {
  try {
    const { issueId } = req.body;
    if (!issueId) {
      return res.status(400).json({ success: false, error: 'Missing required issueId' });
    }
    const preview = fixEngine.previewFix(issueId);
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/fixes/apply - apply approved sandbox-only patch
app.post('/api/fixes/apply', (req, res) => {
  try {
    const { issueId, runId, findingId } = req.body;
    if (!issueId) {
      return res.status(400).json({ success: false, error: 'Missing required issueId' });
    }
    const result = fixEngine.applyFix(issueId, runId, findingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/fixes/rollback - restore backup
app.post('/api/fixes/rollback', (req, res) => {
  try {
    const { backupId, runId } = req.body;
    if (!backupId) {
      return res.status(400).json({ success: false, error: 'Missing required backupId' });
    }
    const result = fixEngine.rollback(backupId, runId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/audits/:id/cancel - stop pending work
app.post('/api/audits/:id/cancel', (req, res) => {
  const crawler = activeCrawlers.get(req.params.id);
  if (crawler) {
    crawler.cancel();
    activeCrawlers.delete(req.params.id);
    db.finishAudit(req.params.id, 'cancelled', { cancelledByUser: true });
    res.json({ success: true, message: `Audit ${req.params.id} cancelled.` });
  } else {
    res.status(404).json({ success: false, message: 'No active crawler found for this run.' });
  }
});

// GET /api/audits/:id/report - downloadable audit evidence (json and printable HTML)
app.get('/api/audits/:id/report', (req, res) => {
  const audit = db.getAudit(req.params.id);
  if (!audit) {
    return res.status(404).send('Audit run not found');
  }

  const findings = db.getFindings(req.params.id);
  const events = db.getEvents(req.params.id);
  const edges = db.getCrawlEdges(req.params.id);

  if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
    res.setHeader('Content-Disposition', `attachment; filename="SearchForge_Audit_${audit.id}.json"`);
    return res.json({
      metadata: {
        brand: 'SearchForge SEO - Technical SEO Operations Center',
        generatedAt: new Date().toISOString(),
        runId: audit.id,
        targetUrl: audit.target_url,
        status: audit.status,
        createdAt: audit.created_at,
        completedAt: audit.completed_at
      },
      summary: audit.summary,
      findings,
      eventsCount: events.length,
      edgesCount: edges.length
    });
  }

  // Printable HTML Report
  const score = audit.summary?.healthScore ?? 100;
  const criticalCount = audit.summary?.criticalCount ?? 0;
  const highCount = audit.summary?.highCount ?? 0;

  const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SEO Audit Proof & Dossier - ${audit.id} | SearchForge SEO</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0D0D0D; color: #E5E5E5; margin: 0; padding: 40px; }
    .report-card { max-width: 900px; margin: 0 auto; background: #181818; border: 1px solid #262626; border-radius: 12px; padding: 32px; }
    .header { border-bottom: 2px solid #FD6909; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { margin: 0; font-size: 24px; color: #FFFFFF; }
    .badge { background: #FD6909; color: #FFF; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; }
    .score-banner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .metric-box { background: #222; padding: 16px; border-radius: 8px; border: 1px solid #333; text-align: center; }
    .metric-val { font-size: 28px; font-weight: 800; color: #FD6909; margin-top: 4px; }
    .metric-lbl { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { text-align: left; padding: 10px; background: #262626; color: #AAA; border-bottom: 1px solid #333; }
    td { padding: 10px; border-bottom: 1px solid #262626; vertical-align: top; }
    .severity-Critical { color: #EF4444; font-weight: bold; }
    .severity-High { color: #F97316; font-weight: bold; }
    .severity-Medium { color: #EAB308; }
    .code-snippet { background: #111; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #10B981; }
    @media print {
      body { background: #FFF; color: #000; padding: 0; }
      .report-card { border: none; background: #FFF; }
      .metric-box { background: #F5F5F5; border: 1px solid #DDD; }
      .metric-val { color: #D9480F; }
      th { background: #EEE; color: #333; }
      td { border-bottom: 1px solid #DDD; }
      .code-snippet { background: #F0F0F0; color: #065F46; }
    }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <div>
        <span class="badge">EVIDENCE-BACKED PROOF</span>
        <h1 style="margin-top: 8px;">Technical SEO Live Audit Report</h1>
        <p style="color: #888; margin: 4px 0 0 0; font-size: 13px;">Run ID: ${audit.id} · Target: ${audit.target_url}</p>
      </div>
      <div style="text-align: right;">
        <button onclick="window.print()" style="background:#FD6909; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">Print / Save as PDF</button>
        <p style="color:#888; font-size:12px; margin:4px 0 0 0;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      </div>
    </div>

    <div class="score-banner">
      <div class="metric-box">
        <div class="metric-lbl">Measured Health Score</div>
        <div class="metric-val">${score} / 100</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">Total Crawled Pages</div>
        <div class="metric-val">${audit.summary?.crawledCount ?? 0}</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">Critical Issues</div>
        <div class="metric-val" style="color: #EF4444;">${criticalCount}</div>
      </div>
      <div class="metric-box">
        <div class="metric-lbl">High Severity Issues</div>
        <div class="metric-val" style="color: #F97316;">${highCount}</div>
      </div>
    </div>

    <h2 style="font-size: 18px; margin-top: 32px; border-bottom: 1px solid #333; padding-bottom: 8px;">Audit Findings & Evidence Log</h2>
    ${findings.length === 0 ? '<p style="color:#10B981; font-weight:600;">No SEO defects detected! Site complies 100% with technical SEO standards.</p>' : `
    <table>
      <thead>
        <tr>
          <th>Issue ID</th>
          <th>Severity</th>
          <th>Affected URL</th>
          <th>Symptom & Root Cause</th>
          <th>Verified Evidence & Remediation</th>
        </tr>
      </thead>
      <tbody>
        ${findings.map(f => `
          <tr>
            <td style="font-weight: bold; color: #FD6909;">${f.issueId}</td>
            <td class="severity-${f.severity}">${f.severity}</td>
            <td style="word-break: break-all;"><code>${f.url}</code></td>
            <td>
              <strong>${f.title}</strong><br>
              <span style="color: #AAA;">${f.symptom}</span>
            </td>
            <td>
              <div class="code-snippet">${typeof f.evidence === 'object' ? JSON.stringify(f.evidence, null, 2) : (f.evidence || 'N/A')}</div>
              <div style="margin-top: 4px; color: #10B981; font-size: 11px;">Fix: ${f.suggestedRemediation}</div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    `}

    <h2 style="font-size: 18px; margin-top: 32px; border-bottom: 1px solid #333; padding-bottom: 8px;">Execution Verification Details</h2>
    <p style="font-size: 13px; color: #888;">
      Status: <strong>${audit.status}</strong> · Duration: <strong>${audit.summary?.durationMs ?? 0}ms</strong> · Events Recorded: <strong>${events.length}</strong> · Crawl Edges Mapped: <strong>${edges.length}</strong>
    </p>
  </div>
</body>
</html>
  `;

  res.send(htmlReport);
});

// --- STATIC ROUTING & SANDBOX ISOLATION ---

// Serve the isolated sandbox directory at /sandbox/
app.use('/sandbox', express.static(SANDBOX_DIR));

// Serve root project static files (preserving original 18 routes, HUD, Inspector, and styling)
app.use(express.static(ROOT_DIR));

// Fallback 404 handler for unrecognized routes
app.use((req, res) => {
  const notFoundHtml = fs.readFileSync(path.join(ROOT_DIR, '404.html'), 'utf8');
  res.status(404).type('html').send(notFoundHtml);
});

// Start Server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(` SearchForge Live SEO Operations Center Server Running!`);
    console.log(` Web App URL:          http://localhost:${PORT}/`);
    console.log(` Operations Center:    http://localhost:${PORT}/operations-center.html`);
    console.log(` Isolated Sandbox:     http://localhost:${PORT}/sandbox/`);
    console.log(` Audit Hub:            http://localhost:${PORT}/audit.html`);
    console.log(`========================================================`);
  });
}

module.exports = app;
