/**
 * SearchForge SEO Rescue - Main Interactive Controller
 * Powers Rescue Mode toggling, Live SEO Inspector Drawer, Mobile Nav, Accordions & Filters
 */

(function () {
  'use strict';

  // State Management
  const STATE_KEY = 'seo_rescue_mode'; // 'flawed' or 'rescued'
  let currentMode = localStorage.getItem(STATE_KEY) || 'rescued';

  // Initialize once DOM is ready
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    renderFloatingHUD();
    renderInspectorDrawer();
    setupMobileNav();
    setupAccordions();
    setupBlogFilters();
    setupContactForm();
    applyRescueMode(currentMode, false);
    initSmoothScroll();
  }

  // --- RESCUE MODE CONTROLLER ---
  function applyRescueMode(mode, notify = true) {
    currentMode = mode;
    localStorage.setItem(STATE_KEY, mode);
    document.documentElement.setAttribute('data-seo-mode', mode);

    // Update HUD toggle buttons
    const optFlawed = document.getElementById('hud-opt-flawed');
    const optRescued = document.getElementById('hud-opt-rescued');
    if (optFlawed && optRescued) {
      if (mode === 'flawed') {
        optFlawed.classList.add('active-flawed');
        optRescued.classList.remove('active-rescued');
      } else {
        optRescued.classList.add('active-rescued');
        optFlawed.classList.remove('active-flawed');
      }
    }

    // Toggle deliberate in-page flaws visibility and attributes
    const flawElements = document.querySelectorAll('[data-flawed-target]');
    flawElements.forEach(el => {
      const isFlawedMode = mode === 'flawed';
      if (isFlawedMode) {
        el.classList.add('deliberate-flaw-marker');
        if (!el.querySelector('.deliberate-flaw-tag')) {
          const tag = document.createElement('span');
          tag.className = 'deliberate-flaw-tag';
          tag.textContent = el.getAttribute('data-flaw-id') || 'SEO FLAW';
          el.appendChild(tag);
        }
      } else {
        el.classList.remove('deliberate-flaw-marker');
        const tag = el.querySelector('.deliberate-flaw-tag');
        if (tag) tag.remove();
      }
    });

    // Update Dynamic Score Badges & Counters on page
    const scoreDisplays = document.querySelectorAll('.dynamic-seo-score');
    scoreDisplays.forEach(el => {
      el.textContent = mode === 'flawed' ? '42' : '98';
    });

    const scoreGradeDisplays = document.querySelectorAll('.dynamic-seo-grade');
    scoreGradeDisplays.forEach(el => {
      el.textContent = mode === 'flawed' ? 'Poor (8 Critical Errors)' : 'Excellent (All Rescued)';
      el.className = mode === 'flawed' 
        ? 'dynamic-seo-grade text-red-500 font-semibold' 
        : 'dynamic-seo-grade text-emerald-500 font-semibold';
    });

    // Update Live SEO Inspector Content if drawer is open or exists
    updateInspectorMetrics();

    // Custom Event for page-specific hooks
    window.dispatchEvent(new CustomEvent('seoModeChanged', { detail: { mode } }));

    if (notify) {
      showToast(`Switched to: ${mode === 'flawed' ? 'Flawed Mode (Pre-Rescue)' : 'Rescued Mode (Post-Rescue)'}`);
    }
  }

  // --- FLOATING RESCUE CONTROLLER (HUD) ---
  function renderFloatingHUD() {
    if (document.getElementById('seo-floating-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'seo-floating-hud';
    hud.className = 'seo-hud';
    hud.setAttribute('role', 'region');
    hud.setAttribute('aria-label', 'SEO Scenario Controller');

    hud.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full ${currentMode === 'flawed' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}"></span>
          <span class="font-bold text-xs uppercase tracking-wider text-neutral-300 hidden sm:inline">Scenario:</span>
        </div>
        <div class="hud-toggle" role="group" aria-label="Toggle SEO Scenario">
          <button id="hud-opt-flawed" type="button" class="hud-toggle-option ${currentMode === 'flawed' ? 'active-flawed' : ''}" title="View Website with Intentional SEO Flaws">
            Flawed
          </button>
          <button id="hud-opt-rescued" type="button" class="hud-toggle-option ${currentMode === 'rescued' ? 'active-rescued' : ''}" title="View Website with Fully Rescued SEO">
            Rescued
          </button>
        </div>
      </div>
      <div class="h-4 w-px bg-neutral-700 hidden sm:block"></div>
      <div class="flex items-center gap-2">
        <button id="btn-open-inspector" type="button" class="text-xs font-semibold text-neutral-200 hover:text-white px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 transition flex items-center gap-1.5" title="Inspect Current Page Technical SEO">
          <svg class="w-3.5 h-3.5 text-[#FD6909]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <span>Inspect SEO</span>
        </button>
        <a href="${getRelativePrefix()}audit.html" class="text-xs font-semibold text-white px-2.5 py-1.5 rounded bg-[#FD6909] hover:bg-[#E95700] transition flex items-center gap-1.5" title="Open Full Technical SEO Rescue Audit Dashboard">
          <span>Audit Hub</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </a>
      </div>
    `;

    document.body.appendChild(hud);

    // Event listeners
    document.getElementById('hud-opt-flawed').addEventListener('click', () => applyRescueMode('flawed'));
    document.getElementById('hud-opt-rescued').addEventListener('click', () => applyRescueMode('rescued'));
    document.getElementById('btn-open-inspector').addEventListener('click', toggleInspectorDrawer);
  }

  // --- LIVE SEO INSPECTOR DRAWER ---
  function renderInspectorDrawer() {
    if (document.getElementById('seo-inspector-drawer')) return;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'inspector-overlay';
    overlay.className = 'inspector-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeInspectorDrawer);

    // Drawer
    const drawer = document.createElement('div');
    drawer.id = 'seo-inspector-drawer';
    drawer.className = 'seo-inspector-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Real-time Technical SEO Inspector');

    drawer.innerHTML = `
      <div class="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-[#FD6909]"></span>
            <h3 class="font-bold text-white text-base tracking-wide">Live SEO Inspector</h3>
          </div>
          <p class="text-xs text-neutral-400 mt-1">Real-time DOM & Crawler Diagnostic Telemetry</p>
        </div>
        <button id="btn-close-inspector" type="button" class="text-neutral-400 hover:text-white p-2 rounded-md hover:bg-neutral-800 transition" aria-label="Close Inspector">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 space-y-6 text-sm" id="inspector-body">
        <!-- Telemetry Cards populated dynamically -->
      </div>

      <div class="p-4 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
        <span class="text-xs text-neutral-400">SearchForge Engine v2.0</span>
        <button type="button" id="inspector-quick-toggle" class="text-xs font-semibold px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white transition">
          Switch to ${currentMode === 'flawed' ? 'Rescued' : 'Flawed'}
        </button>
      </div>
    `;

    document.body.appendChild(drawer);

    document.getElementById('btn-close-inspector').addEventListener('click', closeInspectorDrawer);
    document.getElementById('inspector-quick-toggle').addEventListener('click', () => {
      applyRescueMode(currentMode === 'flawed' ? 'rescued' : 'flawed');
      updateInspectorMetrics();
    });
  }

  function toggleInspectorDrawer() {
    const drawer = document.getElementById('seo-inspector-drawer');
    const overlay = document.getElementById('inspector-overlay');
    if (!drawer) return;
    if (drawer.classList.contains('open')) {
      closeInspectorDrawer();
    } else {
      drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      updateInspectorMetrics();
    }
  }

  function closeInspectorDrawer() {
    const drawer = document.getElementById('seo-inspector-drawer');
    const overlay = document.getElementById('inspector-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  function updateInspectorMetrics() {
    const body = document.getElementById('inspector-body');
    const quickToggle = document.getElementById('inspector-quick-toggle');
    if (quickToggle) {
      quickToggle.textContent = currentMode === 'flawed' ? 'Switch to Rescued Mode' : 'Switch to Flawed Mode';
    }
    if (!body) return;

    // Gather Live Page Data
    const titleEl = document.querySelector('title');
    const metaDesc = document.querySelector('meta[name="description"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const robots = document.querySelector('meta[name="robots"]');
    const h1Count = document.querySelectorAll('h1').length;
    const h2Count = document.querySelectorAll('h2').length;
    const images = document.querySelectorAll('img');
    let imagesWithAlt = 0;
    images.forEach(img => { if (img.getAttribute('alt')) imagesWithAlt++; });

    const isFlawed = currentMode === 'flawed';

    // Mock scenario adjustments depending on mode
    const displayTitle = isFlawed ? "SearchForge SEO - Professional Services" : (titleEl ? titleEl.innerText : "SearchForge SEO");
    const displayDesc = isFlawed ? "(Missing / Truncated meta description tag)" : (metaDesc ? metaDesc.getAttribute('content') : "Technical SEO consultancy engineering high-performance crawlability and revenue growth.");
    const displayCanonical = isFlawed ? "https://searchforge-seo.com/ (Incorrect Root Reference)" : (canonical ? canonical.getAttribute('href') : window.location.href);
    const displayRobots = isFlawed ? "noindex, follow (Staging Leakage Defect)" : (robots ? robots.getAttribute('content') : "index, follow");
    const displayScore = isFlawed ? "42 / 100" : "98 / 100";
    const displayLCP = isFlawed ? "4.8s (Poor)" : "1.4s (Good)";
    const displayCLS = isFlawed ? "0.24 (High Shift)" : "0.01 (Zero Shift)";

    body.innerHTML = `
      <!-- Overall Health Card -->
      <div class="p-4 rounded-lg bg-neutral-900/90 border ${isFlawed ? 'border-red-900/60' : 'border-emerald-900/60'}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs uppercase font-semibold tracking-wider text-neutral-400">Technical Health</span>
          <span class="badge ${isFlawed ? 'badge-broken' : 'badge-fixed'}">${isFlawed ? '8 Flaws Active' : 'All Validated'}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold ${isFlawed ? 'text-red-500' : 'text-emerald-400'}">${displayScore}</span>
          <span class="text-xs text-neutral-400">Lighthouse SEO Score</span>
        </div>
        <div class="w-full bg-neutral-800 h-2 rounded-full mt-3 overflow-hidden">
          <div class="h-full ${isFlawed ? 'bg-red-500 w-[42%]' : 'bg-emerald-500 w-[98%]'} transition-all duration-500"></div>
        </div>
      </div>

      <!-- HTTP & Crawl Directives -->
      <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400">1. Crawl & Index Directives</h4>
        <div class="p-3.5 bg-neutral-900 rounded-md border border-neutral-800 space-y-2">
          <div class="flex justify-between items-start">
            <span class="text-neutral-400 text-xs">HTTP Status:</span>
            <span class="font-mono text-xs text-emerald-400 font-semibold">200 OK</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-neutral-400 text-xs">Robots Tag:</span>
            <span class="font-mono text-xs ${isFlawed ? 'text-red-400 font-semibold' : 'text-emerald-400'}">${displayRobots}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-neutral-400 text-xs">Canonical URL:</span>
            <span class="font-mono text-xs ${isFlawed ? 'text-red-400 break-all text-right' : 'text-neutral-200 break-all text-right'}">${displayCanonical}</span>
          </div>
        </div>
      </div>

      <!-- Metadata Audit -->
      <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400">2. Metadata & Entities</h4>
        <div class="p-3.5 bg-neutral-900 rounded-md border border-neutral-800 space-y-3">
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-neutral-400">Title Tag:</span>
              <span class="${displayTitle.length > 60 || isFlawed ? 'text-amber-400' : 'text-emerald-400'}">${displayTitle.length} chars</span>
            </div>
            <p class="font-mono text-xs text-neutral-200 bg-neutral-950 p-2 rounded border border-neutral-800">${escapeHTML(displayTitle)}</p>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-neutral-400">Meta Description:</span>
              <span class="${isFlawed ? 'text-red-400' : 'text-emerald-400'}">${isFlawed ? '0 chars' : displayDesc.length + ' chars'}</span>
            </div>
            <p class="font-mono text-xs text-neutral-200 bg-neutral-950 p-2 rounded border border-neutral-800">${escapeHTML(displayDesc)}</p>
          </div>
        </div>
      </div>

      <!-- DOM & Heading Structure -->
      <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400">3. Document Outline & Images</h4>
        <div class="p-3.5 bg-neutral-900 rounded-md border border-neutral-800 grid grid-cols-2 gap-3">
          <div class="p-2.5 bg-neutral-950 rounded border border-neutral-800">
            <div class="text-neutral-400 text-xs">H1 Count</div>
            <div class="text-lg font-bold ${isFlawed ? 'text-red-400' : 'text-emerald-400'}">${isFlawed ? '2 (Duplicate H1)' : '1 (Optimal)'}</div>
          </div>
          <div class="p-2.5 bg-neutral-950 rounded border border-neutral-800">
            <div class="text-neutral-400 text-xs">H2 Subheadings</div>
            <div class="text-lg font-bold text-neutral-200">${h2Count} Elements</div>
          </div>
          <div class="p-2.5 bg-neutral-950 rounded border border-neutral-800 col-span-2">
            <div class="flex justify-between text-xs text-neutral-400 mb-1">
              <span>Image Alt Attributes</span>
              <span class="${isFlawed ? 'text-red-400' : 'text-emerald-400'} font-semibold">${isFlawed ? 'Missing on 3 assets' : '100% Present'}</span>
            </div>
            <div class="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div class="h-full ${isFlawed ? 'bg-red-500 w-[50%]' : 'bg-emerald-500 w-full'}"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Core Web Vitals Simulation -->
      <div class="space-y-3">
        <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400">4. Core Web Vitals Telemetry</h4>
        <div class="p-3.5 bg-neutral-900 rounded-md border border-neutral-800 grid grid-cols-3 gap-2 text-center">
          <div class="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div class="text-[11px] text-neutral-400 font-mono">LCP</div>
            <div class="text-xs font-bold mt-1 ${isFlawed ? 'text-red-400' : 'text-emerald-400'}">${displayLCP}</div>
          </div>
          <div class="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div class="text-[11px] text-neutral-400 font-mono">INP</div>
            <div class="text-xs font-bold mt-1 ${isFlawed ? 'text-amber-400' : 'text-emerald-400'}">${isFlawed ? '380ms' : '45ms'}</div>
          </div>
          <div class="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div class="text-[11px] text-neutral-400 font-mono">CLS</div>
            <div class="text-xs font-bold mt-1 ${isFlawed ? 'text-red-400' : 'text-emerald-400'}">${displayCLS}</div>
          </div>
        </div>
      </div>

      <!-- Structured Data -->
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400">5. JSON-LD Structured Data</h4>
          <span class="badge ${isFlawed ? 'badge-broken' : 'badge-healthy'}">${isFlawed ? 'Schema Syntax Error' : 'Valid Schema.org'}</span>
        </div>
        <pre class="code-box text-[11px] max-h-40 overflow-y-auto">{
  "@context": "https://schema.org",
  "@type": "${isFlawed ? 'UnknownCustomObject' : 'Organization'}",
  "name": "SearchForge SEO",
  "founder": "Arya Tiwari (Bennett University)",
  "url": "https://searchforge-seo.com",
  "status": "${isFlawed ? 'SCHEMA_VALIDATION_FAILED' : 'VALIDATED'}"
}</pre>
      </div>
    `;
  }

  // --- MOBILE NAVIGATION ---
  function setupMobileNav() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-nav-menu');
    if (!toggleBtn || !mobileMenu) return;

    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
      mobileMenu.classList.toggle('hidden');
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.add('hidden');
      }
    });
  }

  // --- FAQ ACCORDIONS ---
  function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.accordion-item');
        const isActive = item.classList.contains('active');

        // Close sibling accordions in same group
        const group = item.closest('.accordion-group');
        if (group) {
          group.querySelectorAll('.accordion-item').forEach(sibling => {
            sibling.classList.remove('active');
            sibling.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
          });
        }

        if (!isActive) {
          item.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          item.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // --- BLOG FILTERS & SEARCH ---
  function setupBlogFilters() {
    const searchInput = document.getElementById('blog-search-input');
    const filterButtons = document.querySelectorAll('.blog-filter-btn');
    const blogCards = document.querySelectorAll('.blog-post-card');

    if (!blogCards.length) return;

    function filterPosts() {
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const activeFilterBtn = document.querySelector('.blog-filter-btn.active');
      const activeCategory = activeFilterBtn ? activeFilterBtn.getAttribute('data-category') : 'all';

      let visibleCount = 0;
      blogCards.forEach(card => {
        const category = card.getAttribute('data-category');
        const title = (card.querySelector('.blog-card-title')?.innerText || '').toLowerCase();
        const excerpt = (card.querySelector('.blog-card-excerpt')?.innerText || '').toLowerCase();

        const matchesCategory = activeCategory === 'all' || category === activeCategory;
        const matchesQuery = !query || title.includes(query) || excerpt.includes(query);

        if (matchesCategory && matchesQuery) {
          card.style.display = 'block';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      const noResults = document.getElementById('blog-no-results');
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', filterPosts);
    }

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active', 'bg-[#FD6909]', 'text-white'));
        btn.classList.add('active', 'bg-[#FD6909]', 'text-white');
        filterPosts();
      });
    });
  }

  // --- CONTACT FORM VALIDATION ---
  function setupContactForm() {
    const form = document.getElementById('seo-contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let hasErrors = false;
      const name = form.querySelector('[name="name"]');
      const email = form.querySelector('[name="email"]');
      const message = form.querySelector('[name="message"]');

      // Clear previous error styles
      [name, email, message].forEach(input => {
        if (input) {
          input.classList.remove('border-red-500', 'bg-red-50');
          const errEl = input.parentElement.querySelector('.form-field-error');
          if (errEl) errEl.remove();
        }
      });

      function showError(input, msg) {
        hasErrors = true;
        input.classList.add('border-red-500');
        const err = document.createElement('p');
        err.className = 'form-field-error text-xs text-red-500 font-medium mt-1';
        err.textContent = msg;
        input.parentElement.appendChild(err);
      }

      if (!name.value.trim()) {
        showError(name, 'Please enter your full name.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.value.trim() || !emailRegex.test(email.value.trim())) {
        showError(email, 'Please provide a valid business email address.');
      }

      if (!message.value.trim() || message.value.trim().length < 10) {
        showError(message, 'Please provide project details (minimum 10 characters).');
      }

      if (!hasErrors) {
        // Render success state
        form.innerHTML = `
          <div class="p-8 text-center bg-neutral-900 rounded-lg border border-emerald-500/50">
            <div class="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">Audit Request Submitted</h3>
            <p class="text-neutral-300 text-sm mb-6">Our technical SEO diagnostic team will inspect your domain architecture and send back a full crawl breakdown within 24 hours.</p>
            <span class="badge badge-fixed">Submission Recorded (Simulated)</span>
          </div>
        `;
      }
    });
  }

  // --- TOAST NOTIFICATION ---
  function showToast(message) {
    let toast = document.getElementById('seo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'seo-toast';
      toast.className = 'fixed top-20 right-6 z-[10001] bg-[#181818] border border-[#FD6909] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 transform transition-all duration-300 opacity-0 translate-y-[-10px]';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#FD6909]"></span> ${message}`;
    toast.classList.remove('opacity-0', 'translate-y-[-10px]');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-[-10px]');
    }, 2800);
  }

  // Helper to determine relative link prefix based on nesting level
  function getRelativePrefix() {
    const path = window.location.pathname;
    if (path.includes('/services/') || path.includes('/case-studies/') || path.includes('/blog/')) {
      return '../';
    }
    return '';
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#' || targetId === '') return;
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // Expose global helper
  window.SearchForge = {
    setRescueMode: applyRescueMode,
    getRescueMode: () => currentMode,
    toggleInspector: toggleInspectorDrawer
  };
})();
