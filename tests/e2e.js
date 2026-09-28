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
const tracePath = path.join(artifacts, 'trace.zip');
const stdoutPath = path.join(artifacts, 'server.stdout.log');
const stderrPath = path.join(artifacts, 'server.stderr.log');

function findChromium() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH;
  if (configured) return configured;
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  const browserCache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  if (fs.existsSync(browserCache)) {
    for (const version of fs.readdirSync(browserCache).filter((name) => name.startsWith('chromium-'))) {
      for (const platform of ['chrome-linux', 'chrome-linux64']) {
        candidates.push(path.join(browserCache, version, platform, 'chrome'));
      }
    }
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

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
  const serverStdout = fs.createWriteStream(stdoutPath);
  const serverStderr = fs.createWriteStream(stderrPath);
  const server = spawn(process.execPath, [path.join(root, 'src/server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.pipe(serverStdout);
  server.stderr.pipe(serverStderr);

  let browser;
  let context;
  let userDataDir;
  let passed = false;
  let detail = '';
  let failure;
  try {
    await waitForServer(server);
    const executablePath = findChromium();
    userDataDir = fs.mkdtempSync(path.join(artifacts, 'chromium-profile-'));
    const launchOptions = {
      headless: true,
      timeout: 10000,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--disable-breakpad',
        '--disable-crash-reporter',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
      viewport: { width: 800, height: 600 }
    };
    const launchPromise = chromium.launchPersistentContext(userDataDir, launchOptions);
    launchPromise.catch(() => {});
    context = await Promise.race([
      launchPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('browser launch timed out')), 10000))
    ]);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
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
  } catch (error) {
    failure = error;
    detail = error.stack || String(error);
  } finally {
    if (context) {
      await context.tracing.stop({ path: tracePath }).catch((error) => {
        passed = false;
        failure ||= error;
        detail = detail || error.stack || String(error);
      });
    }
    if (context) await context.close().catch(() => {});
    else if (browser) await browser.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      server.once('close', resolve);
      setTimeout(resolve, 1000);
    });
    serverStdout.end();
    serverStderr.end();
  }

  const escaped = detail.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const result = passed ? 'PASS' : 'FAIL';
  fs.writeFileSync(reportPath, '<!doctype html><meta charset="utf-8"><title>testbench report</title><h1>testbench report</h1><p class="result">' + result + '</p><pre>' + escaped + '</pre><ul><li><a href="testbench.png">Screenshot</a></li><li><a href="trace.zip">Trace</a></li><li><a href="server.stdout.log">Server stdout</a></li><li><a href="server.stderr.log">Server stderr</a></li></ul>\n');
  if (passed) {
    console.log('e2e passed');
  } else {
    console.error(failure && (failure.stack || failure));
    process.exitCode = 1;
  }
  console.log('report: ' + reportPath);
  console.log('screenshot: ' + screenshotPath);
  console.log('trace: ' + tracePath);
  console.log('server logs: ' + stdoutPath + ', ' + stderrPath);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
