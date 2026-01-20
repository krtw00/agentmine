# agentmine Roadmap

## Vision

**Safe Parallel AI Development Environment** - 複数AIを同時に、安全に、管理可能に

agentmineは、人間とAIが協業する並列開発環境として、DevHiveの機能を包含しつつ、セキュリティ・チーム協業・知識管理を強化します。

## Current Status (2026-01-20)

### ✅ 完了

- ドキュメント構造整備（arc42準拠）
- スコープ制御仕様（デフォルトreadable）
- DevHive統合計画策定

### 🚧 進行中

- Core実装（DB、Services、Models）
- CLI基本コマンド
- Web UI設計

### ⏳ 未着手

- MCP Server実装
- Memory Bank実装
- Worker監視機能

---

## Phase 0: Foundation（基盤）

**目標**: Core機能の実装

### Milestone 0.1: Database Layer

**Status**: 未着手

- [ ] Drizzle ORM セットアップ
- [ ] スキーマ定義（tasks, sessions, agents, memories, settings）
- [ ] SQLite/PostgreSQL対応
- [ ] マイグレーションシステム

**Expected**: 2026-01 末

### Milestone 0.2: Core Services

**Status**: 未着手

- [ ] TaskService（タスク管理）
- [ ] WorktreeService（worktree操作）
- [ ] SessionService（セッション記録）
- [ ] AgentService（Agent定義管理）
- [ ] MemoryService（Memory Bank）

**Expected**: 2026-02 中旬

---

## Phase 1: CLI（コマンドライン）

**目標**: 基本的なCLI操作の実装

### Milestone 1.1: Task Management

**Status**: 未着手

- [ ] `agentmine task add`
- [ ] `agentmine task list`
- [ ] `agentmine task show <id>`
- [ ] `agentmine task update <id>`

**Expected**: 2026-02 末

### Milestone 1.2: Worker Execution

**Status**: 未着手

- [ ] `agentmine worker run <id>`
- [ ] Git worktree作成
- [ ] スコープ適用（sparse-checkout + chmod）
- [ ] Worker AI起動（claude-code統合）
- [ ] セッション記録

**Expected**: 2026-03 中旬

### Milestone 1.3: Worker Management

**Status**: 未着手

- [ ] `agentmine worker status [id]`
- [ ] `agentmine worker stop <id>`
- [ ] `agentmine worker done <id>`
- [ ] `agentmine worker wait <id> [id...]`

**Expected**: 2026-03 末

---

## Phase 2: Web UI

**目標**: Web UIによる可視化

### Milestone 2.1: Task Dashboard

**Status**: 未着手

- [ ] タスク一覧表示
- [ ] タスク詳細表示
- [ ] タスク作成・編集
- [ ] Worker状態表示

**Expected**: 2026-04 中旬

### Milestone 2.2: Agent Management

**Status**: 未着手

- [ ] Agent定義一覧
- [ ] Agent作成・編集（YAML）
- [ ] スコープ設定UI
- [ ] プレビュー機能

**Expected**: 2026-04 末

### Milestone 2.3: Memory Bank UI

**Status**: 未着手

- [ ] Memory Bank一覧
- [ ] Memory作成・編集
- [ ] 差分表示
- [ ] 検索機能

**Expected**: 2026-05 中旬

---

## Phase 3: MCP Integration

**目標**: Cursor/Windsurf等との統合

### Milestone 3.1: MCP Server

**Status**: 未着手

- [ ] MCP Server実装
- [ ] Tools実装（task, worker, memory操作）
- [ ] Resources実装（タスク・Agent情報）
- [ ] Cursor設定例

**Expected**: 2026-05 末

### Milestone 3.2: IDE Integration

**Status**: 未着手

- [ ] Claude Code統合強化
- [ ] Cursor統合ドキュメント
- [ ] Windsurf統合ドキュメント

**Expected**: 2026-06 中旬

---

## Phase 4: DevHive Integration（TypeScript再実装）

**目標**: DevHive機能のTypeScript再実装・統合

**決定事項（2026-01-20）**: DevHiveはGo実装のため、agentmineにGoを混在させず、Phase 4でTypeScriptで再実装する。DevHiveは保守モードに移行し、Phase 4完了後に廃止。

### Milestone 4.1: Docker-style Commands

**Status**: 未着手

- [ ] `agentmine worker up` (devhive up相当)
- [ ] `agentmine worker down` (devhive down相当)
- [ ] `agentmine worker ps` (devhive ps相当)
- [ ] `agentmine worker logs` (devhive logs相当)

**Expected**: 2026-06 末

### Milestone 4.2: Worker Monitoring（Observable Facts）

**Status**: 設計中

- [ ] Git状態監視（進捗推測）
- [ ] セッションログ解析（問題検出）
- [ ] ヘルスチェック（停滞検出）
- [ ] `agentmine worker monitor <id>`
- [ ] `agentmine worker health`

**Expected**: 2026-07 中旬

### Milestone 4.3: Intervention System

**Status**: 未着手

- [ ] `agentmine worker pause <id>`
- [ ] `agentmine worker hint <id> "msg"`
- [ ] `agentmine worker restart <id>`
- [ ] 自動介入アラート

**Expected**: 2026-07 末

### Milestone 4.4: DevHive Migration Tool

**Status**: 未着手

- [ ] `agentmine migrate --from-devhive .devhive.yaml`
- [ ] `.devhive.yaml` → DB変換（tasks, agents）
- [ ] `.devhive/tasks/` → memories変換
- [ ] `.devhive/roles/` → agents変換
- [ ] Validation & Dry-run機能

**Expected**: 2026-07 末

---

## Phase 5: Advanced Features

**目標**: 高度な機能

### Milestone 5.1: PostgreSQL Support

**Status**: 未着手

- [ ] PostgreSQL接続設定
- [ ] チーム共有DB機能
- [ ] 認証・権限管理
- [ ] マルチテナント対応

**Expected**: 2026-08 中旬

### Milestone 5.2: Memory Bank Enhancement

**Status**: 未着手

- [ ] 自動要約機能
- [ ] カテゴリ分類
- [ ] 検索強化
- [ ] Memory推奨システム

**Expected**: 2026-08 末

### Milestone 5.3: Analytics & Insights

**Status**: 未着手

- [ ] Worker実行統計
- [ ] 生産性レポート
- [ ] ボトルネック検出
- [ ] コスト分析

**Expected**: 2026-09 中旬

---

## Future Considerations

### Potential Features

- **CI/CD統合**: GitHub Actions/GitLab CI連携
- **Slack/Discord通知**: Worker完了・エラー通知
- **Remote Worker**: クラウドVM上でWorker実行
- **Multi-Repository**: 複数リポジトリ横断管理
- **Template System**: タスク・Agentテンプレート
- **Plugin System**: カスタムツール・拡張

### Research Areas

- **AIモデル統合**: GPT-4, Gemini, Claude等の切り替え
- **Code Review自動化**: PR自動レビュー
- **Test自動生成**: Worker実装に対するテスト生成
- **Documentation生成**: コード変更からドキュメント更新

---

## Contributing

興味がある機能や優先度の提案は、GitHubのIssueまたはDiscussionで歓迎します。

## Related Documents

- @../00-INDEX.md - ドキュメント全体ナビゲーション
- @./overview.md - プロジェクト概要
- @./devhive-migration.md - DevHive統合計画
- @../09-development/implementation-plan.md - 実装計画詳細
