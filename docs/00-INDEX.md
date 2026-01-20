# agentmine ドキュメント

**Safe Parallel AI Development Environment** - 複数AIを同時に、安全に、管理可能に

## ドキュメント構造

このドキュメントは**C4モデル + arc42**に基づいて階層化されています。

```
00-INDEX (このファイル)              ← ナビゲーション・入り口
01-introduction                      ← プロジェクト概要
02-architecture                      ← システム構成
03-core-concepts                     ← 中核となる概念・原則
04-data                              ← データモデル・DB
05-features                          ← 機能詳細
06-interfaces                        ← CLI/MCP/Web
07-runtime                           ← 実行フロー
08-deployment                        ← インストール・設定
09-development                       ← 開発者向け
10-decisions (adr/)                  ← アーキテクチャ決定記録
appendix                             ← 付録（用語集・FAQ等）
```

---

## はじめに読むべきドキュメント

### 初めての方

agentmineが何をするものか理解したい：

1. **@architecture.md** - プロジェクト概要・システム構成図・Core Value
2. **@03-core-concepts/orchestrator-worker.md** - Orchestrator/Workerモデル
3. **@README.md** - クイックスタート

### 利用者（Orchestrator開発者）

AIを使って開発タスクを自動化したい：

1. **@07-runtime/worker-lifecycle.md** - Worker起動から終了まで
2. **@06-interfaces/cli/overview.md** - CLIコマンド一覧
3. **@features/memory-bank.md** - プロジェクト決定事項の管理
4. **@06-interfaces/mcp/overview.md** - MCPツール一覧

### 開発者（agentmine本体を開発）

agentmineの機能を実装・拡張したい：

1. **@implementation-plan.md** - 開発環境セットアップ・実装ガイド
2. **@data-model.md** - データベーススキーマ
3. **@architecture.md** - パッケージ構成
4. **@README.md** - クイックスタート

---

## ロール別ガイド

### Orchestrator開発者（AIを使う人）

**目的**: タスクを分割し、複数のWorkerを並列実行して開発を加速

**必読ドキュメント:**
1. @03-core-concepts/orchestrator-worker.md - あなたの役割
2. @07-runtime/worker-lifecycle.md - Worker起動・監視・完了
3. @features/parallel-execution.md - 並列実行の方法
4. @features/memory-bank.md - プロジェクト知識の管理
5. @06-interfaces/cli/overview.md - CLIコマンドリファレンス

**典型的なフロー:**
```bash
# 1. タスク作成
agentmine task add "ログイン機能実装"

# 2. Worker起動
agentmine worker run 1 --exec --detach

# 3. 監視
agentmine worker status 1

# 4. 完了
agentmine worker done 1
```

### Web UI利用者（人間）

**目的**: Web画面でタスク管理・Agent定義・Worker監視

**必読ドキュメント:**
1. @06-interfaces/web/overview.md - Web UIの全体像・各画面の使い方
2. @features/agent-system.md - Agent定義
3. @data-model.md - データモデル

### agentmine開発者

#### バックエンド開発者

**必読ドキュメント:**
1. @data-model.md - DBスキーマ
2. @architecture.md - パッケージ構成
3. @06-interfaces/cli/overview.md - CLI設計
4. @06-interfaces/mcp/overview.md - MCP設計

#### フロントエンド開発者

**必読ドキュメント:**
1. @06-interfaces/web/overview.md - Web UI構成・API Routes仕様
2. @data-model.md - データモデル
3. @architecture.md - システム構成

#### Worker実装者（AIクライアント対応）

**必読ドキュメント:**
1. @03-core-concepts/scope-control.md - スコープ制御
2. @07-runtime/worker-lifecycle.md - Worker実行フロー
3. @features/agent-system.md - Agent定義

---

## トピック別インデックス

### 設計・原則

- **設計原則**: @02-architecture/design-principles.md
- **DBマスター**: @03-core-concepts/db-master.md
- **Observable Facts**: @03-core-concepts/observable-facts.md
- **アーキテクチャ決定**: @adr/ (ADR)

### データ

- **データモデル**: @data-model.md
- **スキーマ定義**: @data-model.md

### 実行

- **Worker起動**: @07-runtime/worker-lifecycle.md
- **並列実行**: @features/parallel-execution.md
- **セッション**: @features/session-log.md

### インターフェース

- **CLI**: @06-interfaces/cli/overview.md
- **MCP**: @06-interfaces/mcp/overview.md
- **Web UI**: @06-interfaces/web/overview.md

### 機能

- **Agent定義**: @features/agent-system.md
- **Memory Bank**: @features/memory-bank.md
- **認証**: @features/authentication.md
- **エラーハンドリング**: @features/error-handling.md
- **Git統合**: @features/git-integration.md
- **Worktreeスコープ**: @features/worktree-scope.md

---

## よくある質問への直リンク

| 質問 | ドキュメント |
|------|-------------|
| agentmineとは何？ | @architecture.md |
| どうやってインストールする？ | @implementation-plan.md |
| Worker起動の仕組みは？ | @07-runtime/worker-lifecycle.md |
| 並列実行の方法は？ | @features/parallel-execution.md |
| Memory Bankとは？ | @features/memory-bank.md |
| スコープ制御とは？ | @03-core-concepts/scope-control.md |
| CLIコマンド一覧は？ | @06-interfaces/cli/overview.md |
| DBスキーマは？ | @data-model.md |
| 開発環境セットアップは？ | @implementation-plan.md |

---

## ドキュメント凡例

### アイコン

- 🎯 **重要**: 必ず理解すべき概念
- 💡 **ヒント**: 役立つ情報
- ⚠️ **注意**: よくある間違い・注意点
- 🔗 **参照**: 関連ドキュメント

### 相対パス表記

ドキュメント内では `@` で始まる相対パスで他ドキュメントを参照：
- `@architecture.md` - docsルートからの相対パス
- `@../03-core-concepts/db-master.md` - 現在のディレクトリからの相対パス
- `@./features/memory-bank.md` - 現在のディレクトリからの相対パス

---

## 貢献

ドキュメントの改善提案は大歓迎です：
- Issue/PRで提案してください
- @README.md - プロジェクト概要

---

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 2.0 | 2026-01-20 | C4モデル + arc42に基づく構造化 |
| 1.0 | 2025-12 | 初版 |

---

**次に読むべきドキュメント**: @architecture.md
