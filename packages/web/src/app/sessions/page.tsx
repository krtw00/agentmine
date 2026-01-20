import { createDb, initializeDb, SessionService, type Session } from '@agentmine/core';
import SessionsClient from './sessions-client';

async function getSessions(): Promise<Session[]> {
  const db = createDb();
  await initializeDb(db);
  const sessionService = new SessionService(db);
  return sessionService.findAll();
}

async function getSessionStats() {
  const db = createDb();
  await initializeDb(db);
  const sessionService = new SessionService(db);

  const counts = await sessionService.countByStatus();
  const running = await sessionService.findRunning();
  const pendingReview = await sessionService.findPendingReview();

  return {
    counts,
    runningCount: running.length,
    reviewQueueCount: pendingReview.length,
  };
}

export default async function SessionsPage() {
  const sessions = await getSessions();
  const stats = await getSessionStats();

  return <SessionsClient sessions={sessions} stats={stats} />;
}
