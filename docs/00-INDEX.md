# AgentMine ドキュメント

**Safe Parallel AI Development Environment** - 複数AIを同時に、安全に、管理可能に

## 目的

AgentMineドキュメントのナビゲーションを提供する。本ドキュメントはドキュメント構造のSSoT（Single Source of Truth）である。

## ドキュメント構造

C4モデル + arc42に基づいて階層化。

| ディレクトリ | 内容 |
|-------------|------|
| 00-INDEX | このファイル。ナビゲーション・入り口 |
| 00-writing-guidelines | ドキュメント執筆ガイドライン |
| 01-introduction | プロジェクト概要 |
| 02-architecture | システム構成 |
| 03-core-concepts | 中核となる概念・原則 |
| 04-data | データモデル・DB |
| 05-features | 機能詳細 |
| 06-interfaces | CLI/MCP/Web |
| 07-runtime | 実行フロー |
| 08-deployment | インストール・設定 |
| 09-development | 開発者向けガイド |
| 10-decisions | アーキテクチャ決定記録（ADR） |
| appendix | 付録（用語集等） |

### C4モデル対応

| C4レベル | 説明 | 対応ドキュメント |
|---------|------|-----------------|
| Level 1: Context | システム全体と外部との関係 | 01-introduction/overview.md |
| Level 2: Container | 主要コンポーネント（CLI, Web, Core） | 02-architecture/architecture.md |
| Level 3: Component | 各コンポーネントの内部構造 | 05-features/, 06-interfaces/ |
| Level 4: Code | 実装詳細 | 04-data/data-model.md |

### arc42対応

| arc42セクション | 対応ディレクトリ |
|----------------|-----------------|
| 1. Introduction and Goals | 01-introduction |
| 4. Solution Strategy | 03-core-concepts |
| 5. Building Block View | 02-architecture, 05-features, 06-interfaces |
| 6. Runtime View | 07-runtime |
| 7. Deployment View | 08-deployment |
| 8. Cross-cutting Concepts | 03-core-concepts |
| 9. Architecture Decisions | 10-decisions |
| 12. Glossary | appendix |

## はじめに読むべきドキュメント

### 初めての方

AgentMineが何をするものか理解したい：

| 順序 | ドキュメント | 内容 |
|:----:|------------|------|
| 1 | @02-architecture/architecture.md | プロジェクト概要・システム構成図 |
| 2 | @03-core-concepts/orchestrator-worker.md | Orchestrator/Workerモデル |
| 3 | @01-introduction/overview.md | Core Value・動作フロー |

### 利用者（Orchestrator開発者）

AIを使って開発タスクを自動化したい：

| 順序 | ドキュメント | 内容 |
|:----:|------------|------|
| 1 | @07-runtime/worker-lifecycle.md | Worker起動から終了まで |
| 2 | @06-interfaces/cli/overview.md | CLIコマンド一覧 |
| 3 | @05-features/memory-bank.md | プロジェクト決定事項の管理 |
| 4 | @06-interfaces/mcp/overview.md | MCPツール一覧 |

### 開発者（AgentMine本体を開発）

AgentMineの機能を実装・拡張したい：

| 順序 | ドキュメント | 内容 |
|:----:|------------|------|
| 1 | @08-deployment/installation.md | インストール手順 |
| 2 | @04-data/data-model.md | データベーススキーマ |
| 3 | @02-architecture/architecture.md | パッケージ構成 |

## ドキュメント一覧

### 00-ルートファイル

| ファイル | 内容 |
|---------|------|
| INDEX.md | このファイル。ナビゲーション・入り口 |
| writing-guidelines.md | ドキュメント執筆ガイドライン |

### 01-introduction

| ファイル | 内容 |
|---------|------|
| overview.md | AgentMineの概要、Core Value、動作フロー |

### 02-architecture

| ファイル | 内容 |
|---------|------|
| architecture.md | システムアーキテクチャ、パッケージ構成 |

### 03-core-concepts

| ファイル | 内容 |
|---------|------|
| orchestrator-worker.md | Orchestrator/Workerモデル |
| db-master.md | DBマスター方式 |
| observable-facts.md | Observable Facts（客観事実による判定） |
| scope-control.md | スコープ制御（exclude/read/write） |

### 04-data

| ファイル | 内容 |
|---------|------|
| data-model.md | データベーススキーマ、テーブル定義 |

### 05-features

| ファイル | 内容 |
|---------|------|
| agent-system.md | Agent定義・管理 |
| memory-bank.md | Memory Bank（プロジェクト決定事項） |
| session-log.md | Session Log（実行記録） |
| error-handling.md | エラーハンドリング |

### 06-interfaces

| ファイル | 内容 |
|---------|------|
| cli/overview.md | CLI設計、コマンド一覧 |
| mcp/overview.md | MCP設計、ツール一覧 |
| web/overview.md | Web UI設計 |

### 07-runtime

| ファイル | 内容 |
|---------|------|
| worker-lifecycle.md | Worker実行フロー（起動〜終了） |

### 08-deployment

| ファイル | 内容 |
|---------|------|
| installation.md | インストール手順 |
| configuration.md | 設定方法 |

### 09-development

| ファイル | 内容 |
|---------|------|
| contributing.md | 開発者向けガイド（環境構築、規約、PR） |

### 10-decisions

| ファイル | 内容 |
|---------|------|
| 001-typescript-monorepo.md | ADR-001: TypeScript Monorepo採用 |
| 002-sqlite-default.md | ADR-002: SQLite + PostgreSQL戦略 |
| 003-drizzle-orm.md | ADR-003: Drizzle ORM採用 |
| 004-multi-project-single-db.md | ADR-004: 複数プロジェクト・単一DB |
| 005-ai-agnostic-orchestration.md | ADR-005: AI非依存のOrchestrator設計 |
| 006-dependency-and-proposals.md | ADR-006: 依存関係モデルと提案テーブル |
| 007-five-layer-architecture.md | ADR-007: 5層アーキテクチャ |
| mysql-vs-postgresql-comparison.md | MySQL vs PostgreSQL詳細比較 |

### appendix

| ファイル | 内容 |
|---------|------|
| glossary.md | 用語集 |

## トピック別インデックス

### 設計・原則

| トピック | ドキュメント |
|---------|------------|
| システムアーキテクチャ | @02-architecture/architecture.md |
| DBマスター方式 | @03-core-concepts/db-master.md |
| Observable Facts | @03-core-concepts/observable-facts.md |
| スコープ制御 | @03-core-concepts/scope-control.md |
| アーキテクチャ決定 | @10-decisions/ |

### 実行

| トピック | ドキュメント |
|---------|------------|
| Worker実行フロー | @07-runtime/worker-lifecycle.md |
| Session Log | @05-features/session-log.md |
| エラーハンドリング | @05-features/error-handling.md |

### インターフェース

| トピック | ドキュメント |
|---------|------------|
| CLI | @06-interfaces/cli/overview.md |
| MCP | @06-interfaces/mcp/overview.md |
| Web UI | @06-interfaces/web/overview.md |

### 機能

| トピック | ドキュメント |
|---------|------------|
| Agent定義 | @05-features/agent-system.md |
| Memory Bank | @05-features/memory-bank.md |

### デプロイ

| トピック | ドキュメント |
|---------|------------|
| インストール | @08-deployment/installation.md |
| 設定 | @08-deployment/configuration.md |

## よくある質問への直リンク

| 質問 | ドキュメント |
|------|-------------|
| AgentMineとは何？ | @01-introduction/overview.md |
| どうやってインストールする？ | @08-deployment/installation.md |
| Worker起動の仕組みは？ | @07-runtime/worker-lifecycle.md |
| Memory Bankとは？ | @05-features/memory-bank.md |
| スコープ制御とは？ | @03-core-concepts/scope-control.md |
| CLIコマンド一覧は？ | @06-interfaces/cli/overview.md |
| DBスキーマは？ | @04-data/data-model.md |
| 用語の意味は？ | @appendix/glossary.md |

## ドキュメント凡例

### 相対パス表記

ドキュメント内では @ で始まる相対パスで他ドキュメントを参照：

| 表記 | 意味 |
|------|------|
| @02-architecture/architecture.md | docsルートからの相対パス |
| @../README.md | 親ディレクトリからの相対パス |

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 3.0 | 2026-01-21 | ガイドライン適用（コードブロック削除、テーブル化） |
| 2.0 | 2026-01-20 | C4モデル + arc42に基づく構造化 |
| 1.0 | 2025-12 | 初版 |

**次に読むべきドキュメント**: @01-introduction/overview.md
