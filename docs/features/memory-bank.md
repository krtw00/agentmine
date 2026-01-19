# Memory Bank

プロジェクト決定事項を永続化し、AIエージェントに知識として渡す機能。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Memory Bank とは                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【解決する問題】                                                    │
│  AIエージェントはセッション終了時に全てを忘れる。                    │
│  「DBはPostgreSQL」「認証はJWT」などの決定事項が失われる。          │
│                                                                     │
│  【Memory Bankの役割】                                               │
│  プロジェクトの決定事項・ルールを保存し、                           │
│  次回セッション開始時にAIに渡す。                                   │
│                                                                     │
│  【保存しないもの】                                                  │
│  - セッションの詳細ログ（→ Session Log 機能で別途対応）             │
│  - タスクの途中経過（→ AIがコードベースから推測可能）               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 設計目標

1. **決定事項の永続化**: プロジェクトの「なぜ」を記録
2. **AIへの自動注入**: セッション開始時にコンテキストとして渡す
3. **人間可読**: 人間も確認・編集可能
4. **シンプル**: 必要最小限の情報のみ保存

## データモデル

### プロジェクト決定事項

```typescript
// カテゴリ
type DecisionCategory =
  | 'architecture'  // アーキテクチャ（DB、フレームワーク等）
  | 'tooling'       // ツール（テスト、リンター等）
  | 'convention'    // 規約（コーディングスタイル等）
  | 'rule'          // ルール（必須事項等）
  ;

// 決定事項
interface ProjectDecision {
  id: number;
  category: DecisionCategory;
  title: string;           // "データベース選定"
  decision: string;        // "PostgreSQLを使用"
  reason?: string;         // "pgvectorでAI機能が使えるため"
  createdAt: Date;
  updatedAt?: Date;
}
```

### DBスキーマ

```typescript
export const projectDecisions = sqliteTable('project_decisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  category: text('category', {
    enum: ['architecture', 'tooling', 'convention', 'rule']
  }).notNull(),

  title: text('title').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason'),

  // 関連情報
  relatedTaskId: integer('related_task_id').references(() => tasks.id),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

## 使用例

### 決定事項の保存

```typescript
// サービス経由で保存
await memoryService.addDecision({
  category: 'architecture',
  title: 'データベース',
  decision: 'PostgreSQL（本番）、SQLite（ローカル）',
  reason: 'pgvectorによるAI機能の親和性',
});

await memoryService.addDecision({
  category: 'tooling',
  title: '認証方式',
  decision: 'JWT + Refresh Token',
  reason: 'ステートレス、スケーラブル',
});

await memoryService.addDecision({
  category: 'rule',
  title: 'テスト必須',
  decision: 'バグ修正時はregression testを追加すること',
});
```

### エージェントへの注入

```typescript
// タスク開始時に決定事項をコンテキストとして渡す
async function buildAgentContext(task: Task): Promise<string> {
  const decisions = await db.select().from(projectDecisions);

  // カテゴリ別にグループ化
  const grouped = groupBy(decisions, d => d.category);

  return `
## プロジェクト決定事項

${Object.entries(grouped).map(([category, items]) => `
### ${categoryLabel(category)}
${items.map(d => `
- **${d.title}**: ${d.decision}
${d.reason ? `  - 理由: ${d.reason}` : ''}
`).join('')}
`).join('')}

## タスク
**${task.title}**
${task.description || ''}
`;
}
```

### 生成されるコンテキスト例

```markdown
## プロジェクト決定事項

### アーキテクチャ
- **データベース**: PostgreSQL（本番）、SQLite（ローカル）
  - 理由: pgvectorによるAI機能の親和性

### ツール
- **認証方式**: JWT + Refresh Token
  - 理由: ステートレス、スケーラブル

### ルール
- **テスト必須**: バグ修正時はregression testを追加すること

## タスク
**ログイン機能を実装**
POST /api/login でJWTトークンを返すAPIを実装してください。
```

## CLI

```bash
# 決定事項一覧
agentmine memory list
agentmine memory list --category architecture

# 決定事項追加
agentmine memory add \
  --category tooling \
  --title "テストフレームワーク" \
  --decision "Vitest" \
  --reason "高速、Vite互換"

# 決定事項編集
agentmine memory edit 1 --decision "PostgreSQL + pgvector"

# 決定事項削除
agentmine memory remove 1

# コンテキストプレビュー（AIに渡される内容を確認）
agentmine memory preview
```

## API

### MemoryService

```typescript
export class MemoryService {
  // 決定事項
  async listDecisions(category?: DecisionCategory): Promise<ProjectDecision[]>;
  async addDecision(decision: NewDecision): Promise<ProjectDecision>;
  async updateDecision(id: number, updates: Partial<ProjectDecision>): Promise<void>;
  async removeDecision(id: number): Promise<void>;

  // コンテキスト生成
  async buildContext(task: Task): Promise<string>;
}
```

## MCP統合

```typescript
// MCP Tool: memory_list
{
  name: "memory_list",
  description: "List project decisions",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["architecture", "tooling", "convention", "rule"]
      },
    },
  },
}

// MCP Tool: memory_add
{
  name: "memory_add",
  description: "Add a project decision",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", required: true },
      title: { type: "string", required: true },
      decision: { type: "string", required: true },
      reason: { type: "string" },
    },
  },
}
```

## 将来の拡張

### ベクトル検索（Phase 2）

必要に応じて、決定事項のセマンティック検索を追加可能。

```typescript
// PostgreSQL + pgvector
export const projectDecisions = pgTable('project_decisions', {
  // ... 既存フィールド

  // ベクトル埋め込み（将来追加）
  embedding: vector('embedding', { dimensions: 1536 }),
});

// 類似検索
const similar = await db.execute(sql`
  SELECT * FROM project_decisions
  ORDER BY embedding <=> ${queryVector}
  LIMIT 5
`);
```

### Session Log（別機能）

セッションの詳細ログは別機能として実装予定。

- 何をしたかの記録（人間向け）
- デバッグ・監査用
- Memory Bankとは独立

## References

- [ADR-002: Database Strategy](../adr/002-sqlite-default.md)
- [Agent Execution](./agent-execution.md)
