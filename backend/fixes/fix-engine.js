const sandboxManager = require('./sandbox-manager.js');
const db = require('../db/database.js');
const eventHub = require('../telemetry/event-hub.js');
const Diff = require('diff');

const FIX_DEFINITIONS = {
  'SEO-005': {
    file: 'case-studies/retail-growth.html',
    title: 'Restore Indexable Robots Directive',
    preview(content) {
      return content.replace(
        /<meta\s+name=["']robots["']\s+content=["']noindex[^"']*["']>/i,
        '<meta name="robots" content="index, follow">'
      );
    }
  },
  'SEO-004': {
    file: 'services/on-page-seo.html',
    title: 'Restore Self-Referencing Canonical',
    preview(content) {
      return content.replace(
        /<link\s+rel=["']canonical["']\s+href=["']https:\/\/searchforge-seo\.com\/?["']>/i,
        '<link rel="canonical" href="https://searchforge-seo.com/services/on-page-seo.html">'
      );
    }
  },
  'SEO-001': {
    file: 'services/index.html',
    title: 'Set Unique Services Title Tag',
    preview(content) {
      return content.replace(
        /<title>SearchForge SEO - Professional Services<\/title>/i,
        '<title>SEO Services & Solutions | SearchForge Technical SEO</title>'
      );
    }
  },
  'SEO-002': {
    file: 'services/technical-seo.html',
    title: 'Inject High-Intent Meta Description',
    preview(content) {
      const properDesc = '<meta name="description" content="Enterprise technical SEO audit, architecture remediation, and performance engineering services to maximize organic crawlability and search rankings.">';
      if (content.includes('<meta name="description" content="">')) {
        return content.replace('<meta name="description" content="">', properDesc);
      }
      return content.replace(/<meta name="description" content="[^"]*">/i, properDesc);
    }
  },
  'SEO-003': {
    file: 'services/index.html',
    title: 'Resolve Broken Internal Link Target',
    preview(content) {
      return content.replace(
        /href="\/services\/social-media-seo\.html"/g,
        'href="/services/seo-audits.html"'
      );
    }
  },
  'SEO-006': {
    file: 'robots.txt',
    title: 'Permit Crawling of Public Services in robots.txt',
    preview(content) {
      return content.replace(/Disallow:\s*\/services\/?\r?\n?/g, '');
    }
  },
  'SEO-007': {
    file: 'sitemap.xml',
    title: 'Remove Broken URL from Sitemap.xml',
    preview(content) {
      return content.replace(
        /\s*<url>\s*<loc>[^<]*social-media-seo\.html<\/loc>[\s\S]*?<\/url>/g,
        ''
      );
    }
  },
  'SEO-008': {
    file: 'about.html',
    title: 'Convert Secondary H1 to Semantic H2',
    preview(content) {
      return content.replace(
        /<h1 data-injected-h1="true"[^>]*>([\s\S]*?)<\/h1>/g,
        '<h2 class="text-2xl font-bold text-neutral-200">$1</h2>'
      );
    }
  }
};

class FixEngine {
  previewFix(issueId) {
    const def = FIX_DEFINITIONS[issueId];
    if (!def) {
      return {
        issueId,
        canAutoFix: false,
        message: `Scenario ${issueId} requires manual architectural or server configuration. No automated patch template defined.`
      };
    }

    const currentContent = sandboxManager.readFile(def.file);
    const proposedContent = def.preview(currentContent);

    if (currentContent === proposedContent) {
      return {
        issueId,
        canAutoFix: false,
        file: def.file,
        message: `Target ${def.file} already matches the desired rescued state. No diff detected.`
      };
    }

    const diff = Diff.createTwoFilesPatch(
      `sandbox/${def.file} (Current)`,
      `sandbox/${def.file} (Rescued Proposed)`,
      currentContent,
      proposedContent,
      'Flawed Sandbox',
      'Rescued Patch'
    );

    return {
      issueId,
      canAutoFix: true,
      file: def.file,
      title: def.title,
      originalSnippet: currentContent.substring(0, 400),
      proposedSnippet: proposedContent.substring(0, 400),
      diff
    };
  }

  applyFix(issueId, runId = null, findingId = null) {
    const preview = this.previewFix(issueId);
    if (!preview.canAutoFix) {
      throw new Error(preview.message || `Automated fix unavailable for ${issueId}`);
    }

    const def = FIX_DEFINITIONS[issueId];
    const currentContent = sandboxManager.readFile(def.file);
    const patchedContent = def.preview(currentContent);

    // Create unique backup record
    const backupId = `bk_${issueId.toLowerCase()}_${Date.now()}`;
    db.saveBackup({
      id: backupId,
      runId,
      issueId,
      relativePath: def.file,
      originalContent: currentContent,
      patchedContent
    });

    // Write fix to sandbox
    sandboxManager.writeFile(def.file, patchedContent);

    // Update finding status if findingId is provided
    if (findingId) {
      db.stmts.updateFindingStatus.run('fixed', findingId);
    }

    // Publish event
    if (runId) {
      eventHub.publish({
        runId,
        stage: 'fix',
        level: 'success',
        issueId,
        url: def.file,
        message: `[Fix Applied] Patched ${def.file} for ${issueId}. Backup created: ${backupId}`,
        evidenceRef: {
          backupId,
          diffSnippet: preview.diff.substring(0, 400)
        },
        status: 'fixed'
      });
    }

    return {
      success: true,
      backupId,
      issueId,
      file: def.file,
      message: `Patch successfully applied to sandbox/${def.file}. Backup ID: ${backupId}`
    };
  }

  rollback(backupId, runId = null) {
    const backup = db.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup '${backupId}' not found in audit database.`);
    }

    if (backup.status === 'rolled_back') {
      return {
        success: true,
        message: `Backup ${backupId} was already rolled back previously.`
      };
    }

    // Write original content back to sandbox
    sandboxManager.writeFile(backup.relative_path, backup.original_content);
    db.markBackupRolledBack(backupId);

    if (runId) {
      eventHub.publish({
        runId,
        stage: 'fix',
        level: 'info',
        issueId: backup.issue_id,
        url: backup.relative_path,
        message: `[Rollback] Restored sandbox/${backup.relative_path} from backup ${backupId}.`,
        status: 'rolled_back'
      });
    }

    return {
      success: true,
      backupId,
      file: backup.relative_path,
      message: `Successfully rolled back sandbox/${backup.relative_path} to state prior to ${backup.issue_id} fix.`
    };
  }
}

module.exports = new FixEngine();
