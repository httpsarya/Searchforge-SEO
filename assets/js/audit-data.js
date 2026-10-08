/**
 * Technical SEO Rescue - Comprehensive Audit & Scenario Dataset
 * Defines all 15 intentional SEO flaws, pre/post rescue metrics, and page-specific attributes.
 */

const SEO_AUDIT_DATA = {
  meta: {
    brand: "SearchForge SEO",
    tagline: "Technical SEO. Rebuilt from the foundation up.",
    version: "2.0.4",
    updatedAt: "2026-10-02"
  },
  
  metrics: {
    before: {
      healthScore: 42,
      criticalIssues: 8,
      warnings: 14,
      brokenLinks: 12,
      missingTitles: 7,
      duplicateTitles: 4,
      missingAltText: 18,
      canonicalErrors: 5,
      sitemapErrors: 3,
      lcp: "4.8s",
      inp: "380ms",
      cls: "0.24",
      crawledPages: 18,
      indexablePages: 11
    },
    after: {
      healthScore: 98,
      criticalIssues: 0,
      warnings: 1,
      brokenLinks: 0,
      missingTitles: 0,
      duplicateTitles: 0,
      missingAltText: 0,
      canonicalErrors: 0,
      sitemapErrors: 0,
      lcp: "1.4s",
      inp: "45ms",
      cls: "0.01",
      crawledPages: 18,
      indexablePages: 18
    }
  },

  issues: [
    {
      id: "SEO-001",
      title: "Duplicate Title Tag across Primary Pages",
      category: "Metadata",
      severity: "High",
      location: "/about.html & /services/index.html",
      symptom: "Both pages shared identical generic title: 'SearchForge SEO - Professional Services'",
      rootCause: "Hardcoded default layout title without route-specific metadata generator.",
      rescueFix: "Created unique, high-intent titles with target primary keyword and brand suffix.",
      validationMethod: "Screaming Frog crawl title tab shows 100% unique page titles.",
      impact: "Eliminates keyword cannibalization and ensures distinct SERP snippets."
    },
    {
      id: "SEO-002",
      title: "Missing & Truncated Meta Descriptions",
      category: "Metadata",
      severity: "Medium",
      location: "/services/technical-seo.html",
      symptom: "Empty meta description tag causing search engines to auto-extract random hero text.",
      rootCause: "Omission during rapid page template scaffold.",
      rescueFix: "Added concise 155-character meta description with compelling CTA.",
      validationMethod: "Inspect rendered DOM `<meta name='description'>` tag length and content.",
      impact: "Improves organic CTR in search results by over 22%."
    },
    {
      id: "SEO-003",
      title: "Broken Internal Links (404 Error Targets)",
      category: "Internal Links",
      severity: "High",
      location: "/services/index.html -> /services/social-media-seo.html",
      symptom: "Navigational link points to unhandled non-existent URL returning broken page.",
      rootCause: "Legacy route reference that was removed during service restructuring.",
      rescueFix: "Updated link href to point to valid active service route `/services/seo-audits.html`.",
      validationMethod: "Automated link crawler verified 0 dead internal links across entire domain.",
      impact: "Preserves internal link equity and prevents user drop-off."
    },
    {
      id: "SEO-004",
      title: "Canonical URL Pointing to Root Homepage",
      category: "Canonicals",
      severity: "Critical",
      location: "/services/on-page-seo.html",
      symptom: "Canonical tag mistakenly pointed to `https://searchforge-seo.com/` instead of itself.",
      rootCause: "Copy-paste boilerplate error from root index page.",
      rescueFix: "Applied explicit self-referencing canonical tag `https://searchforge-seo.com/services/on-page-seo.html`.",
      validationMethod: "Screaming Frog Canonical tab shows 100% self-referencing on non-duplicate pages.",
      impact: "Prevents search engines from dropping the service page from index."
    },
    {
      id: "SEO-005",
      title: "Accidental Noindex Directive on High-Value Case Study",
      category: "Indexability",
      severity: "Critical",
      location: "/case-studies/retail-growth.html",
      symptom: "Page tagged with `<meta name='robots' content='noindex, nofollow'>`.",
      rootCause: "Staging debug meta tag was inadvertently left active in production markup.",
      rescueFix: "Updated directive to `<meta name='robots' content='index, follow'>`.",
      validationMethod: "Inspect robot directives in live DOM and verify Googlebot simulated access.",
      impact: "Restores organic indexing for key revenue-generating conversion case study."
    },
    {
      id: "SEO-006",
      title: "Robots.txt Blocking Critical Directory Crawling",
      category: "Crawlability",
      severity: "Critical",
      location: "/robots.txt",
      symptom: "Robots rule contained `Disallow: /services/` blocking entire commercial silo.",
      rootCause: "Misconfigured wildcards intended to block admin drafts.",
      rescueFix: "Refactored robots.txt to permit `/services/` and only restrict `/admin/` and private logs.",
      validationMethod: "Google Search Console Robots Testing tool simulation confirms 200 OK crawl access.",
      impact: "Allows search bot discovery of 4 core revenue-driving service landing pages."
    },
    {
      id: "SEO-007",
      title: "Malformed XML Sitemap with Dead URLs",
      category: "Sitemap",
      severity: "High",
      location: "/sitemap.xml",
      symptom: "Sitemap contained deprecated URLs, draft endpoints, and missing dynamic blog posts.",
      rootCause: "Static manual sitemap maintenance out of sync with site changes.",
      rescueFix: "Regenerated XML sitemap with 100% canonical, 200-status URLs and valid `<lastmod>` timestamps.",
      validationMethod: "Validated XML schema against sitemaps.org standards via XML validator.",
      impact: "Ensures efficient bot crawl budget allocation without crawl waste."
    },
    {
      id: "SEO-008",
      title: "Multiple H1 Tags & Broken Heading Hierarchy",
      category: "On-Page",
      severity: "Medium",
      location: "/index.html & /about.html",
      symptom: "Multiple `<h1>` tags on page, with heading levels jumping from `<h1>` directly to `<h4>`.",
      rootCause: "Headings styled for visual font size rather than semantic document outline.",
      rescueFix: "Restructured document outline: exactly one `<h1>` per page, sequential `<h2>` and `<h3>` tags.",
      validationMethod: "W3C Heading Outline tool confirms clean semantic nesting.",
      impact: "Significantly enhances screen-reader accessibility and clear topical entity clarity."
    },
    {
      id: "SEO-009",
      title: "Oversized Unoptimized Assets & Missing Alt Text",
      category: "Performance & Image SEO",
      severity: "High",
      location: "Homepage Hero & Case Study Diagrams",
      symptom: "4.2MB uncompressed PNGs without alt tags and missing explicit width/height causing CLS.",
      rootCause: "Direct upload of raw design exports.",
      rescueFix: "Compressed to modern WebP/SVG formats, specified exact aspect ratios, added descriptive keyword-rich alt.",
      validationMethod: "Lighthouse Performance audit score increased from 51 to 99; CLS dropped from 0.24 to 0.01.",
      impact: "Massive LCP speedup and image search discovery."
    },
    {
      id: "SEO-010",
      title: "Missing Structured Data & Invalid Schema Types",
      category: "Structured Data",
      severity: "Medium",
      location: "Domain-wide, FAQ & Articles",
      symptom: "Zero JSON-LD structured data on homepage, broken schema syntax on FAQ.",
      rootCause: "Lack of schema implementation in initial build.",
      rescueFix: "Embedded valid JSON-LD schemas for `Organization`, `WebSite`, `BreadcrumbList`, `Article`, and `FAQPage`.",
      validationMethod: "Tested with Google Rich Results Test - 0 errors, 0 warnings.",
      impact: "Enables rich snippets, expandable FAQ SERP features, and entity knowledge graph recognition."
    },
    {
      id: "SEO-011",
      title: "Orphaned Content Without Inbound Internal Links",
      category: "Architecture",
      severity: "High",
      location: "/blog/crawlability-guide.html",
      symptom: "Valuable in-depth technical guide had 0 contextual internal links from other pages.",
      rootCause: "Published in isolation without topic cluster linking.",
      rescueFix: "Added contextual internal links from `/services/technical-seo.html` and related blog posts.",
      validationMethod: "Screaming Frog Inlinks tab shows 5 high-authority inbound links.",
      impact: "Passes PageRank equity to guide, accelerating organic ranking."
    },
    {
      id: "SEO-012",
      title: "Multi-Hop Redirect Chain with 302 Temporary Status",
      category: "Redirects",
      severity: "Medium",
      location: "/old-audit -> /audit-temp -> /services/seo-audits.html",
      symptom: "2-hop redirect chain using temporary 302 redirects delaying page load.",
      rootCause: "Unconsolidated redirect rules across multiple site redesigns.",
      rescueFix: "Consolidated directly to single 301 permanent redirect `/old-audit` -> `/services/seo-audits.html`.",
      validationMethod: "HTTP Status Code checker reports single 301 followed immediately by 200 OK.",
      impact: "Eliminates latency and transfers full link equity."
    },
    {
      id: "SEO-013",
      title: "Missing Open Graph & Social Graph Metadata",
      category: "Social SEO",
      severity: "Low",
      location: "All pages",
      symptom: "Links shared on Slack, Twitter, and LinkedIn show empty blank cards.",
      rootCause: "Omission of `og:*` and `twitter:*` meta properties.",
      rescueFix: "Configured full Open Graph protocol including `og:image`, `og:type`, and Twitter card tags.",
      validationMethod: "Facebook Sharing Debugger & Twitter Card Validator confirm rich card preview.",
      impact: "Higher social click-through rates and brand presence."
    },
    {
      id: "SEO-014",
      title: "Mobile Viewport & Touch Target Violations",
      category: "Mobile SEO",
      severity: "High",
      location: "Mobile Navigation & Footer Links",
      symptom: "Buttons smaller than 28px placed too close together, failing mobile usability.",
      rootCause: "Desktop-first CSS without minimum touch target padding.",
      rescueFix: "Enforced minimum 48x48px tap targets, 16px legible body fonts, and responsive drawer navigation.",
      validationMethod: "Google Mobile-Friendly Test reports 'Page is usable on mobile'.",
      impact: "Eliminates mobile ranking penalties in mobile-first index."
    },
    {
      id: "SEO-015",
      title: "Soft 404 Returning HTTP 200 OK for Non-Existent Pages",
      category: "Status Codes",
      severity: "High",
      location: "/404.html & nonexistent URLs",
      symptom: "Server returned HTTP 200 status for missing routes, confusing search crawlers.",
      rootCause: "SPA fallback routing without proper server-level 404 response header.",
      rescueFix: "Configured explicit HTTP 404 status header accompanied by a dedicated recovery landing page.",
      validationMethod: "Curl request confirms `HTTP/1.1 404 Not Found` response header.",
      impact: "Prevents index bloat and phantom URL indexing."
    }
  ]
};

// Export to window
if (typeof window !== 'undefined') {
  window.SEO_AUDIT_DATA = SEO_AUDIT_DATA;
}
