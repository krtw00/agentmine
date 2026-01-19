# Memory Bank

APMから着想を得たコンテキスト永続化機能。

## 概要

AIエージェントのセッションが終了しても、プロジェクトの文脈・決定事項・進捗を保持し、新しいセッションで復元できる。

## 設計目標

1. **コンテキストの永続化**: セッション間で情報を失わない
2. **人間可読**: Markdownで人間も読める
3. **Git連携**: 履歴管理・差分確認が可能
4. **自動要約**: 長大化したコンテキストを自動圧縮

## アーキテクチャ

```
.agentmine/
└── memory/
    ├── project.md           # プロジェクト全体のコンテキスト
    ├── sessions/
    │   ├── session-001.md   # セッション別ログ
    │   ├── session-002.md
    │   └── ...
    └── tasks/
        ├── task-001.md      # タスク別コンテキスト
        ├── task-002.md
        └── ...
```

## ファイル構造

### project.md

```markdown
# Project Context

## Overview
プロジェクト名: My Project
最終更新: 2025-01-15 10:30:00

## Architecture Decisions

### ADR-001: 認証方式
- **決定**: JWT + Refresh Token
- **理由**: ステートレス、スケーラブル
- **日付**: 2025-01-10
- **セッション**: #42

### ADR-002: データベース
- **決定**: PostgreSQL
- **理由**: チーム共有が必要
- **日付**: 2025-01-12
- **セッション**: #45

## Current State

### 完了済み
- ユーザー認証基盤 (Task #1)
- API基本設計 (Task #2)

### 進行中
- ダッシュボード実装 (Task #5)

### 次のステップ
- テスト追加
- CI/CD設定

## Known Issues
- パフォーマンス最適化が必要（Task #10で対応予定）
```

### session-{id}.md

```markdown
# Session #42

## Metadata
- **開始**: 2025-01-15 09:00:00
- **終了**: 2025-01-15 10:30:00
- **エージェント**: coder
- **タスク**: #5 (ダッシュボード実装)
- **トークン使用量**: 15,234

## Input
ダッシュボードのUIを実装してください。Reactコンポーネントで作成し、
APIからデータを取得して表示してください。

## Summary
ダッシュボードの基本UIを実装。以下のコンポーネントを作成：
- Dashboard.tsx: メインコンポーネント
- StatsCard.tsx: 統計カード
- RecentActivity.tsx: 最近のアクティビティ

## Decisions Made
1. **状態管理**: React Query採用（サーバー状態に特化）
2. **スタイリング**: Tailwind CSS + shadcn/ui

## Files Changed
- src/components/Dashboard.tsx (created)
- src/components/StatsCard.tsx (created)
- src/components/RecentActivity.tsx (created)
- src/hooks/useDashboardData.ts (created)

## Errors Encountered
- API型定義の不整合 → types/api.ts を修正

## Next Steps
- レスポンシブ対応
- ローディング状態の改善
- エラーハンドリング追加

## Handover Notes
次のセッションでは、レスポンシブ対応から始めてください。
モバイル幅は375pxを基準にしています。
```

### task-{id}.md

```markdown
# Task #5: ダッシュボード実装

## Overview
- **ステータス**: in_progress
- **担当**: coder (AI)
- **作成日**: 2025-01-10
- **ブランチ**: task-5-dashboard

## Requirements
- ユーザーの統計情報を表示
- 最近のアクティビティを一覧表示
- レスポンシブデザイン

## Progress

### Session #42 (2025-01-15)
- 基本UIコンポーネント作成
- API連携実装

### Session #45 (2025-01-16)
- レスポンシブ対応
- テスト追加

## Technical Notes
- React Query for data fetching
- shadcn/ui for components
- Tailwind CSS for styling

## Related Tasks
- 依存: Task #2 (API設計)
- 関連: Task #7 (グラフ表示)
```

## API

### MemoryService

```typescript
// packages/core/src/services/memory-service.ts

export class MemoryService {
  constructor(private basePath: string) {}

  // プロジェクトコンテキスト
  async getProjectContext(): Promise<ProjectContext>;
  async updateProjectContext(updates: Partial<ProjectContext>): Promise<void>;
  async addDecision(decision: Decision): Promise<void>;

  // セッション
  async createSession(session: NewSession): Promise<Session>;
  async getSession(id: number): Promise<Session>;
  async updateSession(id: number, updates: SessionUpdate): Promise<void>;
  async finalizeSession(id: number, summary: SessionSummary): Promise<void>;

  // タスクコンテキスト
  async getTaskContext(taskId: number): Promise<TaskContext>;
  async updateTaskContext(taskId: number, updates: TaskContextUpdate): Promise<void>;

  // コンテキスト復元
  async loadContext(options: LoadContextOptions): Promise<string>;
  
  // 自動要約
  async summarizeIfNeeded(sessionId: number): Promise<void>;
}
```

### 使用例

```typescript
const memory = new MemoryService('.agentmine/memory');

// セッション開始
const session = await memory.createSession({
  taskId: 5,
  agentName: 'coder',
  input: 'ダッシュボードを実装してください',
});

// 決定を記録
await memory.addDecision({
  title: '状態管理',
  decision: 'React Query採用',
  reason: 'サーバー状態に特化',
  sessionId: session.id,
});

// セッション終了
await memory.finalizeSession(session.id, {
  summary: '基本UIコンポーネントを作成',
  filesChanged: ['Dashboard.tsx', 'StatsCard.tsx'],
  nextSteps: ['レスポンシブ対応', 'テスト追加'],
});

// コンテキスト読み込み
const context = await memory.loadContext({
  taskId: 5,
  includeProjectContext: true,
  includeRecentSessions: 3,
});
```

## CLI

```bash
# コンテキスト表示
agentmine context show
agentmine context show --task 5
agentmine context show --session 42

# コンテキスト読み込み（AIエージェント向け）
agentmine context load --task 5

# 手動保存
agentmine context save --message "認証実装完了"

# 要約実行
agentmine context summarize --task 5
```

## 自動要約

トークン数が閾値を超えた場合、自動的に要約を実行。

```yaml
# config.yaml
memory:
  autoSave: true
  summarizeAfter: 50000  # tokens
  keepRecentSessions: 5  # 詳細を保持するセッション数
```

### 要約プロセス

```
1. トークン数チェック
2. 閾値超過 → 要約実行
3. 古いセッションを圧縮
   - 詳細ログ → サマリーのみ
   - ファイル変更 → 変更リストのみ
4. project.md を更新
```

## Git連携

```bash
# Memory Bankの変更をコミット
git add .agentmine/memory/
git commit -m "chore(memory): セッション#42のコンテキスト保存"

# 差分確認
git diff .agentmine/memory/project.md
```

## MCP統合

```typescript
// MCP Tool: context_load
{
  name: "context_load",
  description: "Load context for a task or session",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "number" },
      sessionId: { type: "number" },
      includeProject: { type: "boolean", default: true },
    },
  },
}

// MCP Tool: context_save
{
  name: "context_save",
  description: "Save current context",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      decisions: { type: "array", items: { type: "object" } },
      nextSteps: { type: "array", items: { type: "string" } },
    },
  },
}
```
