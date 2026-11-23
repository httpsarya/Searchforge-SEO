const cheerio = require('cheerio');
const db = require('../db/database.js');
const eventHub = require('../telemetry/event-hub.js');

// Allowlist for SSRF prevention
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isAllowedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    // Allow localhost, loopback, or custom development origin
    if (ALLOWED_HOSTS.has(hostname)) return true;
    // Disallow external domains unless explicitly configured
    return false;
  } catch (err) {
    return false;
  }
}

function normalizeUrl(urlString, baseUrl) {
  try {
    const resolved = new URL(urlString, baseUrl);
    resolved.hash = ''; // Strip hash
    // Standardize localhost / 127.0.0.1 host if identical port
    return resolved.href;
  } catch (err) {
    return null;
  }
}

class Crawler {
  constructor(runId, options = {}) {
    this.runId = runId;
    this.targetUrl = options.targetUrl;
    this.maxPages = options.maxPages || 30;
    this.maxDepth = options.maxDepth || 4;
    this.concurrency = options.concurrency || 3;
    this.timeoutMs = options.timeoutMs || 6000;
    this.isSandbox = options.isSandbox || false;

    this.queue = [];
    this.visited = new Set();
    this.pagesData = new Map(); // url -> parsed page info
    this.redirectChains = new Map(); // url -> array of { status, location }
    this.edges = []; // array of { fromUrl, toUrl, statusCode }
    this.robotsTxt = null;
    this.sitemapUrls = [];
    this.isAborted = false;
    this.abortController = new AbortController();
    this.startTime = Date.now();
  }

  cancel() {
    this.isAborted = true;
    this.abortController.abort();
    eventHub.publish({
      runId: this.runId,
      stage: 'queue',
      level: 'warn',
      message: 'Crawl run was cancelled by user request.',
      elapsedMs: Date.now() - this.startTime,
      status: 'cancelled'
    });
  }

  async run(ruleEngine) {
    const startUrl = this.targetUrl;
    if (!isAllowedUrl(startUrl)) {
      throw new Error(`SSRF Block: Target URL '${startUrl}' is not in the allowed local sandbox host list.`);
    }

    eventHub.publish({
      runId: this.runId,
      stage: 'queue',
      level: 'info',
      url: startUrl,
      message: `Crawl queue initialized with seed URL: ${startUrl} (Max depth: ${this.maxDepth}, Max pages: ${this.maxPages})`,
      elapsedMs: 0,
      status: 'running'
    });

    // 1. Fetch robots.txt and sitemap.xml
    await this.fetchRobotsAndSitemap(startUrl);

    // 2. Queue seed URL
    this.enqueue(startUrl, 0, null);

    // 3. Process crawl queue
    while (this.queue.length > 0 && this.visited.size < this.maxPages) {
      if (this.isAborted) break;

      const item = this.queue.shift();
      if (!item || this.visited.has(item.url)) continue;

      await this.crawlUrl(item, ruleEngine);
    }

    // 4. Run site-wide and graph-wide rules (orphan pages, sitemap validation, duplicate titles)
    if (!this.isAborted && ruleEngine) {
      await ruleEngine.evaluateGlobalRules({
        runId: this.runId,
        pages: this.pagesData,
        edges: this.edges,
        sitemapUrls: this.sitemapUrls,
        robotsTxt: this.robotsTxt,
        targetUrl: this.targetUrl,
        redirectChains: this.redirectChains
      });
    }

    const totalDuration = Date.now() - this.startTime;
    const summary = {
      crawledCount: this.visited.size,
      edgesCount: this.edges.length,
      durationMs: totalDuration,
      status: this.isAborted ? 'cancelled' : 'completed'
    };

    eventHub.publish({
      runId: this.runId,
      stage: 'verify',
      level: this.isAborted ? 'warn' : 'success',
      message: `Crawl finished: ${this.visited.size} URLs crawled, ${this.edges.length} link graph relationships mapped in ${totalDuration}ms.`,
      elapsedMs: totalDuration,
      status: summary.status,
      evidenceRef: summary
    });

    return summary;
  }

  enqueue(url, depth, fromUrl) {
    if (this.visited.has(url)) return;
    if (this.queue.some(q => q.url === url)) return;
    if (depth > this.maxDepth) return;

    this.queue.push({ url, depth, fromUrl });
    eventHub.publish({
      runId: this.runId,
      stage: 'queue',
      level: 'info',
      url,
      message: `Queued URL at depth ${depth}: ${url} (from: ${fromUrl || 'seed'})`,
      elapsedMs: Date.now() - this.startTime
    });
  }

  async fetchRobotsAndSitemap(startUrl) {
    try {
      const parsed = new URL(startUrl);
      const robotsUrl = `${parsed.origin}/robots.txt`;
      const sitemapUrl = `${parsed.origin}/sitemap.xml`;

      // Fetch robots.txt
      eventHub.publish({
        runId: this.runId,
        stage: 'fetch',
        level: 'info',
        url: robotsUrl,
        message: `Inspecting ${robotsUrl}`,
        elapsedMs: Date.now() - this.startTime
      });

      try {
        const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (res.ok) {
          this.robotsTxt = await res.text();
          eventHub.publish({
            runId: this.runId,
            stage: 'parse',
            level: 'info',
            url: robotsUrl,
            message: `Fetched robots.txt (${this.robotsTxt.length} bytes)`,
            elapsedMs: Date.now() - this.startTime,
            evidenceRef: { snippet: this.robotsTxt.substring(0, 300) }
          });
        }
      } catch (err) {
        // robots.txt optional
      }

      // Fetch sitemap.xml
      eventHub.publish({
        runId: this.runId,
        stage: 'fetch',
        level: 'info',
        url: sitemapUrl,
        message: `Inspecting ${sitemapUrl}`,
        elapsedMs: Date.now() - this.startTime
      });

      try {
        const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (res.ok) {
          const xml = await res.text();
          // Extract <loc> tags with simple regex
          const locMatches = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)];
          this.sitemapUrls = locMatches.map(m => m[1]);
          eventHub.publish({
            runId: this.runId,
            stage: 'parse',
            level: 'info',
            url: sitemapUrl,
            message: `Parsed sitemap.xml: discovered ${this.sitemapUrls.length} declared URLs`,
            elapsedMs: Date.now() - this.startTime,
            evidenceRef: { urlCount: this.sitemapUrls.length, sample: this.sitemapUrls.slice(0, 5) }
          });
        }
      } catch (err) {
        // sitemap optional
      }
    } catch (err) {
      // Ignored
    }
  }

  async crawlUrl({ url, depth, fromUrl }, ruleEngine) {
    this.visited.add(url);
    const fetchStart = Date.now();

    eventHub.publish({
      runId: this.runId,
      stage: 'fetch',
      level: 'info',
      url,
      message: `Fetching [GET]: ${url}`,
      elapsedMs: Date.now() - this.startTime
    });

    try {
      // We manually inspect redirects to capture 301 vs 302 hops (SEO-012)
      let currentUrl = url;
      let redirectChain = [];
      let finalResponse = null;
      let hops = 0;
      const maxHops = 5;

      while (hops < maxHops) {
        if (!isAllowedUrl(currentUrl)) {
          throw new Error(`SSRF Block: Redirect target '${currentUrl}' is outside allowed host boundaries.`);
        }

        const res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: this.abortController.signal,
          headers: {
            'User-Agent': 'SearchForge-SEO-Bot/1.0 (+http://searchforge-seo.local/bot)'
          }
        });

        // Check if redirect
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get('location');
          const nextUrl = normalizeUrl(location, currentUrl);
          redirectChain.push({
            from: currentUrl,
            to: nextUrl,
            status: res.status
          });

          eventHub.publish({
            runId: this.runId,
            stage: 'fetch',
            level: 'warn',
            url: currentUrl,
            message: `HTTP ${res.status} Redirect -> ${nextUrl}`,
            elapsedMs: Date.now() - this.startTime,
            evidenceRef: { status: res.status, location: nextUrl }
          });

          if (!nextUrl) break;
          currentUrl = nextUrl;
          hops++;
        } else {
          finalResponse = res;
          break;
        }
      }

      if (redirectChain.length > 0) {
        this.redirectChains.set(url, redirectChain);
      }

      if (!finalResponse) {
        throw new Error('Redirect loop or empty response');
      }

      const statusCode = finalResponse.status;
      const contentType = finalResponse.headers.get('content-type') || '';
      const responseTime = Date.now() - fetchStart;

      // Record crawl edge if navigated from somewhere
      if (fromUrl) {
        this.edges.push({ fromUrl, toUrl: url, statusCode, contentType });
        db.recordCrawlEdge({
          runId: this.runId,
          fromUrl,
          toUrl: url,
          statusCode,
          contentType
        });
      }

      if (statusCode === 404) {
        eventHub.publish({
          runId: this.runId,
          stage: 'fetch',
          level: 'error',
          url,
          message: `HTTP 404 Not Found: ${url} (linked from: ${fromUrl || 'root'})`,
          elapsedMs: Date.now() - this.startTime,
          status: 'error'
        });

        if (ruleEngine) {
          ruleEngine.evaluate404({
            runId: this.runId,
            url,
            fromUrl,
            statusCode
          });
        }
        return;
      }

      if (!finalResponse.ok) {
        eventHub.publish({
          runId: this.runId,
          stage: 'fetch',
          level: 'warn',
          url,
          message: `HTTP ${statusCode} ${finalResponse.statusText}: ${url}`,
          elapsedMs: Date.now() - this.startTime
        });
        return;
      }

      // Parse HTML
      if (contentType.includes('text/html')) {
        const html = await finalResponse.text();
        const parseStart = Date.now();

        eventHub.publish({
          runId: this.runId,
          stage: 'parse',
          level: 'info',
          url,
          message: `Parsing DOM with Cheerio (${html.length} bytes, HTTP ${statusCode})`,
          elapsedMs: Date.now() - this.startTime
        });

        const $ = cheerio.load(html);
        const parsedData = this.extractPageFeatures($, html, url, finalResponse.headers);
        this.pagesData.set(url, parsedData);

        // Run per-page SEO rules
        if (ruleEngine) {
          await ruleEngine.evaluatePageRules({
            runId: this.runId,
            url,
            fromUrl,
            statusCode,
            headers: finalResponse.headers,
            pageData: parsedData,
            html,
            $
          });
        }

        // Discover and enqueue internal links
        if (depth < this.maxDepth) {
          for (const link of parsedData.internalLinks) {
            this.enqueue(link, depth + 1, url);
          }
        }
      }
    } catch (err) {
      if (this.isAborted) return;
      eventHub.publish({
        runId: this.runId,
        stage: 'fetch',
        level: 'error',
        url,
        message: `Fetch failed for ${url}: ${err.message}`,
        elapsedMs: Date.now() - this.startTime,
        status: 'error'
      });
    }
  }

  extractPageFeatures($, html, pageUrl, headers) {
    const pageUrlObj = new URL(pageUrl);
    const origin = pageUrlObj.origin;

    // Titles
    const titleElements = $('head title');
    const title = titleElements.text().trim();
    const titleCount = titleElements.length;

    // Meta description
    const descMeta = $('head meta[name="description"]');
    const description = descMeta.attr('content') ? descMeta.attr('content').trim() : null;

    // Canonical
    const canonicalLink = $('head link[rel="canonical"]');
    const canonicalHref = canonicalLink.attr('href') ? canonicalLink.attr('href').trim() : null;

    // Robots meta
    const robotsMeta = $('head meta[name="robots"]');
    const robotsContent = robotsMeta.attr('content') ? robotsMeta.attr('content').trim() : null;
    const xRobotsTag = headers.get('x-robots-tag');

    // Headings outline
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      headings.push({
        level: parseInt(el.tagName.substring(1), 10),
        tag: el.tagName.toLowerCase(),
        text: $(el).text().trim().replace(/\s+/g, ' '),
        html: $.html(el)
      });
    });

    // Images
    const images = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt');
      const width = $(el).attr('width');
      const height = $(el).attr('height');
      images.push({
        src,
        alt: alt !== undefined ? alt.trim() : null,
        width: width || null,
        height: height || null,
        snippet: $.html(el)
      });
    });

    // Structured data (JSON-LD)
    const jsonLdBlocks = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      const raw = $(el).html()?.trim() || '';
      let parsed = null;
      let isValidJson = false;
      try {
        parsed = JSON.parse(raw);
        isValidJson = true;
      } catch (err) {
        isValidJson = false;
      }
      jsonLdBlocks.push({ raw, parsed, isValidJson });
    });

    // Open Graph & Twitter
    const ogTitle = $('meta[property="og:title"]').attr('content') || null;
    const ogDescription = $('meta[property="og:description"]').attr('content') || null;
    const ogImage = $('meta[property="og:image"]').attr('content') || null;
    const twitterCard = $('meta[name="twitter:card"]').attr('content') || null;

    // Mobile tap targets
    const smallTapTargets = [];
    $('button, a.btn, a[class*="button"]').each((i, el) => {
      const style = $(el).attr('style') || '';
      const className = $(el).attr('class') || '';
      if (className.includes('tap-small') || style.includes('font-size: 8px') || style.includes('height: 20px')) {
        smallTapTargets.push({
          tag: el.tagName.toLowerCase(),
          text: $(el).text().trim(),
          snippet: $.html(el)
        });
      }
    });

    // Internal links discovery
    const internalLinks = new Set();
    const externalLinks = new Set();
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const normalized = normalizeUrl(href, pageUrl);
      if (!normalized) return;

      try {
        const targetUrlObj = new URL(normalized);
        if (targetUrlObj.origin === origin) {
          internalLinks.add(normalized);
        } else {
          externalLinks.add(normalized);
        }
      } catch (err) {}
    });

    return {
      url: pageUrl,
      title,
      titleCount,
      description,
      canonicalHref,
      robotsContent,
      xRobotsTag,
      headings,
      images,
      jsonLdBlocks,
      socialMeta: { ogTitle, ogDescription, ogImage, twitterCard },
      smallTapTargets,
      internalLinks: Array.from(internalLinks),
      externalLinks: Array.from(externalLinks)
    };
  }
}

module.exports = Crawler;
