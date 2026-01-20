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
│  次回セッション開始時に参照情報をAIに渡す。                         │
│                                                                     │
│  【保存形式】                                                        │
│  DBマスター（memoriesテーブル）                                      │
│  → ファイルはスナップショット/エクスポート用                         │
│  → `.agentmine/` はデフォルトでgitignore                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 設計目標

1. **決定事項の永続化**: プロジェクトの「なぜ」を記録
2. **AIへの自動注入**: 重要事項の要約 + 参照情報（ファイル一覧）
3. **人間可読**: Markdownで人間も確認・編集可能
4. **エクスポート対応**: 必要時にファイルへ出力し、Git管理可能
5. **一貫性**: DBを単一の真実源にして同期問題を回避

## スナップショット出力

Worker起動時やエクスポート時に、DBからスナップショットを生成する。
`.agentmine/` はデフォルトでgitignoreされるため、必要ならエクスポート先を別ディレクトリにする。

```
.agentmine/memory/           # DBから生成されるスナップショット
├── architecture/           # アーキテクチャ決定
│   ├── database-selection.md
│   └── monorepo.md
├── tooling/                # ツール選定
│   ├── test-framework.md
│   └── linter.md
├── convention/             # 規約
│   └── commit-format.md
└── rule/                   # ルール（必須事項）
    └── test-required.md
```

ファイル名は `memory.id`（slug）を使用する。

## ファイル形式

各決定事項はFront Matter付きMarkdownファイル（スナップショット）：

```markdown
---
id: database-selection
title: データベース選定
category: architecture
summary: PostgreSQL（本番）/ SQLite（ローカル）
status: active
created: 2024-01-20
updated: 2024-01-25
---

# データベース選定

## 決定

PostgreSQL（本番）、SQLite（ローカル）

## 理由

- pgvectorによるAI機能の親和性
- SQLiteはゼロ設定でローカル開発に最適
- Drizzle ORMで両方をサポート可能
```

**必須:** `id`（slug）, `title`, `category`  
**推奨:** `summary`  
**status:** 省略時は `draft`（注入OFF）。`active` のみ注入対象。

## カテゴリ

| カテゴリ | 説明 | 例 |
|---------|------|-----|
| `architecture` | アーキテクチャ | DB、フレームワーク、API設計 |
| `tooling` | ツール選定 | テスト、リンター、ビルドツール |
| `convention` | 規約 | コーディングスタイル、命名規則 |
| `rule` | ルール | 必須事項、禁止事項 |

**カテゴリはプロジェクト設定で拡張可能。** 設定に許可リストがある場合はその値のみ許容し、未設定なら任意の文字列を許可する。

## コンテキスト注入

### 注入タイミング

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Memory Bank 注入タイミング                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Orchestrator                                                       │
│    │                                                                │
│    │ agentmine worker run <task-id> [--exec]                        │
│    ▼                                                                │
│  agentmine                                                          │
│    │ 1. タスク情報取得                                              │
│    │ 2. DBからMemory Bank取得                                       │
│    │ 3. 必要に応じてスナップショット出力                            │
│    │ 4. プロンプト生成（Memory Bank要約 + 参照情報 + Task）          │
│    ▼                                                                │
│  Worker起動コマンド出力/実行                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 生成されるコンテキスト例

（DBに保存された決定事項の要約 + 参照情報を注入する例）

```markdown
## Memory Bank Summary
- ルール: バグ修正時は必ず回帰テストを追加
- 規約: コミット形式はConventional Commits
- アーキテクチャ: DBはPostgreSQL（本番）/ SQLite（ローカル）

## Project Context (Memory Bank)
The following project context files are available:
- .agentmine/memory/architecture/database-selection.md - データベース選定
- .agentmine/memory/tooling/test-framework.md - テストフレームワーク
- .agentmine/memory/rule/test-required.md - テスト必須

Read these files in .agentmine/memory/ for details.

## タスク
**ログイン機能を実装**
POST /api/login でJWTトークンを返すAPIを実装してください。
```

**Note:** 注入対象は `status=active` のみ。デフォルトは「短い要約 + 参照一覧」。要約は10項目以内の簡潔な箇条書きを推奨する。

## CLI

```bash
# 決定事項一覧
agentmine memory list
agentmine memory list --category architecture
agentmine memory list --status active

# 決定事項追加（DBに保存）
agentmine memory add \
  --id test-framework \
  --category tooling \
  --title "テストフレームワーク" \
  --summary "Vitest（高速・Vite互換）" \
  --status active

# 決定事項編集（DBを更新）
agentmine memory edit <id>

# 決定事項削除（DBから削除）
agentmine memory remove <id>

# コンテキストプレビュー（AIに渡される内容を確認）
agentmine memory preview

# スナップショット出力（バックアップ/共有用）
agentmine memory export --output ./memory/

# スナップショットのインポート（移行用）
agentmine memory import --dir ./memory/
```

## API

### MemoryService

```typescript
export class MemoryService {
  // DB読み込み
  async listMemories(filter?: {
    category?: string;
    status?: MemoryStatus;
  }): Promise<MemoryRecord[]>;
  async getMemory(id: string): Promise<MemoryRecord | null>;

  // DB書き込み
  async addMemory(input: NewMemory): Promise<MemoryRecord>;
  async updateMemory(id: string, input: UpdateMemory): Promise<MemoryRecord>;
  async removeMemory(id: string): Promise<void>;

  // コンテキスト生成
  async buildContext(): Promise<string>;

  // スナップショット
  async exportSnapshot(outputDir: string): Promise<void>;
  async importSnapshot(inputDir: string): Promise<void>;
}

type MemoryStatus = 'draft' | 'active' | 'archived';

interface MemoryRecord {
  id: string;
  category: string;
  title: string;
  summary?: string;
  status: MemoryStatus;
  content: string;
  created: Date;
  updated?: Date;
}
```

## MCP統合

```typescript
// MCP Tool: memory_list
{
  name: "memory_list",
  description: "List Memory Bank entries (DB)",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string" },
      status: {
        type: "string",
        enum: ["draft", "active", "archived"]
      },
    },
  },
}

// MCP Tool: memory_add
{
  name: "memory_add",
  description: "Add a Memory Bank entry (DB)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", required: true },
      category: { type: "string", required: true },
      title: { type: "string", required: true },
      summary: { type: "string" },
      status: {
        type: "string",
        enum: ["draft", "active", "archived"]
      },
      content: { type: "string" },
    },
  },
}

// MCP Tool: memory_preview
{
  name: "memory_preview",
  description: "Preview the context that will be passed to Workers",
  inputSchema: { type: "object", properties: {} },
}
```

## Git連携

DBがマスター。必要時にスナップショットをエクスポートしてGit管理する：

```bash
# エクスポート
agentmine memory export --output ./memory/

# 変更履歴の確認
git log --oneline ./memory/

# 差分確認
git diff ./memory/

# PRレビューで決定事項の変更も確認可能
```

## References

- **@../data-model.md** - データモデル
- **@./agent-execution.md** - Agent実行フロー
- **@../07-runtime/worker-lifecycle.md** - Worker実行ライフサイクル（Memory Bank注入）
- **@../03-core-concepts/db-master.md** - DBマスター方式
- **@./session-log.md** - セッション記録
