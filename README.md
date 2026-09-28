# testbench

A minimal real-browser testbench. It serves a small page, drives it with Playwright, captures a screenshot, and writes an HTML report.

## Run locally

Test commands and artifact rules are also documented in `tests/README.md`.

```sh
npm ci
npx playwright install chromium
npm run test:static
npm test
```

When a system Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (or `CHROMIUM_EXECUTABLE_PATH`) to its executable. The test runner uses that executable explicitly; otherwise it uses Playwright's managed Chromium. The browser run writes `tests/.artifacts/testbench.png`, `tests/.artifacts/trace.zip`, server stdout/stderr logs, and `tests/.artifacts/report.html`. The directory is ignored and must not be committed.

## Run with Docker

```sh
docker build -t testbench .
docker run --rm testbench
```

The image installs Chromium and its system dependencies before running the browser scenario.
