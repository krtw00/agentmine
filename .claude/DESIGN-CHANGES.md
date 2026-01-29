# 設計変更サマリー（Codexとの協議による更新）

このドキュメントは、Codexとの設計協議で行われた主要な変更点を記録します。

**関連ドキュメント:**
- @.claude/REVIEW-FINDINGS.md - **Codexによる詳細レビュー結果（矛盾点40項目）**

## 主要な設計変更

### 1. DBマスター方式への移行

**変更前:**
- Agent定義: YAMLファイル（`.agentmine/agents/`）
- Memory Bank: Markdownファイル（`.agentmine/memory/`）
- 設定: YAMLファイル（`.agentmine/config.yaml`）

**変更後:**
- **すべてのデータをDBで管理**（`agents`, `memories`, `settings`テーブル）
- ファイルはスナップショット/エクスポート用のみ
- `.agentmine/` はデフォルトで`.gitignore`（リポジトリには含めない）
- Worker起動時にDBからスナップショットを生成

**理由:**
- チーム間でリアルタイム共有（Redmine的運用）
- Web UIでの編集が自然
- バージョン管理（履歴テーブルで追跡）
- 検索・フィルタリングが効率的

### 2. Orchestrator/Workerモデル

**変更前:**
- agentmineが並列実行を計画・管理

**変更後:**
- **Orchestrator（AIクライアント）**: 計画・判断を担当
- **Worker（隔離されたAI）**: worktreeで作業
- **agentmine**: 実行基盤・記録・提供のみ担当
- **Workerはagentmineにアクセスしない**（重要）

**理由:**
- AIに計画・判断を委ねる（AI as Orchestrator）
- agentmineはツール・実行基盤に徹する
- 柔軟な並列実行戦略が可能

### 3. worker runコマンド

**新規機能:**
```bash
agentmine worker run <taskId> [--exec] [--detach]
```

**動作:**
1. タスク情報取得
2. セッション開始（DBに記録、ID確定）
3. ブランチ作成（`task-<id>-s<sessionId>`）
4. Git worktree作成（`.agentmine/worktrees/task-<id>/`）
5. スコープ適用（sparse-checkout + chmod）
6. DBからMemory Bankを取得 → worktreeに`.agentmine/memory/`として出力
7. プロンプト生成（promptContent + Memory Bank要約 + 参照情報 + タスク）
8. Worker AI起動
   - `--exec`: フォアグラウンド実行
   - `--exec --detach`: バックグラウンド実行

**対応AIクライアント:**
- claude-code: `--dangerously-skip-permissions`
- codex: `--full-auto`
- aider: `--yes`
- gemini: `-y`

### 4. スコープ制御

**優先順位:**
```
exclude → read → write
```

**実装:**
| フィールド | 説明 | 物理的実装 |
|-----------|------|-----------|
| `exclude` | アクセス不可 | sparse-checkoutで除外（存在しない） |
| `read` | 参照可能 | worktreeに存在 |
| `write` | 編集可能 | 明示的に指定されたファイルのみ |
| （暗黙） | read - write - exclude | read-only化（chmod a-w） |

**事後チェック:**
- agentmineがWorker完了時に`git diff`でスコープ違反を検出
- 変更ファイル一覧を`artifacts`として記録

### 5. Memory Bank

**DBへの移行:**
- `memories`テーブルに保存（id（slug）, category, title, summary, content, status）
- `memory_history`テーブルでバージョン管理

**Worker用スナップショット:**
- Worker起動時にDBから取得
- worktreeに`.agentmine/memory/`として出力（read-only）
- カテゴリごとにディレクトリ分け（例: `architecture/`, `tooling/`）

**コンテキスト注入:**
```markdown
## Memory Bank Summary
- ルール: ...
- 規約: ...
- アーキテクチャ: ...

## Project Context (Memory Bank)
The following project context files are available:
- .agentmine/memory/architecture/database-selection.md - データベース選定
- .agentmine/memory/tooling/test-framework.md - テストフレームワーク

Read these files in .agentmine/memory/ for details.

## タスク
**ログイン機能を実装**
...
```

### 6. promptContent の注入

**フロー:**
1. agentmineがDBから`agents.promptContent`を取得
2. Memory Bank要約 + 参照情報を生成
3. promptContent + Memory Bank Summary + 参照情報 + タスク を結合
4. クライアント固有のコンテキストファイルに出力（例: `.claude/CLAUDE.md`）
5. AIクライアント起動時に自動読み込み

**対応クライアント（暫定）:**
| client | config dir | context file |
|--------|------------|--------------|
| claude-code | `.claude/` | `CLAUDE.md` |
| codex | (TBD) | (TBD) |
| aider | (TBD) | (TBD) |
| gemini | (TBD) | (TBD) |

### 7. セッション記録

**1 task = N sessions:**
- 並列実験対応（`session_group_id`でグルーピング）
- 比較結果の選択（`tasks.selected_session_id`）

**記録範囲:**
```
Orchestratorが観測可能な範囲のみ:
- セッション開始/終了
- 実行時間
- 成果物（変更ファイル一覧）
- 結果（exit code, signal, dod_result）

Worker内部はブラックボックス:
- トークン使用量: 測定不可
- ツール呼び出し: 測定不可
```

### 8. 並列実行

**Orchestratorの責務:**
1. 並列実行の計画
2. `agentmine worker run --exec --detach`の実行
3. 進捗監視（`worker status` / `wait`）
4. DoD検証（lint, test, build）
5. マージ判断・実行
6. PR作成

**agentmineの責務:**
- worktree作成/削除
- スコープ適用
- Worker起動/プロンプト生成
- セッション記録
- Memory Bank提供

**マージ判断:**
- agentmineはマージしない
- Orchestratorが結果を見て判断
- マージ成功 → タスクは自動的に`done`判定（Git判定）

### 9. 設計原則の統合

**7原則 → 6原則:**
1. **Single Source of Truth (DBマスター)**: すべてのデータ（タスク、Agent、Memory、設定）はDBで管理
2. **Collaborative by Design (Redmine的運用)**: チーム全員が同じDBを参照、リアルタイム協業
3. **AI as Orchestrator**: 計画・判断はAI、agentmineは実行基盤・記録・提供のみ担当
4. **Isolation & Safety**: Worker隔離（worktree） + スコープ制御（sparse-checkout + chmod）
5. **Observable & Deterministic**: ステータスはexit code, merge状態等の客観事実で判定
6. **Fail Fast**: エラーは即座に失敗させ、リカバリーは上位層（Orchestrator）の責務

## 矛盾点・修正が必要な箇所

### 1. memory-bank.md の記述ミス

**問題:**
- memory-bank.md:98-100 で `.agentmine-worker/` と記載

**正しい記述:**
- Worker起動時のスナップショット出力先: `.agentmine/memory/`
- worktree構造: `.agentmine/worktrees/task-<id>/.agentmine/memory/`

**修正箇所:**
- `docs/features/memory-bank.md` 行98-100

### 2. architecture.md のworktree構造説明

**問題:**
- architecture.md:72-76 で `.agentmine/agents/`, `.agentmine/prompts/` が記載されている
- これは本体のディレクトリ構造であり、worktree内の構造ではない

**明確化が必要:**
- 本体の `.agentmine/` ディレクトリ構造
- worktree内の `.agentmine/` ディレクトリ構造（memoryのみ）

### 3. baseBranch の設定場所

**確認結果:**
- `settings` テーブルで管理（key: 'git.baseBranch'）
- 必須設定項目

**ドキュメント:**
- parallel-execution.md で「settings で必須指定」と記載済み
- 具体的な設定方法のドキュメントが必要（CLI/Web UI）

## 実装ステータス

以下は設計が決まっているが、実装はこれからの機能：

- [ ] DBスキーマ実装（agents, memories, settings, agent_history, memory_history）
- [ ] AgentService（DB読み書き）
- [ ] MemoryService（DB読み書き + スナップショット生成）
- [ ] worker run コマンド（worktree作成 + scope適用 + prompt生成 + Worker起動）
- [ ] worker done コマンド（セッション終了 + クリーンアップ）
- [ ] worker status/wait コマンド
- [ ] Memory Bank要約生成ロジック
- [ ] promptContent注入ロジック
- [ ] スコープ事後チェックロジック
- [ ] Git判定によるタスクステータス更新

## 参考ドキュメント

- @docs/architecture.md - システムアーキテクチャと設計原則
- @docs/data-model.md - DBスキーマとデータフロー
- @docs/features/agent-system.md - Agent定義とDBへの移行
- @docs/features/agent-execution.md - Worker実行フロー
- @docs/features/memory-bank.md - Memory BankのDB管理
- @docs/features/worktree-scope.md - スコープ制御の実装
- @docs/features/parallel-execution.md - Orchestrator/Workerモデル
- @docs/features/session-log.md - セッション記録
