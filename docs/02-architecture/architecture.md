# アーキテクチャ

## 目的

このドキュメントはAgentMineのシステム構成と設計原則を説明する。

## 背景

AgentMineは「並列AI開発の実行環境」であり、「並列実行を計画するAI」ではない。

**AgentMineの責務:**
- Workerの隔離環境（worktree）を提供
- スコープ制御（アクセス可能なファイルの制限）
- DoD検証（lint/test/build等の品質チェック）
- セッションの記録
- Memory Bankの提供

**Orchestrator（AI）の責務:**
- 並列実行の計画（何を並列にするか）
- Workerの起動指示
- 進捗監視とマージ判断
- 失敗時のリトライ判断

この責務分離により、**計画・判断はOrchestrator、安全装置はAgentMine**という役割が明確になる。

## 設計原則

### 1. DBマスター（Single Source of Truth）

すべてのデータはDBで管理する。ファイルはスナップショット/エクスポート用。

| データ | 保存先 | 用途 |
|--------|--------|------|
| タスク | DB (tasks) | タスク管理 |
| セッション | DB (sessions) | 実行履歴 |
| Agent定義 | DB (agents) | Worker設定 |
| Memory Bank | DB (memories) | 知識蓄積 |
| 設定 | DB (settings) | プロジェクト設定 |
| メンバー | DB (members) | 人間の担当者 |

Worker起動時にDBからファイルを出力し、Workerに渡す。

### 2. 事実ベースの状態管理

Workerは能動的にDBを更新しない。ステータスは観測可能な事実から判定する。

| 事実 | 判定 |
|------|------|
| exit code = 0 | 正常終了 |
| exit code ≠ 0 | エラー終了 |
| ブランチがマージ済み | タスク完了 |
| プロセスが存在 | 実行中 |

この方式により、WorkerとAgentMineの結合を避け、並列実行時の競合も発生しない。

### 3. Fail Fast

エラー時は即座に失敗させ、リカバリーはOrchestratorに委ねる。

AgentMineは自動リトライやエラー修正を行わない。明確な成功/失敗の状態を記録し、判断はOrchestratorに任せる。

### 4. DoD検証の仕組み化

DoD（Definition of Done）検証はAgentMineが強制する。Orchestratorの任意ではない。

**なぜ仕組み化するか:**
- Orchestratorが検証をスキップしても何も起きない、という状況を避ける
- 責任の所在を明確にする（DoDが通らないとマージ不可）
- スコープ制御と同様の「安全装置」として位置づける

**動作:**
1. Worker完了後、AgentMineがDoD検証を自動実行
2. 失敗したらセッションを`dod_failed`として記録
3. マージをブロック
4. 明示的なスキップは`--skip-dod`で可能（自己責任）

**DoD定義の管理:**
- エージェント定義またはタスクに`dod`フィールドを追加
- 例: `dod: ["pnpm lint", "pnpm test", "pnpm build"]`

### 5. 人間とAIの協業（Redmine的運用）

人間のタスクもAIのタスクも同一画面で統合管理する。

**アクターモデル:** 人間とAgentを「アクター」として統一的に扱う。

| アクター種別 | 例 | ステータス管理 |
|-------------|-----|---------------|
| human | 井口さん、田中さん | 手動更新 |
| agent | Agent-A、Agent-B | 事実ベース自動判定 |

担当者選択では人間もAgentも同列に表示される。個人利用では「自分 + 複数Agent」、組織利用では「チームメンバー + Agent群」として自然にスケールする。

## システム構成

```mermaid
flowchart TB
    subgraph User["ユーザー層"]
        Human[人間]
        Orch[Orchestrator AI]
    end

    subgraph Interface["インターフェース層"]
        WebUI[Web UI]
        CLI[CLI]
        MCP[MCP Server]
    end

    subgraph Core["コア層"]
        Services[Services]
        Models[Models]
        DB[(DB)]
    end

    subgraph Workers["Worker層"]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end

    Human --> WebUI
    Orch --> CLI
    Orch --> MCP
    WebUI --> Services
    CLI --> Services
    MCP --> Services
    Services --> DB
    CLI -.-> |worker run| W1
    CLI -.-> |worker run| W2
    CLI -.-> |worker run| W3
```

### レイヤー説明

**ユーザー層:** AgentMineを使う人（人間またはAI）

**インターフェース層:**
- Web UI: 人間向け。タスク管理、Worker監視
- CLI: Orchestrator向け。Worker起動、状態確認
- MCP Server: AIクライアント向け。ツールとして呼び出し

**コア層:** ビジネスロジックとデータ管理

**Worker層:** 実際にコードを書くAI。worktreeで隔離

## パッケージ構成

モノレポ構成で3つのパッケージを持つ。

| パッケージ | 役割 | 主な機能 |
|------------|------|----------|
| `@agentmine/core` | 共有ロジック | DB操作、Service、Model |
| `@agentmine/cli` | CLIアプリ | コマンド、MCP Server |
| `@agentmine/web` | Web UI | Next.js App |

CoreはCLIとWebの両方から利用される。

```mermaid
flowchart LR
    CLI[cli] --> Core[core]
    Web[web] --> Core
    Core --> DB[(DB)]
```

## データフロー

### Worker起動時

```mermaid
sequenceDiagram
    participant Orch as Orchestrator
    participant CLI as agentmine CLI
    participant DB as Database
    participant WT as Worktree
    participant Worker as Worker AI

    Orch->>CLI: worker run <taskId>
    CLI->>DB: タスク・Agent情報取得
    CLI->>WT: worktree作成
    CLI->>WT: スコープ適用
    CLI->>DB: Memory Bank取得
    CLI->>WT: Memory出力
    CLI->>Worker: AIクライアント起動
    Worker->>WT: コード作成・編集
    Worker-->>CLI: 終了（exit code）
    CLI->>DB: セッション記録
```

### Web UIからの操作

```mermaid
sequenceDiagram
    participant Browser
    participant API as API Route
    participant Service as Core Service
    participant DB as Database

    Browser->>API: POST /api/tasks
    API->>Service: createTask()
    Service->>DB: INSERT
    DB-->>Service: task
    Service-->>API: task
    API-->>Browser: JSON response
```

## DB戦略

### 使い分け

| 環境 | DB | 理由 |
|------|-----|------|
| チーム開発 | PostgreSQL | 複数人での同時アクセス、リアルタイム共有 |
| 個人利用 | SQLite | セットアップ不要、ポータブル |

Drizzle ORMで両方をサポートし、環境変数で切り替える。

### PostgreSQLを選ぶケース

- 複数人で同じプロジェクトを管理する
- リモートからアクセスしたい
- 将来的にベクトル検索を使いたい（pgvector）

### SQLiteを選ぶケース

- 1人で使う
- サーバー設定なしで始めたい
- オフラインで使う

## 技術スタック

| カテゴリ | 技術 | 選定理由 |
|---------|------|----------|
| 言語 | TypeScript | 型安全、IDE支援 |
| モノレポ | pnpm + Turborepo | 高速、キャッシュ対応 |
| CLI | Commander.js | 標準的、ドキュメント充実 |
| ORM | Drizzle | 型安全、軽量、SQLite/PG両対応 |
| Web | Next.js (App Router) | React最新、SSR対応 |
| UI | shadcn/ui + Tailwind | カスタマイズ性、モダン |
| テスト | Vitest | 高速、TypeScript対応 |

## セキュリティ考慮

### Worker隔離

各Workerは独立したgit worktreeで作業する。互いのファイルにアクセスできない。

### スコープ制御

Workerがアクセスできるファイルを物理的に制限する。

| スコープ | 物理的状態 | 説明 |
|---------|-----------|------|
| exclude | ファイルが存在しない | sparse-checkoutで除外 |
| read | 読み取り専用 | 参照可能 |
| write | 書き込み可能 | 編集可能 |

制限があることで、AIの自動承認モードを安全に使える。

### DoD検証

Worker完了後にlint/test/build等を自動実行する。失敗したらマージをブロック。

スコープ制御が「何にアクセスできるか」を制限するのに対し、DoD検証は「何を満たせばマージできるか」を保証する。両方を組み合わせることで、AIの自動承認モードを安全に使える。

### 認証情報

APIキー等はDBに保存せず、環境変数で管理する。

## 関連ドキュメント

- 概要: @01-introduction/overview.md
- Worker実行フロー: @07-runtime/worker-lifecycle.md
- スコープ制御: @03-core-concepts/scope-control.md
- データモデル: @04-data/data-model.md
- Web UI: @06-interfaces/web/overview.md
- 用語集: @appendix/glossary.md
