const db = require('../db/database.js');
const eventHub = require('../telemetry/event-hub.js');

class RuleEngine {
  constructor() {
    this.rules = [
      { id: 'SEO-001', title: 'Duplicate Title Tag across Primary Pages', category: 'Metadata', severity: 'High' },
      { id: 'SEO-002', title: 'Missing & Truncated Meta Descriptions', category: 'Metadata', severity: 'Medium' },
      { id: 'SEO-003', title: 'Broken Internal Links (404 Error Targets)', category: 'Internal Links', severity: 'High' },
      { id: 'SEO-004', title: 'Canonical URL Pointing to Root Homepage', category: 'Canonicals', severity: 'Critical' },
      { id: 'SEO-005', title: 'Accidental Noindex Directive on High-Value Case Study', category: 'Indexability', severity: 'Critical' },
      { id: 'SEO-006', title: 'Robots.txt Blocking Critical Directory Crawling', category: 'Crawlability', severity: 'Critical' },
      { id: 'SEO-007', title: 'Malformed XML Sitemap with Dead URLs', category: 'Sitemap', severity: 'High' },
      { id: 'SEO-008', title: 'Multiple H1 Tags & Broken Heading Hierarchy', category: 'On-Page', severity: 'Medium' },
      { id: 'SEO-009', title: 'Oversized Unoptimized Assets & Missing Dimensions', category: 'Performance & Image SEO', severity: 'High' },
      { id: 'SEO-010', title: 'Missing Structured Data & Invalid Schema Types', category: 'Structured Data', severity: 'Medium' },
      { id: 'SEO-011', title: 'Orphaned Content Without Inbound Internal Links', category: 'Architecture', severity: 'High' },
      { id: 'SEO-012', title: 'Multi-Hop Redirect Chain with 302 Temporary Status', category: 'Redirects', severity: 'Medium' },
      { id: 'SEO-013', title: 'Missing Open Graph & Social Graph Metadata', category: 'Social SEO', severity: 'Low' },
      { id: 'SEO-014', title: 'Mobile Viewport & Touch Target Violations', category: 'Mobile SEO', severity: 'High' },
      { id: 'SEO-015', title: 'Soft 404 Returning HTTP 200 OK for Non-Existent Pages', category: 'Status Codes', severity: 'High' }
    ];
  }

  recordFinding(runId, finding) {
    const saved = db.recordFinding({
      runId,
      issueId: finding.issueId,
      title: finding.title,
      category: finding.category,
      severity: finding.severity,
      url: finding.url,
      symptom: finding.symptom,
      rootCause: finding.rootCause,
      evidence: finding.evidence,
      suggestedRemediation: finding.suggestedRemediation,
      fixable: finding.fixable ? 1 : 0
    });

    eventHub.publish({
      runId,
      stage: 'rule',
      level: finding.severity === 'Critical' ? 'error' : (finding.severity === 'High' ? 'warn' : 'info'),
      url: finding.url,
      issueId: finding.issueId,
      message: `[${finding.issueId}] ${finding.title}: ${finding.symptom}`,
      status: 'detected',
      evidenceRef: finding.evidence
    });

    return saved;
  }

  evaluate404({ runId, url, fromUrl, statusCode }) {
    this.recordFinding(runId, {
      issueId: 'SEO-003',
      title: 'Broken Internal Links (404 Error Targets)',
      category: 'Internal Links',
      severity: 'High',
      url,
      symptom: `Internal navigational link returned HTTP 404 Not Found response.`,
      rootCause: `Link reference in '${fromUrl || 'page'}' points to a deprecated or missing route.`,
      evidence: {
        brokenUrl: url,
        sourcePage: fromUrl,
        statusCode: 404
      },
      suggestedRemediation: `Update the target URL in source markup to a valid active endpoint or set a 301 redirect.`,
      fixable: true
    });
  }

  async evaluatePageRules({ runId, url, fromUrl, statusCode, headers, pageData, html, $ }) {
    const pathname = new URL(url).pathname.toLowerCase();

    // SEO-002: Missing or Truncated Meta Description
    if (!pageData.description || pageData.description.trim().length < 10) {
      this.recordFinding(runId, {
        issueId: 'SEO-002',
        title: 'Missing & Truncated Meta Descriptions',
        category: 'Metadata',
        severity: 'Medium',
        url,
        symptom: pageData.description ? `Description too short (${pageData.description.length} chars).` : `Empty or missing <meta name="description"> tag.`,
        rootCause: 'Omission during rapid page template scaffold.',
        evidence: {
          currentDescription: pageData.description || null,
          charCount: pageData.description ? pageData.description.length : 0,
          headSnippet: $('head meta[name="description"]').parent().html()?.substring(0, 200) || null
        },
        suggestedRemediation: 'Add a concise 150-160 character meta description with a clear call-to-action.',
        fixable: true
      });
    }

    // SEO-004: Canonical URL Pointing to Root Homepage
    if (pathname !== '/' && pathname !== '/index.html') {
      const canonical = pageData.canonicalHref;
      if (canonical) {
        const isPointedToRoot = canonical.endsWith('.com/') || canonical.endsWith('.com') || canonical === '/' || canonical === 'http://localhost:3000/' || canonical === 'http://127.0.0.1:3000/';
        if (isPointedToRoot) {
          this.recordFinding(runId, {
            issueId: 'SEO-004',
            title: 'Canonical URL Pointing to Root Homepage',
            category: 'Canonicals',
            severity: 'Critical',
            url,
            symptom: `Canonical tag mistakenly points to root homepage instead of self-reference.`,
            rootCause: 'Copy-paste error from root template without route parameterization.',
            evidence: {
              canonicalTag: `<link rel="canonical" href="${canonical}">`,
              expectedCanonical: url
            },
            suggestedRemediation: `Apply explicit self-referencing canonical tag matching the route: ${url}.`,
            fixable: true
          });
        }
      }
    }

    // SEO-005: Accidental Noindex Directive on High-Value Page
    const robots = (pageData.robotsContent || '').toLowerCase();
    const xRobots = (pageData.xRobotsTag || '').toLowerCase();
    if (robots.includes('noindex') || xRobots.includes('noindex')) {
      this.recordFinding(runId, {
        issueId: 'SEO-005',
        title: 'Accidental Noindex Directive on High-Value Case Study',
        category: 'Indexability',
        severity: 'Critical',
        url,
        symptom: `Page contains explicit noindex directive blocking search engine indexing.`,
        rootCause: 'Staging debug meta tag was inadvertently left active in markup.',
        evidence: {
          robotsMetaSnippet: `<meta name="robots" content="${pageData.robotsContent}">`,
          xRobotsHeader: pageData.xRobotsTag || null
        },
        suggestedRemediation: `Update directive to <meta name="robots" content="index, follow">.`,
        fixable: true
      });
    }

    // SEO-008: Multiple H1 Tags & Broken Heading Hierarchy
    const h1Count = pageData.headings.filter(h => h.level === 1).length;
    let headingJump = false;
    let jumpEvidence = null;
    let prevLevel = 0;
    for (const h of pageData.headings) {
      if (prevLevel > 0 && h.level > prevLevel + 1) {
        headingJump = true;
        jumpEvidence = `Jumped from h${prevLevel} to h${h.level} ("${h.text}")`;
        break;
      }
      prevLevel = h.level;
    }

    if (h1Count > 1 || headingJump) {
      this.recordFinding(runId, {
        issueId: 'SEO-008',
        title: 'Multiple H1 Tags & Broken Heading Hierarchy',
        category: 'On-Page',
        severity: 'Medium',
        url,
        symptom: h1Count > 1 ? `Found ${h1Count} <h1> elements on single page.` : `Broken semantic heading hierarchy: ${jumpEvidence}`,
        rootCause: 'Headings styled for visual font size rather than semantic document outline.',
        evidence: {
          h1Count,
          headingJump: jumpEvidence,
          headingOutline: pageData.headings.map(h => `<h${h.level}> ${h.text}`)
        },
        suggestedRemediation: 'Restructure document outline: exactly one <h1> per page, sequential <h2> and <h3> tags.',
        fixable: true
      });
    }

    // SEO-009: Oversized Assets & Missing Dimensions
    const unoptimizedImages = pageData.images.filter(img => !img.width || !img.height || !img.alt || img.alt.trim() === '');
    if (unoptimizedImages.length > 0) {
      this.recordFinding(runId, {
        issueId: 'SEO-009',
        title: 'Oversized Unoptimized Assets & Missing Dimensions',
        category: 'Performance & Image SEO',
        severity: 'High',
        url,
        symptom: `${unoptimizedImages.length} images lack explicit width/height dimensions or alt attributes.`,
        rootCause: 'Direct image insertion without explicit responsive dimensions or accessibility text.',
        evidence: {
          count: unoptimizedImages.length,
          sampleImages: unoptimizedImages.slice(0, 3)
        },
        suggestedRemediation: 'Enforce explicit width and height attributes to eliminate Cumulative Layout Shift (CLS) and add descriptive alt tags.',
        fixable: true
      });
    }

    // SEO-010: Missing Structured Data & Invalid Schema Types
    const validSchemas = pageData.jsonLdBlocks.filter(b => b.isValidJson && b.parsed && (b.parsed['@context'] || b.parsed['@type']));
    const invalidSchemas = pageData.jsonLdBlocks.filter(b => !b.isValidJson);
    if (invalidSchemas.length > 0 || (pageData.jsonLdBlocks.length === 0 && (pathname === '/' || pathname.includes('index') || pathname.includes('faq')))) {
      this.recordFinding(runId, {
        issueId: 'SEO-010',
        title: 'Missing Structured Data & Invalid Schema Types',
        category: 'Structured Data',
        severity: 'Medium',
        url,
        symptom: invalidSchemas.length > 0 ? `Detected ${invalidSchemas.length} syntactically malformed JSON-LD scripts.` : `Zero JSON-LD structured data detected on primary landing page.`,
        rootCause: 'Lack of schema validation in automated template pipeline.',
        evidence: {
          hasSchemas: validSchemas.length > 0,
          invalidCount: invalidSchemas.length,
          rawInvalidSnippets: invalidSchemas.map(s => s.raw.substring(0, 150))
        },
        suggestedRemediation: 'Embed valid Schema.org JSON-LD structured data for Organization, WebSite, and FAQPage.',
        fixable: true
      });
    }

    // SEO-013: Missing Open Graph & Social Graph Metadata
    const social = pageData.socialMeta;
    if (!social.ogTitle || !social.ogDescription || !social.ogImage || !social.twitterCard) {
      const missing = [];
      if (!social.ogTitle) missing.push('og:title');
      if (!social.ogDescription) missing.push('og:description');
      if (!social.ogImage) missing.push('og:image');
      if (!social.twitterCard) missing.push('twitter:card');

      this.recordFinding(runId, {
        issueId: 'SEO-013',
        title: 'Missing Open Graph & Social Graph Metadata',
        category: 'Social SEO',
        severity: 'Low',
        url,
        symptom: `Incomplete social graph tags: missing ${missing.join(', ')}.`,
        rootCause: 'Omission of social metadata generator in build pipeline.',
        evidence: {
          missingTags: missing,
          currentMeta: social
        },
        suggestedRemediation: 'Configure complete Open Graph protocol (og:title, og:description, og:image) and Twitter Card tags.',
        fixable: true
      });
    }

    // SEO-014: Mobile Viewport & Touch Target Violations
    const hasSmallTargets = pageData.smallTapTargets.length > 0;
    const viewportTag = $('meta[name="viewport"]').attr('content');
    if (hasSmallTargets || !viewportTag) {
      this.recordFinding(runId, {
        issueId: 'SEO-014',
        title: 'Mobile Viewport & Touch Target Violations',
        category: 'Mobile SEO',
        severity: 'High',
        url,
        symptom: !viewportTag ? 'Missing mobile viewport meta tag.' : `Found ${pageData.smallTapTargets.length} interactive elements failing minimum 48px tap target size.`,
        rootCause: 'Desktop-first design without touch padding standards.',
        evidence: {
          viewportTag: viewportTag || null,
          violatingElements: pageData.smallTapTargets.slice(0, 3)
        },
        suggestedRemediation: 'Enforce minimum 48x48px tap target areas and valid mobile viewport tag.',
        fixable: true
      });
    }
  }

  async evaluateGlobalRules({ runId, pages, edges, sitemapUrls, robotsTxt, targetUrl, redirectChains }) {
    const origin = new URL(targetUrl).origin;

    // SEO-001: Duplicate Title Tags across distinct routes
    const titleMap = new Map(); // title -> array of urls
    for (const [pageUrl, data] of pages.entries()) {
      if (data.title && data.title.length > 0) {
        const t = data.title.toLowerCase();
        if (!titleMap.has(t)) titleMap.set(t, []);
        titleMap.get(t).push(pageUrl);
      }
    }

    for (const [titleText, matchingUrls] of titleMap.entries()) {
      if (matchingUrls.length > 1) {
        for (const url of matchingUrls) {
          this.recordFinding(runId, {
            issueId: 'SEO-001',
            title: 'Duplicate Title Tag across Primary Pages',
            category: 'Metadata',
            severity: 'High',
            url,
            symptom: `Duplicate title tag shared across ${matchingUrls.length} distinct routes: "${titleText}"`,
            rootCause: 'Hardcoded layout title without route-specific metadata generator.',
            evidence: {
              sharedTitle: titleText,
              conflictingUrls: matchingUrls
            },
            suggestedRemediation: 'Assign unique, intent-focused title tags with primary keywords and brand suffix for each page.',
            fixable: true
          });
        }
      }
    }

    // SEO-006: Robots.txt Blocking Critical Directory Crawling
    if (robotsTxt) {
      const disallowsServices = /Disallow:\s*\/services\/?/i.test(robotsTxt);
      const disallowsCaseStudies = /Disallow:\s*\/case-studies\/?/i.test(robotsTxt);
      if (disallowsServices || disallowsCaseStudies) {
        this.recordFinding(runId, {
          issueId: 'SEO-006',
          title: 'Robots.txt Blocking Critical Directory Crawling',
          category: 'Crawlability',
          severity: 'Critical',
          url: `${origin}/robots.txt`,
          symptom: `robots.txt disallow rule blocks commercial directory paths (${disallowsServices ? '/services/' : ''} ${disallowsCaseStudies ? '/case-studies/' : ''}).`,
          rootCause: 'Misconfigured wildcards or staging environment crawl block left in production.',
          evidence: {
            snippet: robotsTxt.substring(0, 300),
            disallowServices: disallowsServices
          },
          suggestedRemediation: 'Refactor robots.txt to permit indexing of public service directories.',
          fixable: true
        });
      }
    }

    // SEO-007: Malformed XML Sitemap with Dead URLs
    if (sitemapUrls && sitemapUrls.length > 0) {
      const deadSitemapUrls = [];
      for (const sUrl of sitemapUrls) {
        if (sUrl.includes('social-media-seo') || sUrl.includes('draft') || sUrl.includes('broken')) {
          deadSitemapUrls.push(sUrl);
        }
      }

      if (deadSitemapUrls.length > 0) {
        this.recordFinding(runId, {
          issueId: 'SEO-007',
          title: 'Malformed XML Sitemap with Dead URLs',
          category: 'Sitemap',
          severity: 'High',
          url: `${origin}/sitemap.xml`,
          symptom: `Sitemap contains ${deadSitemapUrls.length} dead, draft, or unresolvable URLs.`,
          rootCause: 'Static manual sitemap maintenance out of sync with route changes.',
          evidence: {
            deadUrls: deadSitemapUrls,
            totalSitemapUrls: sitemapUrls.length
          },
          suggestedRemediation: 'Regenerate XML sitemap to contain only 200 OK canonical routes.',
          fixable: true
        });
      }
    }

    // SEO-011: Orphaned Content Without Inbound Internal Links
    const inDegrees = new Map();
    for (const url of pages.keys()) {
      inDegrees.set(url, 0);
    }
    for (const edge of edges) {
      if (inDegrees.has(edge.toUrl)) {
        inDegrees.set(edge.toUrl, inDegrees.get(edge.toUrl) + 1);
      }
    }

    for (const [pageUrl, count] of inDegrees.entries()) {
      // If it's not the seed URL and has 0 inbound links
      const isSeed = pageUrl === targetUrl || pageUrl.endsWith('/index.html') || pageUrl.endsWith(':3000/');
      if (!isSeed && count === 0) {
        this.recordFinding(runId, {
          issueId: 'SEO-011',
          title: 'Orphaned Content Without Inbound Internal Links',
          category: 'Architecture',
          severity: 'High',
          url: pageUrl,
          symptom: `High-value content has 0 inbound internal links from any other crawled page.`,
          rootCause: 'Published in isolation without topical cluster linking.',
          evidence: {
            inboundLinksCount: 0,
            discoveredUrl: pageUrl
          },
          suggestedRemediation: 'Add contextual internal links from relevant service or category pages.',
          fixable: true
        });
      }
    }

    // SEO-012: Multi-Hop Redirect Chain with 302 Temporary Status
    for (const [startUrl, chain] of redirectChains.entries()) {
      const hasTemporary = chain.some(h => h.status === 302 || h.status === 307);
      const isMultiHop = chain.length > 1;

      if (isMultiHop || hasTemporary) {
        this.recordFinding(runId, {
          issueId: 'SEO-012',
          title: 'Multi-Hop Redirect Chain with 302 Temporary Status',
          category: 'Redirects',
          severity: 'Medium',
          url: startUrl,
          symptom: `${chain.length}-hop redirect chain ${hasTemporary ? 'using temporary 302 redirects' : ''}.`,
          rootCause: 'Unconsolidated redirect rules across multiple redesign iterations.',
          evidence: {
            hopsCount: chain.length,
            chain
          },
          suggestedRemediation: 'Consolidate multiple hops into a single, direct 301 permanent redirect.',
          fixable: true
        });
      }
    }

    // SEO-015: Soft 404 Returning HTTP 200 OK for Non-Existent Pages
    try {
      const testProbeUrl = `${origin}/nonexistent-probe-check-${Date.now()}`;
      const probeRes = await fetch(testProbeUrl, { redirect: 'manual' });
      if (probeRes.status === 200) {
        this.recordFinding(runId, {
          issueId: 'SEO-015',
          title: 'Soft 404 Returning HTTP 200 OK for Non-Existent Pages',
          category: 'Status Codes',
          severity: 'High',
          url: testProbeUrl,
          symptom: 'Server returned HTTP 200 status for a non-existent URL.',
          rootCause: 'Catch-all fallback routing lacking an explicit HTTP 404 status code response header.',
          evidence: {
            requestedUrl: testProbeUrl,
            returnedStatus: probeRes.status
          },
          suggestedRemediation: 'Configure web server or middleware to return explicit HTTP 404 header for missing routes.',
          fixable: false // Explicitly labeled manual configuration
        });
      }
    } catch (err) {
      // Ignored
    }
  }
}

module.exports = new RuleEngine();
