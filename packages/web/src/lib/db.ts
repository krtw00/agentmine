import {
  createDb,
  detectDbType,
  // SQLite schema tables
  tasks as sqliteTasks,
  sessions as sqliteSessions,
  agents as sqliteAgents,
  memories as sqliteMemories,
  settings as sqliteSettings,
  projects as sqliteProjects,
  auditLogs as sqliteAuditLogs,
  agentHistory as sqliteAgentHistory,
  memoryHistory as sqliteMemoryHistory,
  projectDecisions as sqliteProjectDecisions,
  taskDependencies as sqliteTaskDependencies,
  // PostgreSQL schema tables
  pgTasks,
  pgSessions,
  pgAgents,
  pgMemories,
  pgSettings,
  pgProjects,
  pgAuditLogs,
  pgAgentHistory,
  pgMemoryHistory,
  pgProjectDecisions,
  pgTaskDependencies,
} from '@agentmine/core';

// Singleton database instance for API routes
let db: ReturnType<typeof createDb> | null = null;
let dbType: 'sqlite' | 'postgres' | null = null;

export function getDb() {
  if (!db) {
    dbType = detectDbType();
    db = createDb();
  }
  return db;
}

// Determine database type at module load time
const isPostgres = detectDbType() === 'postgres';

// Export schema tables for easy access
// These will use the correct schema based on DATABASE_URL
export const tasks = isPostgres ? pgTasks : sqliteTasks;
export const sessions = isPostgres ? pgSessions : sqliteSessions;
export const agents = isPostgres ? pgAgents : sqliteAgents;
export const memories = isPostgres ? pgMemories : sqliteMemories;
export const settings = isPostgres ? pgSettings : sqliteSettings;
export const projects = isPostgres ? pgProjects : sqliteProjects;
export const auditLogs = isPostgres ? pgAuditLogs : sqliteAuditLogs;
export const agentHistory = isPostgres ? pgAgentHistory : sqliteAgentHistory;
export const memoryHistory = isPostgres ? pgMemoryHistory : sqliteMemoryHistory;
export const projectDecisions = isPostgres ? pgProjectDecisions : sqliteProjectDecisions;
export const taskDependencies = isPostgres ? pgTaskDependencies : sqliteTaskDependencies;
