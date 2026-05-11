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
  },
})
