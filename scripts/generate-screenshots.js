/**
 * Generate Play Store Screenshots
 * Captures screenshots from live GUAP site at Android phone dimensions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../play-store-assets/screenshots');
const SITE_URL = 'https://guap.gold';

// Android phone dimensions (1080x1920 - most common)
const VIEWPORT = {
  width: 1080,
  height: 1920,
  deviceScaleFactor: 2,
};

const SCREENSHOTS = [
  {
    name: '01-markets',
    url: '/',
    title: 'Browse Markets',
    waitFor: '[data-testid="market-card"], .market-card, article',
    delay: 2000,
  },
  {
    name: '02-market-detail',
    url: '/markets', // Will need to click into a market
    title: 'Trade on Events',
    waitFor: 'button',
    delay: 2000,
    action: async (page) => {
      // Click first market
      const firstMarket = await page.$('a[href*="/markets/"]');
      if (firstMarket) await firstMarket.click();
      await page.waitForTimeout(2000);
    }
  },
  {
    name: '03-portfolio',
    url: '/portfolio',
    title: 'Track Positions',
    waitFor: 'main',
    delay: 2000,
  },
  {
    name: '04-wallet',
    url: '/wallet',
    title: 'Manage Wallet',
    waitFor: 'main',
    delay: 2000,
  },
  {
    name: '05-leaderboard',
    url: '/leaderboard',
    title: 'Compete & Win',
    waitFor: 'main',
    delay: 2000,
  },
];

async function generateScreenshots() {
  console.log('🚀 Starting screenshot generation...\n');

  // Create output directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  for (const screenshot of SCREENSHOTS) {
    try {
      console.log(`📸 Capturing: ${screenshot.title}`);
      
      // Navigate to page
      await page.goto(`${SITE_URL}${screenshot.url}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for content
      if (screenshot.waitFor) {
        await page.waitForSelector(screenshot.waitFor, { timeout: 10000 }).catch(() => {
          console.log(`   ⚠️  Selector not found: ${screenshot.waitFor}, continuing anyway...`);
        });
      }

      // Custom action (e.g., click into market)
      if (screenshot.action) {
        await screenshot.action(page);
      }

      // Additional delay for animations
      await page.waitForTimeout(screenshot.delay);

      // Take screenshot
      const outputPath = path.join(SCREENSHOTS_DIR, `${screenshot.name}.png`);
      await page.screenshot({
        path: outputPath,
        fullPage: false,
      });

      console.log(`   ✅ Saved: ${screenshot.name}.png\n`);
    } catch (error) {
      console.error(`   ❌ Error capturing ${screenshot.name}:`, error.message, '\n');
    }
  }

  await browser.close();
  console.log('✨ Screenshot generation complete!');
  console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

// Run
generateScreenshots().catch(console.error);

/**
 * Generate Play Store Screenshots
 * Captures screenshots from live GUAP site at Android phone dimensions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../play-store-assets/screenshots');
const SITE_URL = 'https://guap.gold';

// Android phone dimensions (1080x1920 - most common)
const VIEWPORT = {
  width: 1080,
  height: 1920,
  deviceScaleFactor: 2,
};

const SCREENSHOTS = [
  {
    name: '01-markets',
    url: '/',
    title: 'Browse Markets',
    waitFor: '[data-testid="market-card"], .market-card, article',
    delay: 2000,
  },
  {
    name: '02-market-detail',
    url: '/markets', // Will get first market dynamically
    title: 'Trade on Events',
    waitFor: 'a[href*="/markets/"]',
    delay: 2000,
    action: async (page) => {
      // Get first market link and navigate directly
      const firstMarket = await page.$('a[href*="/markets/"]');
      if (firstMarket) {
        const href = await page.evaluate(el => el.getAttribute('href'), firstMarket);
        if (href) {
          await page.goto(`${SITE_URL}${href}`, { waitUntil: 'networkidle0', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  },
  {
    name: '03-portfolio',
    url: '/portfolio',
    title: 'Track Positions',
    waitFor: 'main',
    delay: 2000,
  },
  {
    name: '04-wallet',
    url: '/wallet',
    title: 'Manage Wallet',
    waitFor: 'main',
    delay: 2000,
  },
  {
    name: '05-leaderboard',
    url: '/leaderboard',
    title: 'Compete & Win',
    waitFor: 'main',
    delay: 2000,
  },
];

async function generateScreenshots() {
  console.log('🚀 Starting screenshot generation...\n');

  // Create output directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  for (const screenshot of SCREENSHOTS) {
    try {
      console.log(`📸 Capturing: ${screenshot.title}`);
      
      // Navigate to page
      await page.goto(`${SITE_URL}${screenshot.url}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for content
      if (screenshot.waitFor) {
        await page.waitForSelector(screenshot.waitFor, { timeout: 10000 }).catch(() => {
          console.log(`   ⚠️  Selector not found: ${screenshot.waitFor}, continuing anyway...`);
        });
      }

      // Custom action (e.g., click into market)
      if (screenshot.action) {
        await screenshot.action(page);
      }

      // Additional delay for animations
      await new Promise(resolve => setTimeout(resolve, screenshot.delay));

      // Take screenshot
      const outputPath = path.join(SCREENSHOTS_DIR, `${screenshot.name}.png`);
      await page.screenshot({
        path: outputPath,
        fullPage: false,
      });

      console.log(`   ✅ Saved: ${screenshot.name}.png\n`);
    } catch (error) {
      console.error(`   ❌ Error capturing ${screenshot.name}:`, error.message, '\n');
    }
  }

  await browser.close();
  console.log('✨ Screenshot generation complete!');
  console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

// Run
generateScreenshots().catch(console.error);
