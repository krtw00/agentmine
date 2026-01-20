import { createDb, initializeDb, AgentService, type Agent } from '@agentmine/core';
import AgentsClient from './agents-client';

async function getAgents(): Promise<Agent[]> {
  const db = createDb();
  await initializeDb(db);
  const agentService = new AgentService(db);
  return agentService.findAll();
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return <AgentsClient agents={agents} />;
}
