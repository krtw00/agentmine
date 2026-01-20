# Git Integration

Git操作とPR連携の設計。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                      責務分担                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Worker:  コード作成、コミット（作業記録）                          │
│  agentmine: worktree作成/削除、ブランチ作成、スコープ適用           │
│  Orchestrator:     push、PR作成、タスク状態管理                     │
│                                                                     │
│  Workerは成果物の作成に集中                                         │
│  worktree作成はagentmine、Gitの対外操作はOrchestratorが担当         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Note:** worktree作成/削除はagentmineが行う。Orchestratorはpush/PR作成などの外部Git操作を担当する。

## ブランチ戦略

### 構成

```
main ──────────────────── 本番（人間のみマージ）
  │
develop ───────────────── 統合ブランチ（エージェントのPR先）
  │
  └─┬──┬──┬───────────── task-{id}-s{sessionId} ブランチ
    │  │  │
  task-1 task-2 task-3
```

### ルール

| ブランチ | 誰がマージ | PR先 |
|----------|-----------|------|
| main | 人間のみ | - |
| develop | 人間（PRレビュー後） | main |
| task-{id}-s{sessionId} | Orchestrator（検証後） | develop |

### 安全性

```
Workerが誤って main に push しても:
  → develop が緩衝帯となり本番に直接影響しない
  → develop → main は人間が判断

agentmine はWorkerのツールを制御できないため、
ブランチ構成で安全性を担保する
```

## タスク実行フロー

```
┌──────────────┐
│      Orchestrator      │
└──────┬───────┘
       │ 1. agentmine worker run でブランチ/ worktree作成
       │ 2. Worker起動（Task tool等）
       ▼
┌──────────────┐
│    Worker    │
│              │ 4. コード作成
│              │ 5. git add
│              │ 6. git commit（自由形式）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│      Orchestrator      │
│              │ 6. 完了検知（exit code + merge状態）
│              │ 7. コミットメッセージ整形（Memory Bank 規約）
│              │ 8. git push origin task-{id}
│              │ 9. gh pr create --base develop
│              │ 10. PRマージ → タスク done
└──────────────┘
```

## コミット規約

### Workerのコミット

Workerは自由形式でコミット。規約を知る必要はない。

```bash
# Workerのコミット例
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
# settings snapshot (import/export)
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

| 条件（観測可能な事実） | タスク状態 |
|------------------------|-----------|
| running セッションが1つ以上 | in_progress |
| マージ済みセッションが存在（dod_result=merged or ブランチがbaseにマージ） | done |
| runningなし、mergedなし、失敗/取消のみ | failed |
| 手動キャンセル | cancelled |

**Note:** `review`, `blocked` ステータスは存在しない。ステータスはobservable facts（exit code, merge状態）で判定。  
**Note:** PRクローズ自体はステータスを直接変更しない。マージされていなければdoneにならず、セッション状態に基づき in_progress/failed が決まる。

## コンフリクト対応

### 方針

```
コンフリクト検知 → セッションをfailed終了 → 人間に通知
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
  1. agentmine session end --exit-code 1 --error '{"type":"conflict",...}'
  2. 人間に通知
    ↓
人間:
  1. 手動でコンフリクト解消
  2. Orchestratorが新セッションで再実行
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
└── .agentmine/worktrees/              # 並列実行時
    ├── task-1/
    │   └── (task-1 ブランチの内容)
    ├── task-2/
    │   └── (task-2 ブランチの内容)
    └── task-3/
        └── (task-3 ブランチの内容)
```

### 設定

```yaml
# settings snapshot (import/export)
execution:
  parallel:
    enabled: true
    maxWorkers: 3
    worktree:
      path: .agentmine/worktrees/  # Worktree の配置場所
      cleanup: true      # 完了後に自動削除
```

## Orchestratorの操作

worktree作成/削除はagentmineが担当。Orchestratorはpush/PR作成などの外部Git操作を実行する。

```bash
# worktree作成（agentmineが内部でgitを使用）
agentmine worker run 42

# worktree削除
agentmine worker cleanup 42

# セッション管理（詳細記録が必要な場合）
agentmine session end 123 --exit-code 0 --dod-result merged
# ※ session start は worker run を使わない手動/外部Worker運用時のみ

# タスクステータスはobservable factsで自動判定
# 明示的なステータス更新は不要
```

**Note:** agentmineがworktreeを管理。push/PR作成などの外部Git操作はOrchestratorが担当。

## References

- [Agent Execution](./agent-execution.md)
- [Memory Bank](./memory-bank.md)
- [Parallel Execution](./parallel-execution.md)
