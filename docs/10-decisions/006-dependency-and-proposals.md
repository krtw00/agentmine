---
depends_on:
  - ./005-ai-agnostic-orchestration.md
  - ../04-data/data-model.md
tags: [decisions, adr, data-model, dependencies, proposals, decomposer]
ai_summary: "タスク間依存関係をblockedBy配列で表現し、Decomposerの提案を専用proposalsテーブルに保存する設計"
---

# ADR-006: 依存関係モデルと提案テーブル設計

> Status: Accepted
> 最終更新: 2026-01-29

## コンテキスト

ADR-005で3層構造（Orchestrator / Decomposer / Worker）を採用した。Decomposerがタスク分解を行う際に、以下の設計が必要になった：

1. **依存関係**: 子タスク間の実行順序をどう表現するか
2. **提案保存**: Decomposerの分解案をどこに保存し、承認フローに乗せるか
3. **コンテキスト受け渡し**: DBの情報をどうAIに渡すか

### 背景

- 現状の `tasks.parentId` は親子関係のみで、兄弟タスク間の順序を表現できない
- Decomposerの出力は「提案」であり、人間の承認後に正式なタスクになる
- multi-agent-shogunはファイルベース（YAML）でコンテキストを渡している
- AgentMineはDB-Masterだが、AIへの受け渡しは明示的なファイルが効果的

## 決定事項

### 1. 依存関係モデル: blockedBy配列

タスクテーブルに `blockedBy` フィールドを追加する。

```typescript
// schema.ts への追加
export const tasks = sqliteTable('tasks', {
  // ... 既存フィールド ...
  
  // 依存タスクID（このタスクはblockedByのタスクが完了するまで開始できない）
  blockedBy: text('blocked_by', { mode: 'json' })
    .$type<number[]>()
    .default([]),
})
```

**使用例：**
```
親タスク: 認証機能を実装
├── 子1: DBスキーマ作成 (id: 101)
├── 子2: APIエンドポイント (id: 102, blockedBy: [101])
└── 子3: フロントUI (id: 103, blockedBy: [102])
```

**選択理由：**
- シンプルで直感的
- 多くの場合「これが終わるまで待つ」で十分
- 複雑な依存グラフはそもそも分解が悪い（Decomposerが避けるべき）

### 2. 提案テーブル: proposals

Decomposerの分解案を保存する専用テーブルを作成する。

```typescript
export const proposals = sqliteTable('proposals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 何に対する提案か
  sourceTaskId: integer('source_task_id')
    .references(() => tasks.id)
    .notNull(),
  sessionId: integer('session_id')
    .references(() => sessions.id),
  
  // 提案タイプ
  type: text('type', { 
    enum: ['decompose', 'reassign', 'merge', 'cancel'] 
  }).notNull(),
  
  // 提案内容（JSON）
  payload: text('payload', { mode: 'json' })
    .$type<ProposalPayload>()
    .notNull(),
  
  // 提案理由（AIの説明）
  rationale: text('rationale'),
  
  // 承認状態
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected', 'expired', 'superseded'] 
  }).notNull().default('pending'),
  
  // レビュー情報
  reviewedBy: text('reviewed_by'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewComment: text('review_comment'),
  
  // 作成情報
  createdBy: text('created_by').notNull(), // Decomposer識別子
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  
  // 有効期限（自動expire用）
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
})

// 提案ペイロードの型定義
export interface DecomposePayload {
  subtasks: Array<{
    title: string
    description?: string
    type?: TaskType
    priority?: TaskPriority
    blockedBy?: number[] // 同じ提案内の他サブタスクへのインデックス参照
    estimatedComplexity?: number
  }>
}

export type ProposalPayload = 
  | { kind: 'decompose'; data: DecomposePayload }
  | { kind: 'reassign'; data: { newAssignee: string } }
  | { kind: 'merge'; data: { targetTaskIds: number[] } }
  | { kind: 'cancel'; data: { reason: string } }
```

### 3. コンテキストファイル生成

DBからAIへのコンテキスト受け渡しはファイル生成方式を採用する。

```
┌────────────────────────────────────────────┐
│ agentmine decompose --task 123             │
└───────────────┬────────────────────────────┘
                ▼
┌────────────────────────────────────────────┐
│ 1. DBからタスク123の情報を取得             │
│ 2. 関連メモリ・依存タスク・履歴も取得      │
│ 3. .agentmine/context/task-123.md を生成   │
└───────────────┬────────────────────────────┘
                ▼
┌────────────────────────────────────────────┐
│ AI（Decomposer）がファイルを読んで分解     │
└───────────────┬────────────────────────────┘
                ▼
┌────────────────────────────────────────────┐
│ 分解案を proposals テーブルに保存          │
└────────────────────────────────────────────┘
```

**コンテキストファイル構造：**
```markdown
# タスク分解依頼: {title}

## 基本情報
- ID: {id}
- ステータス: {status}
- 優先度: {priority}
- 作成日: {createdAt}

## 説明
{description}

## 関連メモリ
{memories から関連するものを抽出}

## 依存関係
### このタスクがブロックしているもの
{blockedBy で参照されているタスク}

### このタスクをブロックしているもの
{自身の blockedBy}

## 過去の試行（あれば）
{sessions から失敗履歴など}

## 指示
上記タスクを実行可能な粒度のサブタスクに分解してください。
- 各サブタスク間の依存関係を明示してください
- 並列実行可能なものは blockedBy を空にしてください
```

**MCPは補助的に使用：**
- タスク一覧取得、ステータス更新など軽い操作
- リアルタイム情報の確認
- 分解結果の保存

## 検討した選択肢

### 依存関係モデル

| 案 | 実装 | 採否 | 理由 |
|---|---|---|---|
| A. blockedBy配列 | `blockedBy: integer[]` | ✅採用 | シンプル、直感的 |
| B. 別テーブル | `task_dependencies(taskId, dependsOnId)` | ❌ | 正規化過剰、JOINコスト |
| C. 順序番号 | `orderIndex: integer` | ❌ | 並列実行を表現できない |

### 提案保存先

| 案 | 実装 | 採否 | 理由 |
|---|---|---|---|
| A. 専用テーブル | `proposals` | ✅採用 | 責務明確、履歴管理可能 |
| B. タスクstatus拡張 | `status: 'proposed'` | ❌ | タスクの意味がぼやける |
| C. セッションに紐づけ | `sessions.proposedTasks` | ❌ | セッションが肥大化 |

### コンテキスト受け渡し

| 案 | 実装 | 採否 | 理由 |
|---|---|---|---|
| A. MCP経由のみ | AIがDBクエリ | ❌ | AIの負荷高、制御困難 |
| B. ファイル生成 | MD/YAML自動生成 | ✅採用 | AIに優しい、制御しやすい |
| C. ハイブリッド | 基本MCP + 複雑情報はファイル | △ | 実装コスト |

## 結果

### ポジティブな影響

- 依存関係がシンプルに表現できる
- 提案の履歴・監査が可能になる
- AIへのコンテキスト受け渡しが明示的で制御しやすい
- multi-agent-shogunと同様のファイルベース方式でAIに優しい

### ネガティブな影響

- スキーママイグレーションが必要
- コンテキストファイル生成ロジックの実装コスト
- 提案テーブルのデータが増えていく（定期クリーンアップ必要）

## 実装計画

1. **Phase 1: スキーマ更新**
   - `tasks.blockedBy` フィールド追加
   - `proposals` テーブル作成
   - マイグレーション実行

2. **Phase 2: コンテキスト生成**
   - `agentmine context generate --task <id>` コマンド実装
   - テンプレートエンジン（Handlebars等）導入

3. **Phase 3: 提案フロー**
   - `agentmine proposal create` - 提案保存
   - `agentmine proposal list` - 提案一覧
   - `agentmine proposal approve/reject` - 承認・却下
   - 承認時に子タスク自動作成

4. **Phase 4: Web UI**
   - 提案表示・承認UI
   - 依存関係の可視化（グラフ表示）

## 関連ADR

- [ADR-005](./005-ai-agnostic-orchestration.md) - AI非依存のOrchestrator設計
- [ADR-002](./002-sqlite-default.md) - SQLiteをデフォルトDB
- [ADR-003](./003-drizzle-orm.md) - Drizzle ORM採用

## 関連ドキュメント

- [データモデル](../04-data/data-model.md) - 全体スキーマ定義
- [タスク分解](../03-core-concepts/task-decomposition.md) - 分解の設計案
