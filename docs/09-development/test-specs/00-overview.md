# Web UI テスト仕様書

## 概要

Web UIの品質を保証するためのテスト仕様。

## テスト種別

| テスト種別 | ツール | 目的 |
|-----------|--------|------|
| APIテスト | Vitest | APIエンドポイントの動作検証 |
| E2Eテスト | agent-browser | ユーザー操作フローの検証 |
| スナップショットテスト | agent-browser snapshot | アクセシビリティツリー検証 |

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| [01-dashboard.md](./01-dashboard.md) | Dashboard テスト |
| [02-tasks.md](./02-tasks.md) | Tasks テスト |
| [03-sessions.md](./03-sessions.md) | Sessions テスト |
| [04-agents.md](./04-agents.md) | Agents テスト |
| [05-memory.md](./05-memory.md) | Memory Bank テスト |
| [06-settings.md](./06-settings.md) | Settings テスト |
| [07-navigation.md](./07-navigation.md) | ナビゲーション テスト |
| [08-api.md](./08-api.md) | API テスト |

## 前提条件

### 環境

| 項目 | 値 |
|------|-----|
| Web UI起動 | `http://localhost:3000` |
| DB | `.agentmine/data.db`（テスト用データ投入済み） |

### テスト用データ

テスト実行前に以下のデータを投入：

```bash
# タスク
agentmine task add "E2E Test Task 1" --priority high
agentmine task add "E2E Test Task 2" --type feature

# エージェント（デフォルトで存在）
# coder, codex-coder, test-coder, webui-coder
```

## テスト実行方法

### 準備

```bash
# 1. Web UI起動
cd /home/iguchi/work/agentmine
pnpm dev

# 2. 別ターミナルでテスト用データ準備
agentmine task add "E2E Test Task" --priority high
```

### agent-browser E2Eテスト実行

```bash
# 全テスト実行
./packages/web/e2e/run-all.sh

# headedモードで実行（ブラウザを表示）
./packages/web/e2e/run-all.sh --headed

# 個別テスト実行
./packages/web/e2e/tasks-test.sh "session-name" "http://localhost:3000"
```

### スクリプト一覧

| スクリプト | 内容 |
|-----------|------|
| `run-all.sh` | 全テスト実行 |
| `nav-test.sh` | ナビゲーションテスト |
| `dashboard-test.sh` | Dashboardテスト |
| `tasks-test.sh` | Tasksテスト |
| `sessions-test.sh` | Sessionsテスト |
| `agents-test.sh` | Agentsテスト |
| `memory-test.sh` | Memoryテスト |
| `settings-test.sh` | Settingsテスト |

## 合格基準

| 基準 | 条件 |
|------|------|
| APIテスト | 全APIエンドポイントが正常応答 |
| E2Eテスト | 全シナリオが期待通りに動作 |
| エラーハンドリング | 不正入力時に適切なエラー表示 |
| レスポンス時間 | ページ遷移が3秒以内 |

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0 | 2026-01-21 | 初版作成 |
| 1.1 | 2026-01-21 | UIごとにファイル分割 |
