import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Image URLs for each palette (extracted from Figma page)
const PALETTE_IMAGES = {
  'Stormy morning':
    'https://cdn.sanity.io/images/599r6htc/regionalized/5581f8a4ab05fec24400558d4c646d5730d57e25-1000x602.png',
  'Mossy hollow':
    'https://cdn.sanity.io/images/599r6htc/regionalized/2cbdff7b94732d67bd5a8bc1f0ac4d309006c320-1000x602.png',
  'Blue eclipse':
    'https://cdn.sanity.io/images/599r6htc/regionalized/139ec5384f625ef48595e545a6f0d760d262bd68-1000x602.png',
  'Lush forest':
    'https://cdn.sanity.io/images/599r6htc/regionalized/a716c56aa8bbe6d189921260d34f193dad19db02-1000x602.png',
  'Golden taupe':
    'https://cdn.sanity.io/images/599r6htc/regionalized/7781ff96fb4f02521f155b3e6fcccec000fda6ba-1440x868.png',
  'Wisteria bloom':
    'https://cdn.sanity.io/images/599r6htc/regionalized/fc95065f7e1fb75f20842d721f79bd72e69a38cb-1440x868.png',
  'Lavender fields':
    'https://cdn.sanity.io/images/599r6htc/regionalized/d66a3fd0c8fbe2ba6c2b8131fcad1e793ae308bf-1000x602.png',
  Wildflowers:
    'https://cdn.sanity.io/images/599r6htc/regionalized/bed3f64e32b732a5cde1dbc6d94d7acd6af38130-1000x602.png',
  'Country garden':
    'https://cdn.sanity.io/images/599r6htc/regionalized/28911b9bb6e0845a3a3704a9563e33d4d6edebb3-1000x602.png',
  'Fresh peach':
    'https://cdn.sanity.io/images/599r6htc/regionalized/0911511bcb21368c5671b54023946c604c469740-1000x602.png',
  'Cherry blossom':
    'https://cdn.sanity.io/images/599r6htc/regionalized/5413b19a1f3c7f664a8a5bc92f3f91b2bfb666ec-1440x868.png',
  'Pastel garden':
    'https://cdn.sanity.io/images/599r6htc/regionalized/fd754f81dc11ae460254a237667e24199a7d47d6-1440x868.png',
  'Cobalt sky':
    'https://cdn.sanity.io/images/599r6htc/regionalized/d7363ca190c29bc0984a98f56af756121f9715cb-1440x868.png',
  'Quite clear':
    'https://cdn.sanity.io/images/599r6htc/regionalized/900e9ff75e655b68492f4a6c58143d266125f676-1000x602.png',
  'Quiet luxury':
    'https://cdn.sanity.io/images/599r6htc/regionalized/831124a9163c6e60558a550d2214d17004bb7ddf-1000x602.png',
  'Night sands':
    'https://cdn.sanity.io/images/599r6htc/regionalized/a5bc614c80500102c42229a47a2b3efa326070b1-1000x602.png',
  Honeycomb: 'https://cdn.sanity.io/images/599r6htc/regionalized/3b825b39d7de77d0012f5f93e09ad27d5cb2594c-1440x868.png',
  'Charming seaside':
    'https://cdn.sanity.io/images/599r6htc/regionalized/8ae89be8bfd00aec44f5353568aa8630591035da-1000x602.png',
  'Calm blue':
    'https://cdn.sanity.io/images/599r6htc/regionalized/ca418d81b68d16ef58f799611894c4876e00d156-1000x602.png',
  'Mountain mist':
    'https://cdn.sanity.io/images/599r6htc/regionalized/e735b646d7110c708e9ba27721a729798ad572b9-1440x868.png',
  'Frozen lake':
    'https://cdn.sanity.io/images/599r6htc/regionalized/63d43501263927788e5f7e2313eded4ce9fb0c07-1440x868.png',
  'Coastal morning':
    'https://cdn.sanity.io/images/599r6htc/regionalized/af3c2c08d72d084e509c5affbdc5267f2be7ac10-1440x868.png',
  'Eucalyptus grove':
    'https://cdn.sanity.io/images/599r6htc/regionalized/3f6a9522880849e7de6fdf5a7e790f0aa3075756-1440x868.png',
  'Soft spring':
    'https://cdn.sanity.io/images/599r6htc/regionalized/7fcdee7a85c5291e39322d105696ed6f009c73b1-1000x602.png',
  'Autumn leaves':
    'https://cdn.sanity.io/images/599r6htc/regionalized/9843013ab86f34b5f476b0d718b51808cc4aab86-1000x602.png',
  'Winter chill':
    'https://cdn.sanity.io/images/599r6htc/regionalized/defedca520a72f2a1ab6e12960b912953910b0d6-1000x602.png',
}

// Convert RGB to Hex
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

// Extract colors from image
// The Figma palette images typically have color swatches arranged horizontally
async function extractColorsFromImage(imageUrl, paletteName) {
  try {
    console.log(`Fetching: ${paletteName}`)

    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const image = sharp(Buffer.from(buffer))
    const metadata = await image.metadata()

    const width = metadata.width
    const height = metadata.height

    // Get raw pixel data
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

    // The color swatches are typically in the lower portion of the image
    // arranged horizontally. Sample from the bottom half.
    const sampleY = Math.floor(height * 0.7) // Sample at 70% down
    const colors = []
    const numSamples = 6 // Typically 4-6 colors

    // Sample at evenly spaced horizontal positions
    for (let i = 0; i < numSamples; i++) {
      const sampleX = Math.floor((width / (numSamples + 1)) * (i + 1))
      const pixelIndex = (sampleY * width + sampleX) * info.channels

      const r = data[pixelIndex]
      const g = data[pixelIndex + 1]
      const b = data[pixelIndex + 2]

      const hex = rgbToHex(r, g, b)

      // Only add if not already present (avoid duplicates)
      if (!colors.includes(hex)) {
        colors.push(hex)
      }
    }

    // If we didn't get enough distinct colors, try sampling at different Y positions
    if (colors.length < 4) {
      for (const yRatio of [0.5, 0.6, 0.8]) {
        const y = Math.floor(height * yRatio)
        for (let i = 0; i < numSamples; i++) {
          const x = Math.floor((width / (numSamples + 1)) * (i + 1))
          const pixelIndex = (y * width + x) * info.channels

          const r = data[pixelIndex]
          const g = data[pixelIndex + 1]
          const b = data[pixelIndex + 2]

          const hex = rgbToHex(r, g, b)
          if (!colors.includes(hex)) {
            colors.push(hex)
          }
        }
        if (colors.length >= 4) break
      }
    }

    console.log(`  Found ${colors.length} colors: ${colors.slice(0, 6).join(', ')}`)
    return colors.slice(0, 6)
  } catch (err) {
    console.log(`  Error: ${err.message}`)
    return []
  }
}

async function main() {
  console.log('Extracting colors from Figma palette images...\n')

  const results = []

  for (const [name, url] of Object.entries(PALETTE_IMAGES)) {
    const colors = await extractColorsFromImage(url, name)
    if (colors.length >= 3) {
      results.push({ name, colors })
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`Successfully extracted: ${results.length}/${Object.keys(PALETTE_IMAGES).length}`)

  // Save results
  const outputPath = join(__dirname, '..', 'src', 'theme', 'colorData.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`Saved to ${outputPath}`)
}

main().catch(console.error)
