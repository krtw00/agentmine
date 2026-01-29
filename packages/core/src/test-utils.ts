import { drizzle } from 'drizzle-orm/libsql'
import { createClient, type Client } from '@libsql/client'
import * as schema from './db/schema.js'
import { initializeDb, type Db } from './db/index.js'

let testClient: Client | null = null
let testDb: Db | null = null

/**
 * Create an in-memory database for testing
 */
export async function createTestDb(): Promise<Db> {
  testClient = createClient({
    url: ':memory:',
  })

  testDb = drizzle(testClient, { schema })
  await initializeDb(testDb)

  return testDb
}

/**
 * Close the test database connection
 */
export function closeTestDb(): void {
  if (testClient) {
    testClient.close()
    testClient = null
    testDb = null
  }
}

/**
 * Get the current test database instance
 */
export function getTestDb(): Db {
  if (!testDb) {
    throw new Error('Test database not initialized. Call createTestDb() first.')
  }
  return testDb
}
