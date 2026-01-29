# Tasks テスト仕様

## 概要

タスク一覧・詳細・CRUD操作を検証する。

## テストケース

### 一覧表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| TASK-001 | Tasksページにアクセス | タスク一覧が表示される |
| TASK-002 | ステータスフィルター | フィルター選択でタスクが絞り込まれる |
| TASK-003 | 優先度フィルター | 優先度で絞り込み可能 |
| TASK-004 | ソート機能 | 作成日/優先度でソート可能 |

### CRUD テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| TASK-010 | 新規作成ボタンクリック | /tasks/new へ遷移 |
| TASK-011 | タスク作成フォーム入力 | 必須項目：タイトル |
| TASK-012 | タスク作成送信 | タスクが作成され一覧に表示 |
| TASK-013 | タスク詳細表示 | タスクカードクリックで詳細表示 |
| TASK-014 | タスク編集 | 編集ボタンで編集画面へ |
| TASK-015 | タスク削除 | 削除確認後に削除 |

## E2Eシナリオ

### TASK-E2E-001: タスク作成フロー

```bash
agent-browser open http://localhost:3000/tasks
agent-browser wait 1000
agent-browser click "a[href='/tasks/new']"
agent-browser wait 500
agent-browser fill "input[name='title']" "E2E Created Task"
agent-browser fill "textarea[name='description']" "Created by agent-browser E2E test"
agent-browser click "button[type='submit']"
agent-browser wait 1000
# 期待: 一覧に戻り、作成したタスクが表示される
```

### TASK-E2E-002: タスク詳細・編集フロー

```bash
agent-browser open http://localhost:3000/tasks
agent-browser wait 1000
agent-browser click "a:has-text('E2E Created Task')"
agent-browser wait 500
# 期待: タスク詳細ページが表示される
agent-browser click "a:has-text('Edit')"
agent-browser wait 500
agent-browser fill "input[name='title']" "E2E Updated Task"
agent-browser click "button[type='submit']"
agent-browser wait 1000
# 期待: 更新が反映される
```

### TASK-E2E-003: タスク削除フロー

```bash
agent-browser open http://localhost:3000/tasks
agent-browser click "a:has-text('E2E Updated Task')"
agent-browser wait 500
agent-browser click "button:has-text('Delete')"
agent-browser wait 500
agent-browser click "button:has-text('Delete')"  # 確認ダイアログ
agent-browser wait 1000
# 期待: タスクが削除され一覧から消える
```

## テストスクリプト

- `packages/web/e2e/tasks/list.sh` - 一覧表示
- `packages/web/e2e/tasks/crud.sh` - CRUD操作

## 合格基準

- タスク一覧が正しく表示される
- フィルター・ソートが機能する
- CRUD操作が全て正常に動作する
