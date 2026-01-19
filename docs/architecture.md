# Architecture

agentmineのアーキテクチャ設計。

## 概要

agentmineは、AIエージェントと人間が協調してプロジェクトを管理するためのツール。
Redmineのようなチケット管理をAIエージェント向けに最適化している。

## コンポーネント

### 1. CLI (Go)

AIエージェント向けの高速インターフェース。

```
cli/
├── cmd/
│   └── agentmine/
│       └── main.go          # エントリーポイント
├── internal/
│   ├── db/                  # SQLite操作
│   │   ├── db.go
│   │   └── migrations.go
│   ├── task/                # タスク管理
│   │   ├── task.go
│   │   └── commands.go
│   ├── agent/               # エージェント管理
│   │   ├── agent.go
│   │   └── runner.go
│   ├── skill/               # スキル管理
│   │   ├── skill.go
│   │   └── executor.go
│   └── config/              # 設定管理
│       └── config.go
├── go.mod
└── go.sum
```

### 2. Web UI (Next.js)

人間向けのダッシュボード。

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx         # ダッシュボード
│   │   ├── tasks/           # タスク一覧・詳細
│   │   ├── agents/          # エージェント設定
│   │   └── settings/        # プロジェクト設定
│   ├── components/
│   │   ├── kanban/          # カンバンボード
│   │   ├── timeline/        # タイムライン
│   │   └── ui/              # shadcn/ui
│   └── lib/
│       └── db.ts            # SQLite接続
├── package.json
└── next.config.js
```

### 3. Database (SQLite)

ローカル完結の軽量データベース。

```
~/.agentmine/
├── global.db                # グローバルDB（プロジェクト一覧等）
└── config.yaml              # グローバル設定

<project>/.agentmine/
├── project.db               # プロジェクトローカルDB
├── config.yaml              # プロジェクト設定
└── skills/                  # カスタムスキル
    └── deploy.md
```

## データフロー

### タスク作成フロー

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│   CLI   │────>│   DB    │<────│  Web UI │
│ (AI)    │     │ (SQLite)│     │ (Human) │
└─────────┘     └─────────┘     └─────────┘
     │                               │
     │  agentmine task add "..."     │  フォームで作成
     │                               │
     └───────────────┬───────────────┘
                     ▼
              ┌─────────────┐
              │   tasks     │
              │   table     │
              └─────────────┘
```

### タスク実行フロー

```
1. agentmine task start 3
   └─> status: open -> in_progress
   └─> git checkout -b task-3-feature-name
   └─> histories: action=started

2. AI Agent executes task
   └─> sessions: 実行ログ記録
   └─> 定期的に progress 更新

3. agentmine task done 3
   └─> status: in_progress -> review
   └─> git commit && git push
   └─> gh pr create
   └─> tasks: pr_url 設定

4. Human reviews and merges
   └─> status: review -> done
   └─> histories: action=completed
```

## 設定ファイル

### グローバル設定 (`~/.agentmine/config.yaml`)

```yaml
default_model: claude-sonnet
default_agent: coder

builtin_skills:
  - commit
  - test
  - review
  - debug

web_ui:
  port: 3333
  auto_open: true
```

### プロジェクト設定 (`.agentmine/config.yaml`)

```yaml
project:
  name: MyProject
  description: "プロジェクトの説明"

agents:
  coder:
    description: "コード実装担当"
    model: claude-sonnet
    tools:
      - Read
      - Write
      - Edit
      - Bash
      - Grep
      - Glob
    skills:
      - commit
      - test
      - debug

  reviewer:
    description: "コードレビュー担当"
    model: claude-haiku
    tools:
      - Read
      - Grep
      - Glob
    skills:
      - review

skills:
  deploy:
    source: local
    path: .agentmine/skills/deploy.md

  notify:
    source: inline
    prompt: |
      Slackに通知を送信してください。
      チャンネル: #dev
      メッセージ: {{message}}

git:
  branch_prefix: "task-"
  auto_pr: true
```

## CLI コマンド設計

```
agentmine
├── init                     # プロジェクト初期化
├── projects                 # プロジェクト一覧
│
├── task
│   ├── add <title>          # タスク追加
│   ├── list                 # 一覧
│   ├── show <id>            # 詳細
│   ├── edit <id>            # 編集
│   ├── assign <id> <agent>  # 担当割当
│   ├── start <id>           # 着手
│   ├── done <id>            # 完了
│   └── cancel <id>          # キャンセル
│
├── agent
│   ├── list                 # 一覧
│   ├── show <name>          # 詳細
│   ├── run <name> <prompt>  # 実行
│   └── define <name>        # 定義追加
│
├── skill
│   ├── list                 # 一覧
│   ├── show <name>          # 詳細
│   └── run <name>           # 実行
│
├── history <task_id>        # 履歴表示
│
└── ui                       # Web UI起動
```

## 将来の拡張

1. **リモート同期**: GitHub Issues / Linear との同期
2. **通知**: Slack / Discord 連携
3. **メトリクス**: 生産性分析ダッシュボード
4. **チーム機能**: 複数人での利用
