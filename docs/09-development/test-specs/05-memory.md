# Memory Bank テスト仕様

## 概要

Memory Bank一覧・詳細・CRUD操作を検証する。

## テストケース

### 一覧表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| MEM-001 | Memoryページにアクセス | メモリ一覧が表示される |
| MEM-002 | カテゴリフィルター | カテゴリで絞り込み可能 |
| MEM-003 | メモリ詳細表示 | メモリクリックで詳細表示 |

### CRUD テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| MEM-010 | 新規作成ボタンクリック | /memory/new へ遷移 |
| MEM-011 | メモリ作成フォーム | カテゴリ、タイトル、コンテンツ入力 |
| MEM-012 | メモリ作成送信 | メモリが作成される |

## E2Eシナリオ

### MEM-E2E-001: メモリ作成フロー

```bash
agent-browser open http://localhost:3000/memory
agent-browser wait 1000
agent-browser click "a[href='/memory/new']"
agent-browser wait 500
agent-browser fill "input[name='title']" "E2E Test Memory"
agent-browser fill "textarea[name='content']" "# Test Content\n\nCreated by E2E test"
agent-browser click "button[type='submit']"
agent-browser wait 1000
# 期待: メモリが作成され一覧に表示
```

## テストスクリプト

- `packages/web/e2e/memory/basic.sh` - 基本表示・CRUD

## 合格基準

- メモリ一覧が正しく表示される
- カテゴリフィルターが機能する
- CRUD操作が正常に動作する
