# Sessions テスト仕様

## 概要

セッション一覧・詳細表示を検証する。

## テストケース

### 一覧表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| SESS-001 | Sessionsページにアクセス | セッション一覧が表示される |
| SESS-002 | ステータスフィルター | Running/Completed/Failedで絞り込み |
| SESS-003 | セッション詳細表示 | セッションクリックで詳細表示 |

## E2Eシナリオ

### SESS-E2E-001: セッション一覧表示

```bash
agent-browser open http://localhost:3000/sessions
agent-browser wait 1000
agent-browser snapshot -i
# 期待: セッションリストまたは「No sessions」メッセージが表示
```

## テストスクリプト

- `packages/web/e2e/sessions/basic.sh` - 基本表示

## 合格基準

- セッション一覧が正しく表示される
- ステータスフィルターが機能する
- 詳細ページへの遷移が正常
