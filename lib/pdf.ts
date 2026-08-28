/**
 * Launching a browser for server-side PDF rendering.
 *
 * `puppeteer.launch()` uses the Chromium it downloads at install time, which is
 * not always there — a `--ignore-scripts` install, a trimmed CI image, or a
 * machine where the download was skipped. When it is missing, a perfectly good
 * system Chrome usually is not, so fall back to that rather than failing the
 * request.
 *
 * Set `PUPPETEER_EXECUTABLE_PATH` to force a particular binary.
 */
import puppeteer, { type Browser } from "puppeteer";
import * as fs from "node:fs";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];

/** Where a system Chrome usually lives, in the order we would prefer one. */
const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p): p is string => Boolean(p));

function systemChrome(): string | undefined {
  return CANDIDATES.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

/**
 * Always pair with `await browser.close()` in a `finally` — a leaked Chromium
 * outlives the request and the machine runs out of memory by degrees.
 */
export async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
  } catch (err) {
    const executablePath = systemChrome();
    if (!executablePath) {
      throw new Error(
        "No browser available to render the PDF. Run `npx puppeteer browsers install chrome`, " +
          "or set PUPPETEER_EXECUTABLE_PATH to a Chrome binary. " +
          `(${err instanceof Error ? err.message.split("\n")[0] : String(err)})`,
      );
    }
    return puppeteer.launch({ headless: true, args: LAUNCH_ARGS, executablePath });
  }
}
