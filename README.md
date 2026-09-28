# testbench

A minimal real-browser testbench. It serves a small page, drives it with Playwright, captures a screenshot, and writes an HTML report.

## Run locally

```sh
npm ci
npx playwright install chromium
npm run test:static
npm test
```

The browser run writes `tests/.artifacts/testbench.png` and `tests/.artifacts/report.html`. The directory is ignored and must not be committed.

## Run with Docker

```sh
docker build -t testbench .
docker run --rm testbench
```

The image installs Chromium and its system dependencies before running the browser scenario.
