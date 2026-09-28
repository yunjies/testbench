# Testbench tests

Run from the repository root:

```sh
npm ci
npm run test:static
npx playwright install chromium
npm test
```

`npm test` starts the local fixture server, drives a real Chromium page, and writes screenshots, traces, server logs, and `report.html` under `tests/.artifacts/`. The directory is ignored by Git and is runtime evidence, not source.

For a preinstalled browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or `CHROMIUM_EXECUTABLE_PATH`. Docker remains the reproducible path when the host does not provide a compatible browser runtime.
