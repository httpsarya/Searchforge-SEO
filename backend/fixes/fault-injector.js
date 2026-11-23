const sandboxManager = require('./sandbox-manager.js');
const eventHub = require('../telemetry/event-hub.js');
const Diff = require('diff');

const FAULT_DEFINITIONS = {
  'SEO-005': {
    title: 'Accidental Noindex Directive on High-Value Case Study',
    file: 'case-studies/retail-growth.html',
    description: 'Injects <meta name="robots" content="noindex, follow"> into the retail-growth case study.',
    inject(content) {
      if (/<meta\s+name=["']robots["']\s+content=["']noindex/i.test(content)) {
        return content;
      }
      return content.replace(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*["']>/i,
        '<meta name="robots" content="noindex, follow">'
      );
    }
  },
  'SEO-004': {
    title: 'Canonical URL Pointing to Root Homepage',
    file: 'services/on-page-seo.html',
    description: 'Modifies canonical tag in on-page-seo.html to point incorrectly to the root homepage.',
    inject(content) {
      return content.replace(
        /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']>/i,
        '<link rel="canonical" href="https://searchforge-seo.com/">'
      );
    }
  },
  'SEO-001': {
    title: 'Duplicate Title Tag across Primary Pages',
    file: 'services/index.html',
    description: 'Sets services title to duplicate about.html title ("SearchForge SEO - Professional Services").',
    inject(content) {
      return content.replace(/<title>.*<\/title>/i, '<title>SearchForge SEO - Professional Services</title>');
    }
  },
  'SEO-002': {
    title: 'Missing & Truncated Meta Description',
    file: 'services/technical-seo.html',
    description: 'Empties the meta description tag in technical-seo.html.',
    inject(content) {
      return content.replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="">');
    }
  },
  'SEO-003': {
    title: 'Broken Internal Links (404 Error Targets)',
    file: 'services/index.html',
    description: 'Points service link to non-existent route /services/social-media-seo.html.',
    inject(content) {
      return content.replace(/href="(\/services\/)?seo-audits\.html"/i, 'href="/services/social-media-seo.html"');
    }
  },
  'SEO-006': {
    title: 'Robots.txt Blocking Critical Directory Crawling',
    file: 'robots.txt',
    description: 'Adds Disallow: /services/ to robots.txt.',
    inject(content) {
      if (content.includes('Disallow: /services/')) return content;
      return content + '\nDisallow: /services/\n';
    }
  },
  'SEO-007': {
    title: 'Malformed XML Sitemap with Dead URLs',
    file: 'sitemap.xml',
    description: 'Inserts dead/broken URL into sitemap.xml.',
    inject(content) {
      if (content.includes('social-media-seo.html')) return content;
      const deadEntry = '  <url>\n    <loc>https://searchforge-seo.com/services/social-media-seo.html</loc>\n    <lastmod>2026-10-01</lastmod>\n  </url>\n';
      return content.replace('</urlset>', `${deadEntry}</urlset>`);
    }
  },
  'SEO-008': {
    title: 'Multiple H1 Tags on Single Page',
    file: 'about.html',
    description: 'Adds a redundant secondary <h1> tag to about.html.',
    inject(content) {
      if (content.includes('data-injected-h1')) return content;
      return content.replace('</h1>', '</h1>\n        <h1 data-injected-h1="true" class="text-3xl font-bold text-red-400">Our Secondary Agency Heading</h1>');
    }
  }
};

class FaultInjector {
  getAvailableFaults() {
    return Object.entries(FAULT_DEFINITIONS).map(([id, def]) => ({
      id,
      title: def.title,
      file: def.file,
      description: def.description
    }));
  }

  inject(issueId, runId = null) {
    const def = FAULT_DEFINITIONS[issueId];
    if (!def) {
      throw new Error(`Unknown fault scenario ID '${issueId}'. Supported scenarios: ${Object.keys(FAULT_DEFINITIONS).join(', ')}`);
    }

    const currentContent = sandboxManager.readFile(def.file);
    const injectedContent = def.inject(currentContent);

    if (currentContent === injectedContent) {
      return {
        success: true,
        issueId,
        file: def.file,
        message: `Fault ${issueId} was already present in sandbox ${def.file}.`
      };
    }

    sandboxManager.writeFile(def.file, injectedContent);

    const diff = Diff.createTwoFilesPatch(
      `a/${def.file}`,
      `b/${def.file}`,
      currentContent,
      injectedContent,
      'Baseline Clean',
      'Injected Fault'
    );

    if (runId) {
      eventHub.publish({
        runId,
        stage: 'rule',
        level: 'warn',
        issueId,
        url: def.file,
        message: `[Fault Injected] Simulated scenario ${issueId} on sandbox fixture ${def.file}.`,
        evidenceRef: { diffSnippet: diff.substring(0, 300) }
      });
    }

    return {
      success: true,
      issueId,
      file: def.file,
      message: `Injected fault ${issueId} into isolated sandbox ${def.file}.`,
      diff
    };
  }
}

module.exports = new FaultInjector();
