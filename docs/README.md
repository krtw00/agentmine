# agentmine Design Documents

設計ドキュメント一覧

## Overview

- [Architecture](./architecture.md) - システムアーキテクチャ概要
- [Data Model](./data-model.md) - データモデル設計（ER図、スキーマ）
- [CLI Design](./cli-design.md) - CLIコマンド設計

## Features

各機能の詳細設計：

- [Agent Execution](./features/agent-execution.md) - **エージェント実行フロー（詳細）**
- [Agent System](./features/agent-system.md) - エージェント定義・実行
- [Authentication](./features/authentication.md) - 認証・認可
- [Error Handling](./features/error-handling.md) - エラーハンドリング・リカバリー
- [Git Integration](./features/git-integration.md) - Git操作・PR連携
- [Memory Bank](./features/memory-bank.md) - プロジェクト決定事項の永続化
- [Parallel Execution](./features/parallel-execution.md) - 並列タスク実行
- [Session Log](./features/session-log.md) - セッションログ・監査
- [Skill System](./features/skill-system.md) - スキルの位置づけ（管理外）
- [Task Decomposition](./features/task-decomposition.md) - PRD→タスク分解
- [MCP Integration](./features/mcp-integration.md) - MCPサーバー

## API

- [MCP API](./api/mcp-api.md) - MCP Tools/Resources定義

## Decisions

アーキテクチャ決定記録（ADR）：

- [ADR-001: TypeScript Monorepo](./adr/001-typescript-monorepo.md)
- [ADR-002: Database Strategy](./adr/002-sqlite-default.md) - SQLite + PostgreSQL
- [ADR-003: Drizzle ORM](./adr/003-drizzle-orm.md)

### 技術比較

- [MySQL vs PostgreSQL 詳細比較](./adr/mysql-vs-postgresql-comparison.md) - グローバル市場・企業向け分析
