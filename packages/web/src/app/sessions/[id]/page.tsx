import { createDb, initializeDb, SessionService, type Session } from '@agentmine/core';
import { notFound } from 'next/navigation';
import SessionDetailClient from './session-detail-client';

async function getSession(id: number): Promise<{ session: Session; task: any } | null> {
  const db = createDb();
  await initializeDb(db);
  const sessionService = new SessionService(db);
  return sessionService.findByIdWithTask(id);
}

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sessionId = Number(params.id);

  if (!Number.isFinite(sessionId)) {
    notFound();
  }

  const result = await getSession(sessionId);

  if (!result) {
    notFound();
  }

  return <SessionDetailClient session={result.session} task={result.task} />;
}
