# Agents テスト仕様

## 概要

エージェント一覧・詳細・CRUD操作を検証する。

## テストケース

### 一覧表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| AGENT-001 | Agentsページにアクセス | エージェント一覧が表示される |
| AGENT-002 | エージェントカード表示 | 名前、クライアント、説明が表示 |
| AGENT-003 | エージェント詳細表示 | カードクリックで詳細表示 |

### CRUD テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| AGENT-010 | 新規作成ボタンクリック | /agents/new へ遷移 |
| AGENT-011 | エージェント作成フォーム | 名前、クライアント、スコープ入力 |
| AGENT-012 | エージェント作成送信 | エージェントが作成される |
| AGENT-013 | エージェント編集 | 編集画面で更新可能 |
| AGENT-014 | エージェント削除 | 削除確認後に削除 |

## E2Eシナリオ

### AGENT-E2E-001: エージェント一覧表示

```bash
agent-browser open http://localhost:3000/agents
agent-browser wait 1000
agent-browser snapshot -i
# 期待: coder, webui-coder等のエージェントカードが表示
```

### AGENT-E2E-002: エージェント詳細表示

```bash
agent-browser click "a:has-text('coder')"
agent-browser wait 500
# 期待: エージェント詳細（スコープ、設定）が表示
```

## テストスクリプト

- `packages/web/e2e/agents/basic.sh` - 一覧・詳細表示

## 合格基準

- エージェント一覧が正しく表示される
- 詳細情報（スコープ含む）が表示される
- CRUD操作が正常に動作する
