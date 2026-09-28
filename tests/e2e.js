const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(__dirname, '.artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const port = 3100 + Math.floor(Math.random() * 1000);
const reportPath = path.join(artifacts, 'report.html');
const screenshotPath = path.join(artifacts, 'testbench.png');

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server startup timed out')), 10000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('testbench listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== null) reject(new Error('server exited with ' + code));
    });
  });
}

(async () => {
  const server = spawn(process.execPath, [path.join(root, 'src/server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser;
  let passed = false;
  let detail = '';
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').textContent(), 'Testbench');
    assert.equal(await page.locator('#status').textContent(), 'Ready');
    await page.click('#run');
    const deadline = Date.now() + 3000;
    while (await page.locator('#status').textContent() !== 'Check passed' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(await page.locator('#status').textContent(), 'Check passed');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    detail = 'Browser rendered the page and completed the interactive check.';
    passed = true;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  const escaped = detail.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  fs.writeFileSync(reportPath, '<!doctype html><meta charset="utf-8"><title>testbench report</title><h1>testbench report</h1><p class="result">' + (passed ? 'PASS' : 'FAIL') + '</p><p>' + escaped + '</p><p>Screenshot: <a href="testbench.png">testbench.png</a></p>\n');
  console.log('e2e passed');
  console.log('report: ' + reportPath);
  console.log('screenshot: ' + screenshotPath);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
