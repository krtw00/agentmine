# agentmine

AI Project Manager - Redmine for AI agents with CLI and Web UI

## Overview

agentmineは、AIエージェントと人間が協調してプロジェクトを管理するためのツールです。

- **CLI**: AIエージェント向けの高速インターフェース
- **Web UI**: 人間向けのダッシュボード（カンバンボード、履歴表示）
- **SQLite**: ローカル完結の軽量データベース

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        agentmine                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐          ┌─────────────┐                  │
│   │   CLI (Go)  │          │  Web UI     │                  │
│   │             │          │  (Next.js)  │                  │
│   │  AI向け     │          │  人間向け    │                  │
│   └──────┬──────┘          └──────┬──────┘                  │
│          │                        │                          │
│          └────────┬───────────────┘                          │
│                   ▼                                          │
│          ┌───────────────┐                                   │
│          │   SQLite DB   │                                   │
│          └───────────────┘                                   │
│                   │                                          │
│          ┌───────┴───────┐                                   │
│          ▼               ▼                                   │
│   ┌────────────┐  ┌────────────┐                            │
│   │  Projects  │  │  Agents    │                            │
│   │  Tasks     │  │  Skills    │                            │
│   │  History   │  │  Prompts   │                            │
│   └────────────┘  └────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

## CLI Usage

```bash
# プロジェクト管理
agentmine init                          # プロジェクト初期化
agentmine projects                      # プロジェクト一覧

# タスク管理
agentmine task add "認証機能実装" -p high -t feature
agentmine task list [--status open]
agentmine task show 3
agentmine task assign 3 --agent coder
agentmine task start 3                  # 着手 → 自動でブランチ作成
agentmine task done 3                   # 完了 → PR作成

# エージェント管理
agentmine agent list
agentmine agent run coder "タスク3を実装して"

# スキル（即時呼び出し）
agentmine skill list
agentmine skill run commit
agentmine skill run test

# Web UI
agentmine ui                            # ブラウザでダッシュボード起動
```

## Project Configuration

`.agentmine/config.yaml`:

```yaml
project:
  name: MyProject

agents:
  coder:
    description: "コード実装"
    model: claude-sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]
    skills: [commit, test, debug]

  reviewer:
    description: "コードレビュー"
    model: claude-haiku
    tools: [Read, Grep, Glob]
    skills: [review]

skills:
  commit:
    source: builtin
  deploy:
    source: local
    path: .agentmine/skills/deploy.md
```

## Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| CLI | Go | Single binary, fast |
| Web UI | Next.js + shadcn/ui | Modern, familiar stack |
| DB | SQLite | Local, lightweight |

## Development

```bash
# CLI開発
cd cli
go build -o agentmine ./cmd/agentmine
./agentmine --help

# Web UI開発
cd web
npm install
npm run dev
```

## License

MIT
