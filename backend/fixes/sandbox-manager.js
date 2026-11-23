const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');
const SANDBOX_DIR = path.join(FIXTURES_DIR, 'sandbox');

// Strict allowlist of editable relative paths in sandbox
const ALLOWLISTED_FILES = new Set([
  'case-studies/retail-growth.html',
  'services/on-page-seo.html',
  'services/technical-seo.html',
  'services/index.html',
  'services/local-seo.html',
  'services/seo-audits.html',
  'blog/crawlability-guide.html',
  'blog/core-web-vitals-guide.html',
  'blog/technical-seo-checklist.html',
  'about.html',
  'index.html',
  'contact.html',
  'faq.html',
  'robots.txt',
  'sitemap.xml'
]);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip node_modules, .git, tests, backend, brain
    if (['node_modules', '.git', 'tests', 'backend', '.gemini', 'package.json', 'package-lock.json'].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

class SandboxManager {
  constructor() {
    this.sandboxDir = SANDBOX_DIR;
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(SANDBOX_DIR)) {
      this.reset();
    }
  }

  reset() {
    if (fs.existsSync(SANDBOX_DIR)) {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    copyDirRecursive(ROOT_DIR, SANDBOX_DIR);
    return { success: true, message: 'Sandbox reset to pristine baseline copy.' };
  }

  resolveSafePath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!ALLOWLISTED_FILES.has(normalized)) {
      throw new Error(`Access Denied: Path '${normalized}' is not in the sandbox allowlist.`);
    }

    const fullPath = path.resolve(SANDBOX_DIR, normalized);
    // Path traversal check
    if (!fullPath.startsWith(SANDBOX_DIR)) {
      throw new Error(`Security Violation: Path traversal outside sandbox boundary.`);
    }

    return { fullPath, normalized };
  }

  readFile(relativePath) {
    const { fullPath } = this.resolveSafePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found in sandbox: ${relativePath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  writeFile(relativePath, content) {
    const { fullPath } = this.resolveSafePath(relativePath);
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}

module.exports = new SandboxManager();
