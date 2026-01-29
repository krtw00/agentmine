# Dashboard テスト仕様

## 概要

Dashboardページの表示・動作を検証する。

## テストケース

### 表示テスト

| ID | テスト内容 | 期待結果 |
|----|-----------|----------|
| DASH-001 | Dashboardページにアクセス | タイトル「Dashboard」が表示される |
| DASH-002 | タスクサマリーカード表示 | Open/In Progress/Done/Failedカウントが表示される |
| DASH-003 | アクティブセッション表示 | 実行中セッションがあればリスト表示される |
| DASH-004 | エージェント数表示 | 登録エージェント数が表示される |

## E2Eシナリオ

### DASH-E2E-001: Dashboard基本表示

```bash
agent-browser open http://localhost:3000
agent-browser wait 1000
agent-browser snapshot -i  # インタラクティブ要素確認

# 検証項目:
# - タイトル「Dashboard」が表示
# - Tasks, Sessions, Agents, Memory, Settings のナビゲーションが存在
# - タスクサマリーカードが表示
```

## テストスクリプト

`packages/web/e2e/dashboard/basic.sh`

## 合格基準

- タイトルが正しく表示される
- サマリー情報が表示される
- ナビゲーションリンクが全て存在する
