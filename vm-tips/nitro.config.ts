import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  // Deploy as Vercel serverless functions
  preset: 'vercel',

  // Use the server directory for API routes
  srcDir: 'server',

  // Compatibility with Node.js runtime
  compatibilityDate: '2025-01-01',

  // Enable TypeScript
  typescript: {
    strict: true,
  },

  // Runtime config from environment variables
  runtimeConfig: {
    tursoDbUrl: process.env.TURSO_DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
    sessionSecret: process.env.SESSION_SECRET,
  },

  // Route rules
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
      },
    },
    // Leaderboard is public and only changes when an admin saves results.
    // Cache at the CDN edge for 60s; serve stale while revalidating for up to 5 min.
    '/api/leaderboard': {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  },
})
