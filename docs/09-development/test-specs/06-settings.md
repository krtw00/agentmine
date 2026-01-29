# Settings テスト仕様

## 概要

設定画面の表示・更新操作を検証する。

## テストケース

### 表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| SET-001 | Settingsページにアクセス | 設定カテゴリが表示される |
| SET-002 | Git設定表示 | baseBranch, remoteName |
| SET-003 | Execution設定表示 | maxWorkers, defaultTimeout |
| SET-004 | Paths設定表示 | worktreeDir, memoryDir |

### 更新テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| SET-010 | 設定値変更 | 入力後Saveボタンで保存 |
| SET-011 | 保存成功表示 | チェックマークアイコン表示 |

## E2Eシナリオ

### SET-E2E-001: 設定表示・更新

```bash
agent-browser open http://localhost:3000/settings
agent-browser wait 1000
agent-browser snapshot -i
# 期待: Git, Execution, Paths の設定カードが表示

agent-browser fill "input[value='3']" "5"  # maxWorkers変更
agent-browser click "button:has-text('Save')"
agent-browser wait 500
# 期待: 保存成功アイコンが表示
```

## テストスクリプト

- `packages/web/e2e/settings/basic.sh` - 基本表示・更新

## 合格基準

- 設定カテゴリが全て表示される
- 設定値の更新が正常に動作する
- 保存成功フィードバックが表示される
