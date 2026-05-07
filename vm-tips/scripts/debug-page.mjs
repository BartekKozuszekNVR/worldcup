import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function debugPage() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: false }) // Non-headless to see what's happening
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  console.log('Navigating to Figma color combinations page...')
  await page.goto('https://www.figma.com/resource-library/color-combinations/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })

  // Wait for page to load
  await page.waitForTimeout(5000)

  // Scroll down to load lazy content
  console.log('Scrolling page to load all content...')
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000))
    await page.waitForTimeout(500)
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1000)

  // Take screenshot
  await page.screenshot({ path: join(__dirname, 'debug-screenshot.png'), fullPage: true })
  console.log('Screenshot saved')

  // Get page HTML
  const html = await page.content()
  writeFileSync(join(__dirname, 'debug-page.html'), html)
  console.log('HTML saved')

  // Search for "Stormy morning" text
  const stormyMorning = await page.locator('text=Stormy morning').count()
  console.log(`Found ${stormyMorning} elements with "Stormy morning"`)

  // Find all text containing palette names
  const searchTerms = ['Stormy', 'Mossy', 'Eclipse', 'Lush', 'Golden']
  for (const term of searchTerms) {
    const count = await page.locator(`text=${term}`).count()
    console.log(`Found ${count} elements with "${term}"`)
  }

  // Look for color swatches by common patterns
  const colorDivs = await page.locator('div[style*="background-color"]').count()
  console.log(`Found ${colorDivs} divs with background-color style`)

  // Check for specific classes
  const colorClasses = await page.evaluate(() => {
    const results = []
    document.querySelectorAll('*').forEach((el) => {
      if (el.className && typeof el.className === 'string') {
        if (el.className.toLowerCase().includes('color') || el.className.toLowerCase().includes('swatch')) {
          results.push(el.className)
        }
      }
    })
    return [...new Set(results)].slice(0, 20)
  })
  console.log('Color-related classes:', colorClasses)

  await browser.close()
}

debugPage().catch(console.error)
