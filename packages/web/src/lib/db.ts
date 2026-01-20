import { createDb } from '@agentmine/core';

// Singleton database instance for API routes
let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}
