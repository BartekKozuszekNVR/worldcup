import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Target palette names to extract
const TARGET_PALETTES = [
  'Stormy morning',
  'Mossy hollow',
  'Blue eclipse',
  'Lush forest',
  'Golden taupe',
  'Wisteria bloom',
  'Lavender fields',
  'Wildflowers',
  'Country garden',
  'Fresh peach',
  'Cherry blossom',
  'Pastel garden',
  'Cobalt sky',
  'Quite clear',
  'Quiet luxury',
  'Night sands',
  'Honeycomb',
  'Charming seaside',
  'Calm blue',
  'Mountain mist',
  'Frozen lake',
  'Coastal morning',
  'Eucalyptus grove',
  'Soft spring',
  'Autumn leaves',
  'Winter chill',
]

async function scrapeColors() {
  console.log('Launching browser (headed mode for better compatibility)...')
  const browser = await chromium.launch({
    headless: false, // Use headed mode to bypass potential anti-bot
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
  })

  const page = await context.newPage()

  console.log('Navigating to Figma color combinations page...')
  await page.goto('https://www.figma.com/resource-library/color-combinations/', {
    waitUntil: 'load',
    timeout: 90000,
  })

  // Wait longer for the page to fully render
  console.log('Waiting for page to render...')
  await page.waitForTimeout(8000)

  // Scroll down gradually to trigger lazy loading
  console.log('Scrolling to load lazy content...')
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      let totalHeight = 0
      const distance = 300
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)

      // Max 30 seconds of scrolling
      setTimeout(() => {
        clearInterval(timer)
        resolve()
      }, 30000)
    })
  })

  // Scroll back to top and wait
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(3000)

  // Check what text is on the page
  const pageText = await page.evaluate(() => document.body.innerText)
  console.log(`Page text length: ${pageText.length}`)

  // Check if any target palettes exist in the page text
  const foundInText = TARGET_PALETTES.filter((name) => pageText.toLowerCase().includes(name.toLowerCase()))
  console.log(`Found in page text: ${foundInText.length}/${TARGET_PALETTES.length}`)

  if (foundInText.length === 0) {
    console.log('No target palettes found in page text. Taking screenshot...')
    await page.screenshot({ path: join(__dirname, 'error-screenshot.png'), fullPage: true })
    await browser.close()
    return []
  }

  const results = []

  // Now try to extract colors for each found palette
  for (const paletteName of foundInText) {
    console.log(`\nExtracting: ${paletteName}`)

    try {
      // Scroll to find this palette
      const element = await page.locator(`text="${paletteName}"`).first()
      await element.scrollIntoViewIfNeeded({ timeout: 5000 })
      await page.waitForTimeout(500)

      const textBox = await element.boundingBox()
      if (!textBox) {
        console.log(`  Could not locate`)
        continue
      }

      // Extract colors from the card containing this palette
      const colors = await page.evaluate(
        ({ textY, textX }) => {
          const foundColors = []
          const elements = document.querySelectorAll('div, span')

          elements.forEach((el) => {
            const rect = el.getBoundingClientRect()

            // Look for elements near the palette title
            const verticalDist = Math.abs(rect.top - textY)
            const horizontalDist = Math.abs(rect.left - textX)

            // Allow wider horizontal range as colors might be spread across the card
            if (verticalDist < 350 && horizontalDist < 600) {
              const style = window.getComputedStyle(el)
              const bg = style.backgroundColor

              // Check for valid background color
              if (bg && !['rgba(0, 0, 0, 0)', 'transparent', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)'].includes(bg)) {
                const nums = bg.match(/\d+/g)
                if (nums && nums.length >= 3) {
                  const r = parseInt(nums[0])
                  const g = parseInt(nums[1])
                  const b = parseInt(nums[2])

                  // Filter out near-white and near-black
                  if (!(r > 245 && g > 245 && b > 245) && !(r < 10 && g < 10 && b < 10)) {
                    // Check element dimensions for swatch-like appearance
                    const minDim = Math.min(rect.width, rect.height)
                    const maxDim = Math.max(rect.width, rect.height)

                    if (minDim >= 20 && maxDim <= 250) {
                      const hex =
                        '#' +
                        [r, g, b]
                          .map((n) => n.toString(16).padStart(2, '0'))
                          .join('')
                          .toUpperCase()

                      if (!foundColors.some((c) => c.hex === hex)) {
                        foundColors.push({
                          hex,
                          x: rect.left,
                          y: rect.top,
                          area: rect.width * rect.height,
                        })
                      }
                    }
                  }
                }
              }
            }
          })

          // Sort by area (larger swatches first) then by position
          foundColors.sort((a, b) => b.area - a.area)

          // Take top colors by area, then sort by position
          const topColors = foundColors.slice(0, 10)
          topColors.sort((a, b) => {
            if (Math.abs(a.y - b.y) < 20) return a.x - b.x
            return a.y - b.y
          })

          return topColors.map((c) => c.hex)
        },
        { textY: textBox.y, textX: textBox.x }
      )

      const uniqueColors = [...new Set(colors)].slice(0, 6)

      if (uniqueColors.length >= 3) {
        console.log(`  Colors: ${uniqueColors.join(', ')}`)
        results.push({
          name: paletteName,
          colors: uniqueColors,
        })
      } else {
        console.log(`  Only ${uniqueColors.length} colors found`)
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`)
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`Found: ${results.length}/${TARGET_PALETTES.length}`)

  const missing = TARGET_PALETTES.filter((n) => !results.some((r) => r.name === n))
  if (missing.length > 0) {
    console.log(`Missing: ${missing.join(', ')}`)
  }

  await browser.close()

  // Save results
  const outputPath = join(__dirname, '..', 'src', 'theme', 'colorData.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\nSaved to ${outputPath}`)

  return results
}

scrapeColors().catch(console.error)
