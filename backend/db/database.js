const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Ensure db directory exists
const dbDir = __dirname;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'seo_operations.db');
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    target_url TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    stage TEXT NOT NULL,
    level TEXT NOT NULL,
    url TEXT,
    issue_id TEXT,
    message TEXT NOT NULL,
    elapsed_ms INTEGER DEFAULT 0,
    evidence_ref TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    issue_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    url TEXT NOT NULL,
    symptom TEXT,
    root_cause TEXT,
    evidence TEXT,
    suggested_remediation TEXT,
    fixable INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS crawl_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    from_url TEXT NOT NULL,
    to_url TEXT NOT NULL,
    status_code INTEGER DEFAULT 200,
    content_type TEXT,
    discovered_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    issue_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    original_content TEXT NOT NULL,
    patched_content TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    status TEXT DEFAULT 'applied'
  );
`);

// Prepared statements for high performance
const stmts = {
  insertAudit: db.prepare(`
    INSERT INTO audits (id, target_url, status, created_at)
    VALUES (?, ?, ?, ?)
  `),
  updateAudit: db.prepare(`
    UPDATE audits
    SET status = ?, completed_at = ?, summary = ?
    WHERE id = ?
  `),
  getAudit: db.prepare(`
    SELECT * FROM audits WHERE id = ?
  `),
  listAudits: db.prepare(`
    SELECT * FROM audits ORDER BY created_at DESC LIMIT 50
  `),
  insertEvent: db.prepare(`
    INSERT INTO events (run_id, timestamp, stage, level, url, issue_id, message, elapsed_ms, evidence_ref, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getEventsByRun: db.prepare(`
    SELECT * FROM events WHERE run_id = ? ORDER BY event_id ASC
  `),
  getEventsSince: db.prepare(`
    SELECT * FROM events WHERE run_id = ? AND event_id > ? ORDER BY event_id ASC
  `),
  insertFinding: db.prepare(`
    INSERT INTO findings (run_id, issue_id, title, category, severity, url, symptom, root_cause, evidence, suggested_remediation, fixable, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getFindingsByRun: db.prepare(`
    SELECT * FROM findings WHERE run_id = ? ORDER BY id ASC
  `),
  getFindingById: db.prepare(`
    SELECT * FROM findings WHERE id = ?
  `),
  updateFindingStatus: db.prepare(`
    UPDATE findings SET status = ? WHERE id = ?
  `),
  insertEdge: db.prepare(`
    INSERT INTO crawl_edges (run_id, from_url, to_url, status_code, content_type, discovered_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getEdgesByRun: db.prepare(`
    SELECT * FROM crawl_edges WHERE run_id = ? ORDER BY id ASC
  `),
  insertBackup: db.prepare(`
    INSERT INTO backups (id, run_id, issue_id, relative_path, original_content, patched_content, applied_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getBackup: db.prepare(`
    SELECT * FROM backups WHERE id = ?
  `),
  updateBackupStatus: db.prepare(`
    UPDATE backups SET status = ? WHERE id = ?
  `),
  getLatestBackupForIssue: db.prepare(`
    SELECT * FROM backups WHERE issue_id = ? AND status = 'applied' ORDER BY applied_at DESC LIMIT 1
  `)
};

module.exports = {
  db,
  stmts,
  
  createAudit(id, targetUrl) {
    const createdAt = new Date().toISOString();
    stmts.insertAudit.run(id, targetUrl, 'running', createdAt);
    return { id, targetUrl, status: 'running', createdAt };
  },

  finishAudit(id, status, summary = {}) {
    const completedAt = new Date().toISOString();
    stmts.updateAudit.run(status, completedAt, JSON.stringify(summary), id);
  },

  getAudit(id) {
    const row = stmts.getAudit.get(id);
    if (!row) return null;
    return {
      ...row,
      summary: row.summary ? JSON.parse(row.summary) : null
    };
  },

  listAudits() {
    const rows = stmts.listAudits.all();
    return rows.map(r => ({
      ...r,
      summary: r.summary ? JSON.parse(r.summary) : null
    }));
  },

  recordEvent({ runId, stage, level = 'info', url = null, issueId = null, message, elapsedMs = 0, evidenceRef = null, status = 'in_progress' }) {
    const timestamp = new Date().toISOString();
    const evidenceStr = evidenceRef ? JSON.stringify(evidenceRef) : null;
    const result = stmts.insertEvent.run(runId, timestamp, stage, level, url, issueId, message, elapsedMs, evidenceStr, status);
    const eventId = Number(result.lastInsertRowid);
    return {
      eventId,
      runId,
      timestamp,
      stage,
      level,
      url,
      issueId,
      message,
      elapsedMs,
      evidenceRef,
      status
    };
  },

  getEvents(runId, sinceEventId = 0) {
    const rows = sinceEventId > 0
      ? stmts.getEventsSince.all(runId, sinceEventId)
      : stmts.getEventsByRun.all(runId);
    return rows.map(r => ({
      eventId: r.event_id,
      runId: r.run_id,
      timestamp: r.timestamp,
      stage: r.stage,
      level: r.level,
      url: r.url,
      issueId: r.issue_id,
      message: r.message,
      elapsedMs: r.elapsed_ms,
      evidenceRef: r.evidence_ref ? JSON.parse(r.evidence_ref) : null,
      status: r.status
    }));
  },

  recordFinding({ runId, issueId, title, category, severity, url, symptom, rootCause, evidence, suggestedRemediation, fixable = 0 }) {
    const evidenceStr = typeof evidence === 'object' ? JSON.stringify(evidence) : String(evidence);
    const result = stmts.insertFinding.run(
      runId,
      issueId,
      title,
      category,
      severity,
      url,
      symptom || '',
      rootCause || '',
      evidenceStr,
      suggestedRemediation || '',
      fixable ? 1 : 0,
      'open'
    );
    return {
      id: Number(result.lastInsertRowid),
      runId,
      issueId,
      title,
      category,
      severity,
      url,
      symptom,
      rootCause,
      evidence,
      suggestedRemediation,
      fixable: Boolean(fixable),
      status: 'open'
    };
  },

  getFindings(runId) {
    const rows = stmts.getFindingsByRun.all(runId);
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      issueId: r.issue_id,
      title: r.title,
      category: r.category,
      severity: r.severity,
      url: r.url,
      symptom: r.symptom,
      rootCause: r.root_cause,
      evidence: r.evidence ? (r.evidence.startsWith('{') || r.evidence.startsWith('[') ? JSON.parse(r.evidence) : r.evidence) : null,
      suggestedRemediation: r.suggested_remediation,
      fixable: Boolean(r.fixable),
      status: r.status
    }));
  },

  recordCrawlEdge({ runId, fromUrl, toUrl, statusCode = 200, contentType = 'text/html' }) {
    const discoveredAt = new Date().toISOString();
    stmts.insertEdge.run(runId, fromUrl, toUrl, statusCode, contentType, discoveredAt);
  },

  getCrawlEdges(runId) {
    const rows = stmts.getEdgesByRun.all(runId);
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      fromUrl: r.from_url,
      toUrl: r.to_url,
      statusCode: r.status_code,
      contentType: r.content_type,
      discoveredAt: r.discovered_at
    }));
  },

  saveBackup({ id, runId = null, issueId, relativePath, originalContent, patchedContent }) {
    const appliedAt = new Date().toISOString();
    stmts.insertBackup.run(id, runId, issueId, relativePath, originalContent, patchedContent, appliedAt, 'applied');
    return { id, issueId, relativePath, appliedAt, status: 'applied' };
  },

  getBackup(id) {
    return stmts.getBackup.get(id) || null;
  },

  markBackupRolledBack(id) {
    stmts.updateBackupStatus.run('rolled_back', id);
  },

  getLatestBackup(issueId) {
    return stmts.getLatestBackupForIssue.get(issueId) || null;
  }
};
