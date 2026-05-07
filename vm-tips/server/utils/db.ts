import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'

// Create libSQL client for Turso
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Create Drizzle ORM instance with schema
export const db = drizzle(client, { schema })

// Re-export schema for convenience
export { schema }
