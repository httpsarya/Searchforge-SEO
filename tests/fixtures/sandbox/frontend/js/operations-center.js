/**
 * SearchForge SEO - Live SEO Operations Center Controller
 * Connects to Node.js backend SSE, coordinates real-time crawl graph, fault injection, diff previews, and audit reports.
 */

(function () {
  'use strict';

  // State
  let currentRunId = null;
  let eventSource = null;
  let crawlGraph = { nodes: new Map(), edges: [] };
  let findingsList = [];
  let isAutoScroll = true;
  let canvas, ctx;
  let animationFrameId = null;

  // DOM Elements
  const el = {
    btnStartCrawl: document.getElementById('btn-start-crawl'),
    btnCancelCrawl: document.getElementById('btn-cancel-crawl'),
    btnResetSandbox: document.getElementById('btn-reset-sandbox'),
    btnExportReport: document.getElementById('btn-export-report'),
    btnExportJson: document.getElementById('btn-export-json'),
    btnMentorDemo: document.getElementById('btn-mentor-demo'),
    selectScenario: document.getElementById('select-scenario'),
    btnInjectScenario: document.getElementById('btn-inject-scenario'),
    selectPastRuns: document.getElementById('select-past-runs'),
    targetUrlInput: document.getElementById('input-target-url'),
    maxPagesInput: document.getElementById('input-max-pages'),
    
    // Metrics
    metricScore: document.getElementById('metric-score'),
    metricPages: document.getElementById('metric-pages'),
    metricCritical: document.getElementById('metric-critical'),
    metricHigh: document.getElementById('metric-high'),
    metricDuration: document.getElementById('metric-duration'),
    crawlStatusBadge: document.getElementById('crawl-status-badge'),
    
    // Console
    consoleLogs: document.getElementById('console-logs'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    chkAutoScroll: document.getElementById('chk-autoscroll'),
    filterStage: document.getElementById('filter-stage'),
    
    // Findings & Graph
    findingsContainer: document.getElementById('findings-container'),
    findingsCount: document.getElementById('findings-count'),
    graphCanvas: document.getElementById('crawl-graph-canvas'),
    
    // Modal
    diffModal: document.getElementById('diff-modal'),
    diffTitle: document.getElementById('diff-title'),
    diffFile: document.getElementById('diff-file'),
    diffContainer: document.getElementById('diff-container'),
    btnConfirmApplyFix: document.getElementById('btn-confirm-apply-fix'),
    btnCloseDiffModal: document.getElementById('btn-close-diff-modal')
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initCanvas();
    setupEventListeners();
    loadPastAudits();
    loadScenarioList();
  }

  function setupEventListeners() {
    if (el.btnStartCrawl) el.btnStartCrawl.addEventListener('click', startCrawl);
    if (el.btnCancelCrawl) el.btnCancelCrawl.addEventListener('click', cancelCrawl);
    if (el.btnResetSandbox) el.btnResetSandbox.addEventListener('click', resetSandbox);
    if (el.btnMentorDemo) el.btnMentorDemo.addEventListener('click', runMentorDemo);
    if (el.btnInjectScenario) el.btnInjectScenario.addEventListener('click', injectSelectedScenario);
    if (el.selectPastRuns) el.selectPastRuns.addEventListener('change', onPastRunSelected);
    if (el.btnClearLogs) el.btnClearLogs.addEventListener('click', () => { el.consoleLogs.innerHTML = ''; });
    if (el.chkAutoScroll) el.chkAutoScroll.addEventListener('change', (e) => { isAutoScroll = e.target.checked; });
    if (el.btnExportReport) el.btnExportReport.addEventListener('click', exportReportHtml);
    if (el.btnExportJson) el.btnExportJson.addEventListener('click', exportReportJson);
    if (el.btnCloseDiffModal) el.btnCloseDiffModal.addEventListener('click', closeDiffModal);
  }

  // --- CRAWL ACTIONS ---

  async function startCrawl() {
    try {
      const targetUrl = el.targetUrlInput.value.trim() || `http://${window.location.host}/sandbox/index.html`;
      const maxPages = parseInt(el.maxPagesInput.value, 10) || 30;

      updateStatusUI('running', 'Initiating Crawl...');
      resetStateForNewRun();

      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, maxPages, maxDepth: 4 })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to start audit');

      currentRunId = data.runId;
      appendLog({
        eventId: 0,
        timestamp: new Date().toISOString(),
        stage: 'queue',
        level: 'info',
        message: `Audit Run ID: ${currentRunId} created. Connecting SSE telemetry stream...`
      });

      connectSSE(currentRunId);
    } catch (err) {
      alert(`Error starting crawl: ${err.message}`);
      updateStatusUI('failed', 'Error');
    }
  }

  async function cancelCrawl() {
    if (!currentRunId) return;
    try {
      await fetch(`/api/audits/${currentRunId}/cancel`, { method: 'POST' });
      appendLog({
        eventId: 0,
        timestamp: new Date().toISOString(),
        stage: 'queue',
        level: 'warn',
        message: 'Cancellation requested by user.'
      });
      updateStatusUI('cancelled', 'Cancelled');
    } catch (err) {
      console.error(err);
    }
  }

  function resetStateForNewRun() {
    findingsList = [];
    crawlGraph = { nodes: new Map(), edges: [] };
    renderFindings();
    el.consoleLogs.innerHTML = '';
    el.metricPages.textContent = '0';
    el.metricCritical.textContent = '0';
    el.metricHigh.textContent = '0';
    el.metricScore.textContent = '--';
    el.metricDuration.textContent = '0ms';
  }

  // --- SSE TELEMETRY STREAM ---

  function connectSSE(runId) {
    if (eventSource) eventSource.close();

    eventSource = new EventSource(`/api/audits/${runId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        handleIncomingEvent(ev);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  }

  function handleIncomingEvent(ev) {
    appendLog(ev);

    // Update graph nodes and edges
    if (ev.url) {
      if (!crawlGraph.nodes.has(ev.url)) {
        crawlGraph.nodes.set(ev.url, {
          id: ev.url,
          label: formatUrlPath(ev.url),
          status: ev.status === 'error' ? 404 : 200,
          stage: ev.stage,
          x: Math.random() * (canvas.width - 100) + 50,
          y: Math.random() * (canvas.height - 100) + 50,
          vx: 0,
          vy: 0
        });
      } else {
        const node = crawlGraph.nodes.get(ev.url);
        if (ev.status === 'error') node.status = 404;
        node.stage = ev.stage;
      }
      el.metricPages.textContent = crawlGraph.nodes.size;
    }

    if (ev.elapsedMs) {
      el.metricDuration.textContent = `${ev.elapsedMs}ms`;
    }

    // Refresh findings when rule fires
    if (ev.stage === 'rule' && ev.issueId) {
      refreshFindings(currentRunId);
    }

    // Crawl completed or terminated
    if (ev.stage === 'verify' && (ev.status === 'completed' || ev.status === 'cancelled' || ev.status === 'failed')) {
      updateStatusUI(ev.status, ev.status.toUpperCase());
      refreshRunSummary(currentRunId);
      loadPastAudits();
    }
  }

  function appendLog(ev) {
    const row = document.createElement('div');
    row.className = `log-row log-${ev.level || 'info'}`;

    const time = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const stageBadge = `<span class="badge-stage stage-${ev.stage || 'queue'}">${ev.stage || 'sys'}</span>`;
    const issueBadge = ev.issueId ? `<span class="badge-issue">${ev.issueId}</span>` : '';
    const urlSpan = ev.url ? `<span class="log-url">${formatUrlPath(ev.url)}</span>` : '';

    row.innerHTML = `
      <span class="log-time">${time}</span>
      ${stageBadge}
      ${issueBadge}
      ${urlSpan}
      <span class="log-msg">${escapeHtml(ev.message)}</span>
    `;

    el.consoleLogs.appendChild(row);

    if (isAutoScroll) {
      el.consoleLogs.scrollTop = el.consoleLogs.scrollHeight;
    }
  }

  // --- FINDINGS & FIX ENGINE ---

  async function refreshFindings(runId) {
    try {
      const res = await fetch(`/api/audits/${runId}/findings`);
      const data = await res.json();
      if (data.success) {
        findingsList = data.findings;
        renderFindings();
        updateFindingMetrics();
      }
    } catch (err) {
      console.error('Error fetching findings:', err);
    }
  }

  function updateFindingMetrics() {
    const crit = findingsList.filter(f => f.severity === 'Critical').length;
    const high = findingsList.filter(f => f.severity === 'High').length;
    const med = findingsList.filter(f => f.severity === 'Medium').length;
    const low = findingsList.filter(f => f.severity === 'Low').length;

    el.metricCritical.textContent = crit;
    el.metricHigh.textContent = high;

    let score = 100 - (crit * 15) - (high * 8) - (med * 3) - (low * 1);
    if (score < 0) score = 0;
    el.metricScore.textContent = score;
    el.findingsCount.textContent = `(${findingsList.length})`;
  }

  function renderFindings() {
    if (findingsList.length === 0) {
      el.findingsContainer.innerHTML = `
        <div class="empty-findings">
          <p class="text-neutral-400">No issues detected or crawl not yet run. Click <strong>Start Live Crawl</strong> to analyze the sandbox.</p>
        </div>
      `;
      return;
    }

    el.findingsContainer.innerHTML = findingsList.map(f => `
      <div class="finding-card severity-border-${f.severity} ${f.status === 'fixed' ? 'is-fixed' : ''}">
        <div class="finding-header">
          <div class="flex items-center gap-2">
            <span class="badge-issue">${f.issueId}</span>
            <span class="badge-severity severity-${f.severity}">${f.severity}</span>
            <span class="badge-category">${f.category}</span>
            ${f.status === 'fixed' ? '<span class="badge-fixed">✓ PATCHED</span>' : ''}
          </div>
          <div class="finding-actions">
            ${f.fixable ? `
              <button class="btn-action-preview" onclick="SearchForgeOps.openDiffPreview('${f.issueId}', ${f.id})">
                ${f.status === 'fixed' ? 'Re-Inspect Diff' : 'Review Proposed Fix'}
              </button>
            ` : `
              <span class="manual-fix-tag">Manual Server Fix</span>
            `}
          </div>
        </div>
        <div class="finding-title">${escapeHtml(f.title)}</div>
        <div class="finding-url"><code>${escapeHtml(f.url)}</code></div>
        <div class="finding-symptom"><strong>Symptom:</strong> ${escapeHtml(f.symptom)}</div>
        
        <div class="finding-evidence-box">
          <div class="evidence-header">RAW OBSERVED EVIDENCE:</div>
          <pre><code>${escapeHtml(typeof f.evidence === 'object' ? JSON.stringify(f.evidence, null, 2) : f.evidence)}</code></pre>
        </div>

        <div class="finding-remediation">
          <strong>Recommended Remediation:</strong> ${escapeHtml(f.suggestedRemediation)}
        </div>
      </div>
    `).join('');
  }

  // --- DIFF MODAL & APPLY FIX ---

  let activeModalState = null;

  async function openDiffPreview(issueId, findingId) {
    try {
      const res = await fetch('/api/fixes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Preview failed');

      const p = data.preview;
      activeModalState = { issueId, findingId, preview: p };

      el.diffTitle.textContent = `Fix Proposal: [${issueId}] ${p.title || ''}`;
      el.diffFile.textContent = `Target File: sandbox/${p.file}`;

      // Render colorized unified diff
      el.diffContainer.innerHTML = renderColorizedDiff(p.diff || 'No diff detected.');
      el.btnConfirmApplyFix.onclick = applyActiveFix;
      el.diffModal.classList.remove('hidden');
    } catch (err) {
      alert(`Could not generate diff preview: ${err.message}`);
    }
  }

  function renderColorizedDiff(diffText) {
    const lines = diffText.split('\n');
    return lines.map(line => {
      let cls = 'diff-context';
      if (line.startsWith('+') && !line.startsWith('+++')) cls = 'diff-add';
      else if (line.startsWith('-') && !line.startsWith('---')) cls = 'diff-del';
      else if (line.startsWith('@@')) cls = 'diff-chunk';
      return `<div class="diff-line ${cls}">${escapeHtml(line)}</div>`;
    }).join('');
  }

  async function applyActiveFix() {
    if (!activeModalState) return;
    try {
      el.btnConfirmApplyFix.disabled = true;
      el.btnConfirmApplyFix.textContent = 'Applying Patch...';

      const res = await fetch('/api/fixes/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: activeModalState.issueId,
          runId: currentRunId,
          findingId: activeModalState.findingId
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Apply failed');

      alert(`Success: ${data.message}\nBackup ID: ${data.backupId}`);
      closeDiffModal();

      if (currentRunId) {
        refreshFindings(currentRunId);
      }
    } catch (err) {
      alert(`Error applying fix: ${err.message}`);
    } finally {
      el.btnConfirmApplyFix.disabled = false;
      el.btnConfirmApplyFix.textContent = 'Confirm & Apply to Sandbox';
    }
  }

  function closeDiffModal() {
    el.diffModal.classList.add('hidden');
    activeModalState = null;
  }

  // --- MENTOR GUIDED DEMO MODE ---

  async function runMentorDemo() {
    const confirm = window.confirm(
      "Run Guided Mentor Demonstration: SEO-005 (Accidental Noindex)?\n\n" +
      "This will automatically:\n" +
      "1. Reset sandbox to clean state\n" +
      "2. Inject <meta name='robots' content='noindex, follow'> into /case-studies/retail-growth.html\n" +
      "3. Start a real crawler run to observe the live defect"
    );
    if (!confirm) return;

    try {
      // 1. Reset
      await resetSandbox(false);
      appendLog({
        eventId: 0,
        stage: 'queue',
        level: 'info',
        message: 'Mentor Step 1: Sandbox cleanly initialized.'
      });

      // 2. Inject SEO-005
      const injRes = await fetch('/api/demo/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'SEO-005' })
      });
      const injData = await injRes.json();
      appendLog({
        eventId: 0,
        stage: 'rule',
        level: 'warn',
        issueId: 'SEO-005',
        message: `Mentor Step 2: Fault injected into sandbox: ${injData.message}`
      });

      // 3. Start crawl
      setTimeout(() => {
        startCrawl();
      }, 500);

    } catch (err) {
      alert(`Mentor demo failed: ${err.message}`);
    }
  }

  async function injectSelectedScenario() {
    const issueId = el.selectScenario.value;
    if (!issueId) return;

    try {
      const res = await fetch('/api/demo/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, runId: currentRunId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      alert(`Fault Injected: ${data.message}\nRun a crawl to detect it!`);
    } catch (err) {
      alert(`Error injecting fault: ${err.message}`);
    }
  }

  async function resetSandbox(notify = true) {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (notify) alert(data.message);
    } catch (err) {
      alert(`Failed to reset sandbox: ${err.message}`);
    }
  }

  // --- AUDIT HISTORY & REPORTS ---

  async function loadPastAudits() {
    try {
      const res = await fetch('/api/audits');
      const data = await res.json();
      if (data.success && el.selectPastRuns) {
        el.selectPastRuns.innerHTML = '<option value="">-- Select Historical Run --</option>' +
          data.audits.map(a => `
            <option value="${a.id}">${a.id} (${a.status}) - ${new Date(a.created_at).toLocaleTimeString()}</option>
          `).join('');
      }
    } catch (err) {}
  }

  async function onPastRunSelected() {
    const runId = el.selectPastRuns.value;
    if (!runId) return;

    currentRunId = runId;
    try {
      const res = await fetch(`/api/audits/${runId}`);
      const data = await res.json();
      if (data.success) {
        const audit = data.audit;
        updateStatusUI(audit.status, audit.status.toUpperCase());
        findingsList = data.findings;
        renderFindings();
        updateFindingMetrics();

        // Load graph
        loadGraphForRun(runId);
        // Load past logs
        loadEventsForRun(runId);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadEventsForRun(runId) {
    try {
      const res = await fetch(`/api/audits/${runId}/events`);
      // Or from SQLite endpoint
    } catch (err) {}
  }

  async function loadGraphForRun(runId) {
    try {
      const res = await fetch(`/api/audits/${runId}/graph`);
      const data = await res.json();
      if (data.success) {
        crawlGraph.edges = data.edges;
        for (const node of data.nodes) {
          crawlGraph.nodes.set(node.id, {
            ...node,
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            vx: 0,
            vy: 0
          });
        }
      }
    } catch (err) {}
  }

  async function loadScenarioList() {
    try {
      const res = await fetch('/api/demo/scenarios');
      const data = await res.json();
      if (data.success && el.selectScenario) {
        el.selectScenario.innerHTML = data.scenarios.map(s => `
          <option value="${s.id}">${s.id}: ${s.title}</option>
        `).join('');
      }
    } catch (err) {}
  }

  async function refreshRunSummary(runId) {
    try {
      const res = await fetch(`/api/audits/${runId}`);
      const data = await res.json();
      if (data.success && data.audit.summary) {
        const s = data.audit.summary;
        el.metricScore.textContent = s.healthScore ?? '--';
        el.metricPages.textContent = s.crawledCount ?? crawlGraph.nodes.size;
        el.metricDuration.textContent = `${s.durationMs ?? 0}ms`;
      }
    } catch (err) {}
  }

  function exportReportHtml() {
    if (!currentRunId) {
      alert('Please run or select an audit first.');
      return;
    }
    window.open(`/api/audits/${currentRunId}/report?format=html`, '_blank');
  }

  function exportReportJson() {
    if (!currentRunId) {
      alert('Please run or select an audit first.');
      return;
    }
    window.location.href = `/api/audits/${currentRunId}/report?format=json`;
  }

  // --- VISUAL CRAWL GRAPH CANVAS ENGINE ---

  function initCanvas() {
    canvas = el.graphCanvas;
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    startGraphSimulation();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 320;
  }

  function startGraphSimulation() {
    function animate() {
      drawGraph();
      animationFrameId = requestAnimationFrame(animate);
    }
    animate();
  }

  function drawGraph() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodes = Array.from(crawlGraph.nodes.values());
    if (nodes.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Crawl link graph will dynamically render nodes and edges as pages are discovered...', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Gentle spring / repelling force
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 100) {
          const force = (100 - dist) / 100 * 0.5;
          nodes[i].x -= (dx / dist) * force;
          nodes[i].y -= (dy / dist) * force;
          nodes[j].x += (dx / dist) * force;
          nodes[j].y += (dy / dist) * force;
        }
      }
      // Boundary clamp
      nodes[i].x = Math.max(30, Math.min(canvas.width - 30, nodes[i].x));
      nodes[i].y = Math.max(30, Math.min(canvas.height - 30, nodes[i].y));
    }

    // Draw Edges
    ctx.strokeStyle = 'rgba(253, 105, 9, 0.35)';
    ctx.lineWidth = 1.2;
    for (const edge of crawlGraph.edges) {
      const from = crawlGraph.nodes.get(edge.fromUrl);
      const to = crawlGraph.nodes.get(edge.toUrl);
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    // Draw Nodes
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = node.status === 404 ? '#EF4444' : (node.stage === 'parse' ? '#FD6909' : '#10B981');
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#CCCCCC';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 20 ? node.label.substring(0, 18) + '..' : node.label, node.x, node.y + 18);
    }
  }

  // --- HELPERS ---

  function updateStatusUI(status, label) {
    if (!el.crawlStatusBadge) return;
    el.crawlStatusBadge.textContent = label;
    el.crawlStatusBadge.className = `status-pill status-${status}`;
    if (el.btnStartCrawl) el.btnStartCrawl.disabled = (status === 'running');
    if (el.btnCancelCrawl) el.btnCancelCrawl.disabled = (status !== 'running');
  }

  function formatUrlPath(urlString) {
    try {
      const p = new URL(urlString).pathname;
      return p === '' ? '/' : p;
    } catch (err) {
      return urlString;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Export to window for inline onclick handlers
  window.SearchForgeOps = {
    openDiffPreview
  };

})();
