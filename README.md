# SearchForge SEO — Technical SEO Rescue Project
> **"Technical SEO. Rebuilt from the foundation up."**

A realistic, high-performance web agency application deliberately engineered with controlled technical SEO problems for diagnosis, remediation, and learning. Built in exact alignment with the **Technology Stack & Architecture Document**, **Product Requirements Document (PRD)**, and **Design System Document (Webncy Agency Reference)**.

---

### 👨‍💻 Project Architect & Author
- **Author**: **Arya Tiwari**
- **Role**: CSE Student & Project Architect
- **Institution**: **Bennett University**, Greater Noida, Uttar Pradesh, India
- **Repository**: [https://github.com/httpsarya/Searchforge-SEO](https://github.com/httpsarya/Searchforge-SEO)
- **Portfolio**: [httpsarya.github.io/Arya_Tiwari_portfolio_12/](https://httpsarya.github.io/Arya_Tiwari_portfolio_12/)
- **GitHub**: [@httpsarya](https://github.com/httpsarya)
- **LinkedIn**: [in/arya-tiwari-01ba84292](https://linkedin.com/in/arya-tiwari-01ba84292/)
- **Contact**: `arya2tiwari@gmail.com` · `+91 9999606103`
- **Documentation**: [SearchForge_Technical_SEO_Rescue_Dossier.pdf](SearchForge_Technical_SEO_Rescue_Dossier.pdf) (10-Page Comprehensive Architectural Dossier)

---

## 🌟 Key Architecture & Highlights

- **Visual DNA (Webncy Agency Reference)**:
  - Deep Charcoal (`#181818`), Deep Black (`#0D0D0D`), Main Content Surfaces (`#FFFFFF`), Off-White (`#F5F5F5`).
  - Vivid Orange Accent (`#FD6909` with hover `#E95700`).
  - Clean geometric typography (**Poppins** with Inter fallbacks).
  - Page Rhythm: `NAVBAR -> DARK HERO -> PROBLEM STRIP -> WHITE ISSUE GRID -> DARK AUDIT DASHBOARD -> RESCUE PROCESS -> BEFORE/AFTER -> METRICS -> DARK CTA -> FOOTER`.
- **Interactive State Switcher (Flawed vs. Rescued)**:
  - Switch between **Pre-Rescue (Flawed Mode)** and **Post-Rescue (Rescued Mode)** with one click via the persistent floating HUD or in-page controls.
  - Changes are stored in `localStorage` and persist as you navigate through different routes!
- **Live In-Page SEO Inspector Drawer**:
  - Click **"Inspect SEO"** on any page to open a real-time diagnostic telemetry drawer inspecting HTTP status, title characters, meta description length, canonical target, robots directives, DOM heading outline, and Core Web Vitals.
- **Dedicated Audit Hub (`/audit.html`)**:
  - **F21**: Core Area Remediation Checklist (Crawlability, Indexability, Metadata, Canonicals, Sitemap, Robots.txt, Internal Links, Performance, Structured Data).
  - **F22 & F23**: SEO Health Dashboard & Before/After Comparison Matrix.
  - **F24**: Complete Technical Issue Repository (SEO-001 through SEO-015) with Category filter, Symptoms, Root Causes, Rescue Fixes, and Validation Methods.

---

## 📂 Complete File & Route Structure

```
searchforge-seo-rescue/
├── index.html                           # Flagship Homepage (Dark hero, scorecard, problem strip, crawl matrix)
├── about.html                           # About Us (Company intro, mission, methodology, leadership team)
├── audit.html                           # Dedicated SEO Audit Hub & Scenario Dashboard (F21-F24)
├── contact.html                         # Interactive Contact Form with Validation (F19)
├── faq.html                             # FAQ with Accordions & Valid FAQPage JSON-LD (F11)
├── 404.html                             # Custom 404 Status Page with Safe Return Links (F17 & SEO-015)
├── privacy-policy.html                  # Privacy Policy & Privacy-Conscious Analytics (F20)
├── terms.html                           # Terms of Service & Acceptable Use Agreement
├── robots.txt                           # Live Robots Directives + Flawed vs Rescued documentation
├── sitemap.xml                          # Canonical XML Sitemap following sitemaps.org
├── site.webmanifest                     # Web App Manifest
├── server.ps1                           # Native PowerShell HTTP Server (Zero-dependency local runner)
├── assets/
│   ├── css/
│   │   └── style.css                    # Webncy Design System tokens, animations, HUD, drawer styles
│   ├── js/
│   │   ├── audit-data.js                # Central dataset of all 15 SEO flaws & before/after metrics
│   │   └── main.js                      # HUD controller, SEO inspector drawer, mobile nav, accordions
│   └── images/
│       ├── favicon.svg                  # Vector SVG favicon
│       └── og-preview.svg               # Open Graph preview card
├── services/
│   ├── index.html                       # Services Overview Grid (Includes SEO-003 broken link demo)
│   ├── technical-seo.html               # Technical SEO Practice (Crawl, index, Core Web Vitals)
│   ├── on-page-seo.html                 # On-Page Architecture (Semantic headings & SEO-004 canonical demo)
│   ├── local-seo.html                   # Local SEO & Multi-Location Entity Graph
│   └── seo-audits.html                  # Forensic Audits & Log Analysis (SEO-012 redirect chain fix)
├── case-studies/
│   ├── index.html                       # Case Studies Index
│   └── retail-growth.html               # Flagship Retail Rescue Postmortem (+240% recovery, SEO-005 demo)
└── blog/
    ├── index.html                       # Blog Archive with Live Search & Topic Filter (F18)
    ├── technical-seo-checklist.html     # The 45-Point Technical SEO Audit Checklist for 2026
    ├── crawlability-guide.html          # Crawl Budget & Bot Traps Deep Dive (Resolves orphan SEO-011)
    └── core-web-vitals-guide.html       # Conquering INP, LCP, and CLS in Modern Stacks
```

---

## 🛠️ The 15 Controlled Technical SEO Flaws (SEO-001 to SEO-015)

| ID | Issue Title | Severity | Affected Location | Pre-Rescue Flaw | Rescued Resolution |
|---|---|---|---|---|---|
| **SEO-001** | Duplicate Title Tags | High | `/about.html` & `/services/` | Both shared identical title: "SearchForge SEO - Professional Services" | Unique route-aware titles |
| **SEO-002** | Missing Meta Description | Medium | `/services/technical-seo.html` | Empty description causing random SERP snippets | 155-char compelling meta description |
| **SEO-003** | Broken Internal Links | High | `/services/index.html` | Anchor pointing to dead 404 endpoint `/services/social-media-seo.html` | Updated link to active `/services/seo-audits.html` |
| **SEO-004** | Canonical to Root | Critical | `/services/on-page-seo.html` | `<link rel="canonical" href="https://searchforge-seo.com/">` | Strict self-referencing canonical URL |
| **SEO-005** | Accidental Noindex Directive | Critical | `/case-studies/retail-growth.html` | `<meta name="robots" content="noindex, follow">` left from staging | Updated to `<meta name="robots" content="index, follow">` |
| **SEO-006** | Robots.txt Disallow | Critical | `/robots.txt` | `Disallow: /services/` blocking 4 core commercial pages | Allow rules & only disallow `/admin/` |
| **SEO-007** | Malformed XML Sitemap | High | `/sitemap.xml` | Contained 404 targets and missing dynamic pages | 100% canonical, indexable 200 OK URLs |
| **SEO-008** | Multiple H1s & Skipped Headings | Medium | `/index.html` & `/about.html` | Up to 3 H1 tags per page and skipped to H4 for styling | Strict single H1 and clean H2/H3 nesting |
| **SEO-009** | Heavy Assets & Missing Alt | High | Homepage & Case Study | 4.2MB uncompressed PNGs without alt or aspect ratios | Compressed WebP, descriptive alt, zero CLS |
| **SEO-010** | Missing / Invalid JSON-LD | Medium | Domain-wide, FAQ & Articles | Missing structured data and broken schema syntax | Schema.org Organization, FAQPage, Article, Breadcrumbs |
| **SEO-011** | Orphaned Content | High | `/blog/crawlability-guide.html` | 2,500-word guide had 0 inbound internal links | Added contextual in-content links from services |
| **SEO-012** | Multi-Hop Redirect Chain | Medium | `/old-audit` -> `/audit-temp` | 2-hop 302 temporary redirect chain | Consolidated single 301 permanent redirect |
| **SEO-013** | Missing Open Graph Tags | Low | All pages | Missing `og:image`, `og:title`, and Twitter card tags | Complete Open Graph & Twitter meta tags |
| **SEO-014** | Mobile Tap Targets & CWV | High | Navigation & Footer | Tap targets smaller than 28px failing mobile UX | Enforced >= 48px touch targets & zero horizontal overflow |
| **SEO-015** | Soft 404 Error Handling | High | `/404.html` & dead routes | Server returned 200 OK for missing URLs | Real 404 status code + recovery navigation |

---

## 📊 Quantitative Before / After Metrics

| Metric | Pre-Rescue (Flawed) | Post-Rescue (Fixed) | Improvement (Delta) |
|---|---|---|---|
| **Lighthouse SEO Score** | **42 / 100** | **98 / 100** | **+56 Points** |
| **Critical Issues** | 8 Active | 0 Active | -100% Eliminated |
| **Broken Internal Links** | 12 Dead Links | 0 Dead Links | -12 Links |
| **Missing / Duplicate Titles** | 11 Pages | 0 Pages | 100% Unique |
| **Missing Image Alt Text** | 18 Assets | 0 Assets | 100% Annotated |
| **Canonical Errors** | 5 URLs | 0 Errors | Strict Self-Referencing |
| **Largest Contentful Paint (LCP)** | 4.8s (Poor) | 1.4s (Good) | -3.4s Speedup |
| **Cumulative Layout Shift (CLS)** | 0.24 (High) | 0.01 (Near Zero) | -0.23 Delta |

---

## 🛰️ Live SEO Operations Center (November 2026 Upgrade)

The project has been upgraded in full alignment with the **Website Upgrade & Practical Mentor Demonstration Technical Implementation Blueprint (Version 1.0)**. It transitions SearchForge SEO into a live, evidence-driven platform capable of real-time local website crawling, live Server-Sent Events (SSE) telemetry streaming, Cheerio server-side DOM rule verification (SEO-001 through SEO-015), isolated sandbox fault injection, unified diff previews, atomic SQLite backups with one-click rollback, and exportable audit proofs.

### Architecture Overview
- **Backend Runtime**: Node.js v24 + Express 5
- **Crawling & Link Graph**: Breadth-first scoped crawler with SSRF boundary protection, redirect chain (301/302) tracking, and real-time directed edge mapping.
- **Rule Engine**: 15 issue-family Cheerio rule checks with raw observed DOM/header evidence snippets.
- **Persistence & Telemetry**: Native `node:sqlite` WAL database (`seo_operations.db`) storing audit runs, monotonic event streams, evidence findings, and file patch backups.
- **Real-Time Stream**: One-way SSE endpoint (`/api/audits/:id/events`) with monotonic event IDs, stage categorization, and auto-replay on reconnect.
- **Safety & Isolation**: Sandbox manager restricts all automated fault injections and patch fixes strictly to `tests/fixtures/sandbox/`.

---

## 🚀 How to Run the Website Locally

### Option 1: Live SEO Operations Center & API (Recommended)
Make sure you are in the project root:
```powershell
cd C:\Users\hp\.gemini\antigravity\scratch\searchforge-seo-rescue
npm start
```
This boots the Express Operations Center server on `http://localhost:3000/`:
- **Live Operations Center**: [http://localhost:3000/operations-center.html](http://localhost:3000/operations-center.html)
- **Isolated Sandbox Mirror**: [http://localhost:3000/sandbox/index.html](http://localhost:3000/sandbox/index.html)
- **Technical SEO Audit Hub**: [http://localhost:3000/audit.html](http://localhost:3000/audit.html)
- **Architectural Dossier**: [http://localhost:3000/project-dossier.html](http://localhost:3000/project-dossier.html)

### Running Automated Integration Tests
To verify server routing, SSRF security, fault injection, crawler detection, fix application, rollback, and reports:
```powershell
npm test
```
*(Runs native Node.js integration suite `tests/integration/audit.test.js`)*

### Resetting the Isolated Sandbox
To clean and restore the sandbox directory back to pristine baseline files:
```powershell
npm run sandbox:reset
```

### Option 2: Native PowerShell HTTP Server (Zero-Dependency Fallback)
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

---

## 🎓 Mentor Demonstration Walkthrough (SEO-005)

A mentor or reviewer can execute the complete end-to-end remediation pipeline with zero simulated delays:

1. **Open Operations Center**: Navigate to [http://localhost:3000/operations-center.html](http://localhost:3000/operations-center.html).
2. **Inject Fault**: Click **"Run Mentor Demo (SEO-005)"** or choose *SEO-005: Accidental Noindex* from the scenario dropdown and click **"Inject Fault"**.
3. **Start Live Crawl**: The crawler initiates `http://localhost:3000/sandbox/index.html` (or targeted fixture), streaming live HTTP requests, parsing DOM features, and mapping graph edges.
4. **Watch Live Telemetry**: Inspect real-time SSE events in the **Live Activity Console** (colorized stages: `QUEUE` -> `FETCH` -> `PARSE` -> `RULE`).
5. **Inspect Observed Evidence**: Locate finding **[SEO-005]** in the Findings Repository. Review the raw observed DOM snippet: `<meta name="robots" content="noindex, follow">`.
6. **Review Unified Diff**: Click **"Review Proposed Fix"** to view the generated before/after unified patch diff in the modal dialog.
7. **Apply Patch to Sandbox**: Click **"Confirm & Apply to Sandbox"**. The engine saves an atomic backup to SQLite and patches the isolated sandbox file.
8. **Re-Crawl & Verify**: Click **"Start Live Crawl"** to recrawl the sandbox. Finding SEO-005 is eliminated, and the measured Health Score climbs.
9. **Export Proof**: Click **"PDF / Print"** for a printable executive audit dossier, or **"JSON"** for downloadable evidence payload.

---

## 📡 API Contract Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/audits` | `POST` | Create a new crawl run (`{ targetUrl, maxPages, maxDepth }`) |
| `/api/audits` | `GET` | List all historical audits from SQLite |
| `/api/audits/:id` | `GET` | Retrieve audit run status, summary metrics, and findings |
| `/api/audits/:id/events` | `GET` | SSE telemetry stream with replay via `Last-Event-ID` |
| `/api/audits/:id/findings` | `GET` | Fetch evidence-backed findings for run |
| `/api/audits/:id/graph` | `GET` | Discovered crawl graph nodes and directed edges |
| `/api/audits/:id/cancel` | `POST` | Abort an active crawler run |
| `/api/audits/:id/report` | `GET` | Downloadable evidence report (`?format=json` or `?format=html`) |
| `/api/demo/inject` | `POST` | Inject controlled flaw into sandbox copy (`{ issueId }`) |
| `/api/demo/reset` | `POST` | Deterministically reset sandbox fixture to clean baseline |
| `/api/demo/scenarios` | `GET` | List all injectable SEO scenario definitions |
| `/api/fixes/preview` | `POST` | Generate unified diff patch preview (`{ issueId }`) |
| `/api/fixes/apply` | `POST` | Apply approved fix with SQLite backup (`{ issueId, runId }`) |
| `/api/fixes/rollback` | `POST` | Restore previous file state from backup (`{ backupId }`) |

---

## 🔍 Validation with Technical SEO Tools

- **Google Lighthouse**: Open Chrome DevTools (`F12`) &rarr; **Lighthouse** &rarr; Select **SEO** and **Best Practices** &rarr; Click **Analyze page load**.
- **Screaming Frog SEO Spider**: Enter `http://localhost:3000/` &rarr; Click **Start** to verify:
  - Canonical URLs (Self-referencing everywhere).
  - Title tags (100% unique, <= 60 characters).
  - Robots directives (100% index, follow on valid pages).
  - Broken links (0 dead status codes).
- **Google Rich Results Test**: Paste the HTML or URL of `faq.html` or `index.html` to confirm valid **FAQPage** and **Organization** structured data.
