#!/usr/bin/env npx tsx
/**
 * Database initialization script
 * Creates tables if they don't exist
 */

// Use relative path for monorepo compatibility
import { createDb, initializeDb, closeDb, detectDbType } from '../packages/core/src/db/index.js'

async function main() {
  const dbType = detectDbType()
  console.log(`Initializing ${dbType} database...`)

  try {
    const db = createDb()
    await initializeDb(db)
    console.log('Database initialized successfully')
    await closeDb()
  } catch (error) {
    console.error('Failed to initialize database:', error)
    process.exit(1)
  }
}

main()
