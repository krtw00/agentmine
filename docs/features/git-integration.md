# Git Integration

Git操作とPR連携の設計。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                      責務分担                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent:        コード作成、コミット（作業記録）                      │
│  Orchestrator: ブランチ管理、push、PR作成、タスク状態管理           │
│                                                                     │
│  エージェントは成果物の作成に集中                                    │
│  Git操作のインフラ部分は Orchestrator が担当                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## ブランチ戦略

### 構成

```
main ──────────────────── 本番（人間のみマージ）
  │
develop ───────────────── 統合ブランチ（エージェントのPR先）
  │
  └─┬──┬──┬───────────── task-{id} ブランチ
    │  │  │
  task-1 task-2 task-3
```

### ルール

| ブランチ | 誰がマージ | PR先 |
|----------|-----------|------|
| main | 人間のみ | - |
| develop | 人間（PRレビュー後） | main |
| task-{id} | Orchestrator（自動） | develop |

### 安全性

```
エージェントが誤って main に push しても:
  → develop が緩衝帯となり本番に直接影響しない
  → develop → main は人間が判断

agentmine はツールを制御できないため、
ブランチ構成で安全性を担保する
```

## タスク実行フロー

```
┌──────────────┐
│ Orchestrator │
└──────┬───────┘
       │ 1. develop から task-{id} ブランチ作成
       │ 2. チェックアウト（または Worktree 作成）
       │ 3. エージェント起動
       ▼
┌──────────────┐
│    Agent     │
│              │ 4. コード作成
│              │ 5. git add
│              │ 6. git commit（自由形式）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Orchestrator │
│              │ 7. 完了検知（成果物ベース）
│              │ 8. コミットメッセージ整形（Memory Bank 規約）
│              │ 9. git push origin task-{id}
│              │ 10. gh pr create --base develop
│              │ 11. タスク status → review
└──────────────┘
```

## コミット規約

### エージェントのコミット

エージェントは自由形式でコミット。規約を知る必要はない。

```bash
# エージェントのコミット例
git commit -m "ログイン機能を追加した"
git commit -m "fixed bug"
```

### Orchestrator による整形

Orchestrator が Memory Bank から規約を取得し、コミットメッセージを整形。

```bash
# Memory Bank の規約
{
  category: 'convention',
  title: 'コミット規約',
  decision: 'Conventional Commits形式',
}

# 整形後
git commit --amend -m "feat(auth): ログイン機能を追加"
```

### 設定例

```yaml
# .agentmine/config.yaml
git:
  commitConvention:
    enabled: true
    format: conventional  # conventional | simple | custom
    # Memory Bank からも取得可能
```

## PR連携

### PR作成

Orchestrator が `gh pr create` を実行。

```bash
gh pr create \
  --base develop \
  --title "Task #{id}: {title}" \
  --body "..." \
  --label "{type}"
```

### テンプレート

PRテンプレートは agentmine で管理しない。

```
GitHub の機能を使用:
  .github/PULL_REQUEST_TEMPLATE.md

プロジェクトごとに異なるため、
各リポジトリで設定する
```

### ラベル自動付与

タスクの type に応じてラベルを付与。

| タスク type | PRラベル |
|-------------|----------|
| feature | enhancement |
| bug | bug |
| refactor | refactor |
| task | - |

### タスク状態連携

| イベント | タスク状態 |
|----------|-----------|
| PR作成 | → review |
| PRマージ | → done |
| PRクローズ | → cancelled または open に戻す |

## コンフリクト対応

### 方針

```
コンフリクト検知 → タスクを blocked に → 人間に通知
自動解消はしない
```

### 理由

- 自動リベース/マージは意図しない変更のリスク
- コンフリクト解消は文脈理解が必要
- 人間の判断に委ねる方が安全

### フロー

```
Orchestrator: git push
    ↓
コンフリクト発生
    ↓
Orchestrator:
  1. タスク status → blocked
  2. エラー内容を記録
  3. 通知（設定されていれば）
    ↓
人間:
  1. 手動でコンフリクト解消
  2. タスク status → open に戻す
  3. 再実行
```

## Worktree対応

### 方針

| 実行モード | Worktree |
|------------|----------|
| 並列実行 | **強制** |
| 単一実行 | 任意 |

### 理由

```
並列実行:
  同時に複数ブランチで作業する必要あり
  → Worktree なしでは物理的に不可能

単一実行:
  1つのブランチのみ
  → 通常のチェックアウトで十分
```

### ディレクトリ構成

```
project/
├── .git/                    # 共有
├── (メイン作業ディレクトリ)
│
└── .worktrees/              # 並列実行時
    ├── task-1/
    │   └── (task-1 ブランチの内容)
    ├── task-2/
    │   └── (task-2 ブランチの内容)
    └── task-3/
        └── (task-3 ブランチの内容)
```

### 設定

```yaml
# .agentmine/config.yaml
execution:
  parallel:
    enabled: true
    maxWorkers: 3
    worktree:
      path: .worktrees/  # Worktree の配置場所
      cleanup: true      # 完了後に自動削除
```

## CLI

```bash
# ブランチ作成（通常は Orchestrator が自動実行）
agentmine task start 42
  → task-42 ブランチ作成、チェックアウト

# タスク完了（PR作成）
agentmine task done 42
  → push、PR作成、タスク更新

# コンフリクト解消後の再開
agentmine task resume 42
  → blocked → open に戻し、再実行
```

## References

- [Agent Execution](./agent-execution.md)
- [Memory Bank](./memory-bank.md)
- [Parallel Execution](./parallel-execution.md)
