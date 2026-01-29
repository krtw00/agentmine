# Navigation テスト仕様

## 概要

サイドバーナビゲーションの動作を検証する。

## テストケース

### サイドバーナビゲーション

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| NAV-001 | Dashboardリンク | / へ遷移 |
| NAV-002 | Tasksリンク | /tasks へ遷移 |
| NAV-003 | Sessionsリンク | /sessions へ遷移 |
| NAV-004 | Agentsリンク | /agents へ遷移 |
| NAV-005 | Memoryリンク | /memory へ遷移 |
| NAV-006 | Settingsリンク | /settings へ遷移 |

## E2Eシナリオ

### NAV-E2E-001: 全ページ遷移テスト

```bash
agent-browser open http://localhost:3000
agent-browser wait 500

# Dashboard -> Tasks
agent-browser click "a[href='/tasks']"
agent-browser wait 500
agent-browser get url  # 期待: /tasks

# Tasks -> Sessions
agent-browser click "a[href='/sessions']"
agent-browser wait 500
agent-browser get url  # 期待: /sessions

# Sessions -> Agents
agent-browser click "a[href='/agents']"
agent-browser wait 500
agent-browser get url  # 期待: /agents

# Agents -> Memory
agent-browser click "a[href='/memory']"
agent-browser wait 500
agent-browser get url  # 期待: /memory

# Memory -> Settings
agent-browser click "a[href='/settings']"
agent-browser wait 500
agent-browser get url  # 期待: /settings

# Settings -> Dashboard
agent-browser click "a[href='/']"
agent-browser wait 500
agent-browser get url  # 期待: /
```

## テストスクリプト

- `packages/web/e2e/navigation/basic.sh` - 全ページ遷移

## 合格基準

- 全てのナビゲーションリンクが正常に遷移する
- URLが期待通りに変更される
- アクティブ状態が正しく表示される
