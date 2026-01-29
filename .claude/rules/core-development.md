---
paths:
  - "packages/core/**/*.ts"
---

# Core開発ルール

## サービスパターン

```typescript
// packages/core/src/services/task-service.ts
export class TaskService {
  constructor(private db: Database, private config: Config) {}

  async createTask(input: NewTask): Promise<Task> {
    // バリデーション → DB操作 → 結果返却
  }
}
```

## Drizzle ORM

```typescript
// スキーマ定義
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status', { enum: ['open', 'in_progress', 'done', 'failed'] })
    .notNull()
    .default('open'),
});

// クエリ
const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, id),
});
```

## エージェント定義（YAML）

DBに保存せず、`.agentmine/agents/*.yaml`から読み込む:

```typescript
async getAgent(name: string): Promise<Agent> {
  const filePath = path.join(this.agentsDir, `${name}.yaml`);
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content) as Agent;
}
```

## Memory Bank

ファイルベース（`.agentmine/memory/`）で管理。DBには保存しない。

```typescript
async buildContext(): Promise<string> {
  const files = await this.listDecisions();
  return files.map(f => `- **${f.title}**: ${f.decision}`).join('\n');
}
```

## テスト

Vitestを使用:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(testDb, testConfig);
  });

  it('should create task', async () => {
    const task = await service.createTask({ title: 'Test' });
    expect(task.id).toBeDefined();
  });
});
```
