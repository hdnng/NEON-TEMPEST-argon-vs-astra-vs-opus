import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const session = await browser.newBrowserCDPSession();
  const info = await session.send("SystemInfo.getInfo");
  console.log(
    JSON.stringify(
      { devices: info.gpu.devices, features: info.gpu.featureStatus },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
