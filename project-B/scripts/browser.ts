import { chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
export async function browserSession() {
  let server: ChildProcess | undefined;
  const url = "http://127.0.0.1:5173";
  try {
    await fetch(url);
  } catch {
    server = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
      { stdio: "ignore", windowsHide: true },
    );
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        await fetch(url);
        break;
      } catch {}
    }
  }
  const browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--enable-precise-memory-info",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  // tsx preserves names using this helper inside serialized evaluate callbacks.
  await page.addInitScript("window.__name = (value) => value;");
  return {
    browser,
    page,
    url,
    close: async () => {
      await browser.close();
      server?.kill();
    },
  };
}
