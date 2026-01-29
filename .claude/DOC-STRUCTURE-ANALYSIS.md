# ドキュメント構造分析と提案

## 現在の構造

```
docs/
├── README.md                        # インデックス
├── architecture.md                  # システム全体概要（164行）
├── data-model.md                    # DBスキーマ定義（637行）
├── cli-design.md                    # CLIコマンド仕様（910行）
├── implementation-plan.md           # 実装計画
├── adr/                            # Architecture Decision Records
│   ├── 001-typescript-monorepo.md
│   ├── 002-sqlite-default.md
│   ├── 003-drizzle-orm.md
│   └── mysql-vs-postgresql-comparison.md
└── features/                       # 機能別詳細設計
    ├── agent-execution.md          # Worker実行フロー（570行）
    ├── agent-system.md             # Agent定義（510行）
    ├── authentication.md           # 認証
    ├── error-handling.md           # エラーハンドリング
    ├── git-integration.md          # Git操作
    ├── memory-bank.md              # Memory Bank（290行）
    ├── mcp-integration.md          # MCP連携
    ├── parallel-execution.md       # 並列実行（398行）
    ├── session-log.md              # セッション記録
    ├── web-ui.md                   # Web UI（1665行）
    └── worktree-scope.md           # スコープ制御（346行）
```

## 現在の問題点

### 1. 情報の重複・散在

**例1: worker runの動作説明**
- `architecture.md` 行100-110: 基本フロー
- `cli-design.md` 行450-550: コマンド詳細
- `agent-execution.md` 行100-400: 詳細フロー
- `parallel-execution.md` 行90-130: 並列実行時の動作
- `worktree-scope.md` 行84-125: worktree作成の実装
- `CLAUDE.md` 行119-124: 簡易版フロー

→ **6箇所に同じ情報が分散**。更新時に漏れが発生

**例2: Memory Bank注入**
- `memory-bank.md` 行100-148: 注入タイミング・内容
- `agent-system.md` 行232-250: Worker起動時の展開
- `agent-execution.md` 行220-260: プロンプト生成
- `worktree-scope.md` 行125-135: promptContent出力

→ **4箇所に類似情報**

**例3: スコープ制御**
- `worktree-scope.md`: 詳細実装
- `parallel-execution.md` 行130-185: スコープ定義
- `architecture.md` 行105-107: 簡易説明
- `agent-system.md` 行140-170: Agent定義でのscope

### 2. ドキュメント粒度の不統一

| ドキュメント | 行数 | 粒度 | 問題 |
|-------------|------|------|------|
| `architecture.md` | 164 | 概要 | 詳細が不足 |
| `cli-design.md` | 910 | 詳細仕様 | 巨大すぎ |
| `web-ui.md` | 1665 | 詳細仕様 | 巨大すぎ |
| `agent-execution.md` | 570 | 詳細フロー | 長すぎ |
| `data-model.md` | 637 | DBスキーマ | 適切 |

### 3. 責務の曖昧さ

- `agent-execution.md` と `parallel-execution.md` の境界が不明確
- `agent-system.md` は定義だけか実行も含むか不明
- `worktree-scope.md` は実装詳細か設計か不明

### 4. 参照関係の複雑さ

現在の相互参照：
```
architecture.md → 全ドキュメント
agent-execution.md ⇄ agent-system.md ⇄ memory-bank.md ⇄ worktree-scope.md
                   ⇄ parallel-execution.md ⇄ session-log.md
```

→ 循環参照が多く、どこから読むべきか不明確

## ベストプラクティスに基づく提案

### A. C4モデル + arc42の融合

```
docs/
├── 00-INDEX.md                     # 読む順序・ナビゲーション
│
├── 01-introduction/                # 導入（C4: Context層）
│   ├── overview.md                 # プロジェクト概要
│   ├── goals.md                    # 目標・制約
│   └── stakeholders.md             # ステークホルダー
│
├── 02-architecture/                # アーキテクチャ（C4: Container層）
│   ├── overview.md                 # システム構成図
│   ├── design-principles.md        # 6つの設計原則（SSOT）
│   ├── data-flow.md                # データフロー
│   └── components.md               # パッケージ構成
│
├── 03-core-concepts/               # コア概念（独自）
│   ├── orchestrator-worker.md     # Orchestrator/Workerモデル
│   ├── db-master.md                # DBマスター方式
│   ├── scope-control.md            # スコープ制御の仕組み
│   ├── observable-facts.md         # Observable & Deterministic
│   └── session-model.md            # 1 task = N sessions
│
├── 04-data/                        # データ（独自）
│   ├── overview.md                 # DB戦略（PostgreSQL+SQLite）
│   ├── schema.md                   # テーブル定義（ER図含む）
│   ├── migrations.md               # マイグレーション
│   └── export-import.md            # エクスポート/インポート
│
├── 05-features/                    # 機能（C4: Component層）
│   ├── task-management.md          # タスク管理
│   ├── agent-definition.md         # Agent定義
│   ├── memory-bank.md              # Memory Bank
│   ├── worker-execution.md         # Worker実行（統合）
│   ├── authentication.md           # 認証
│   └── error-handling.md           # エラーハンドリング
│
├── 06-interfaces/                  # インターフェース（独自）
│   ├── cli/
│   │   ├── overview.md             # CLI概要
│   │   ├── commands.md             # コマンド一覧（簡潔）
│   │   └── reference.md            # コマンドリファレンス（詳細）
│   ├── mcp/
│   │   ├── overview.md             # MCP概要
│   │   └── tools.md                # Tool一覧
│   └── web/
│       ├── overview.md             # Web UI概要
│       ├── pages.md                # 画面一覧
│       └── api.md                  # API Routes
│
├── 07-runtime/                     # ランタイム（arc42: Runtime View）
│   ├── worker-lifecycle.md         # Worker起動から終了まで（統合）
│   ├── parallel-execution.md       # 並列実行フロー
│   └── merge-flow.md               # マージフロー
│
├── 08-deployment/                  # 配置（arc42: Deployment View）
│   ├── installation.md             # インストール
│   ├── configuration.md            # 設定
│   └── production.md               # 本番環境
│
├── 09-development/                 # 開発者向け
│   ├── getting-started.md          # 開発環境セットアップ
│   ├── contributing.md             # コントリビューション
│   ├── testing.md                  # テスト戦略
│   └── implementation-notes.md     # 実装メモ
│
├── 10-decisions/                   # ADR（変更なし）
│   ├── 001-typescript-monorepo.md
│   ├── 002-sqlite-default.md
│   ├── 003-drizzle-orm.md
│   └── mysql-vs-postgresql-comparison.md
│
└── appendix/                       # 付録
    ├── glossary.md                 # 用語集
    ├── faq.md                      # FAQ
    └── troubleshooting.md          # トラブルシューティング
```

### B. 情報の階層化（DRY原則）

**原則: 情報は1箇所にのみ記載し、他は参照する**

#### Worker実行の例

**Before（6箇所に分散）:**
- architecture.md: 基本フロー
- cli-design.md: コマンド詳細
- agent-execution.md: 詳細フロー
- parallel-execution.md: 並列実行
- worktree-scope.md: worktree作成
- CLAUDE.md: 簡易版

**After（SSOT）:**
```
07-runtime/worker-lifecycle.md      # 詳細フロー（SSOT）
  ├── 1. worktree作成
  ├── 2. スコープ適用
  ├── 3. Memory Bank展開
  ├── 4. promptContent生成
  ├── 5. Worker起動
  └── 6. 終了処理

02-architecture/overview.md         # 簡易図のみ + 参照
06-interfaces/cli/commands.md       # コマンド構文のみ + 参照
07-runtime/parallel-execution.md    # 並列実行の差分のみ + 参照
```

### C. ドキュメント分割基準

| レベル | 目的 | 行数目安 | 対象読者 |
|--------|------|----------|----------|
| Overview | 全体像把握 | 50-100 | 全員 |
| Concept | 概念理解 | 100-200 | 開発者・利用者 |
| Feature | 機能詳細 | 200-300 | 開発者 |
| Reference | 完全仕様 | 制限なし | 実装者 |

### D. ナビゲーション戦略

**00-INDEX.md の構成:**
```markdown
# agentmine ドキュメント

## はじめに読むべきドキュメント

初めての方:
1. @01-introduction/overview.md - プロジェクト概要
2. @02-architecture/overview.md - システム構成
3. @03-core-concepts/orchestrator-worker.md - 中核概念

開発を始める方:
1. @09-development/getting-started.md
2. @04-data/schema.md
3. @06-interfaces/cli/commands.md

## ロール別ガイド

### Orchestrator開発者
1. Worker実行: @07-runtime/worker-lifecycle.md
2. CLI: @06-interfaces/cli/reference.md
3. MCP: @06-interfaces/mcp/tools.md

### Web UI開発者
1. Web UI: @06-interfaces/web/overview.md
2. API: @06-interfaces/web/api.md
3. データ: @04-data/schema.md

### Worker実装者
1. Agent定義: @05-features/agent-definition.md
2. スコープ: @03-core-concepts/scope-control.md
3. Memory Bank: @05-features/memory-bank.md
```

## 実装ステップ

### Phase 1: 基盤整備
1. 新構造のディレクトリ作成
2. 00-INDEX.md作成
3. 用語集作成（glossary.md）

### Phase 2: コア概念の抽出
1. 設計原則を独立ドキュメント化
2. Orchestrator/Workerモデルを明確化
3. スコープ制御を独立ドキュメント化

### Phase 3: 情報の再構成
1. 重複情報の統合（worker lifecycle等）
2. 参照関係の整理
3. 各ドキュメントのリファクタリング

### Phase 4: インターフェース分離
1. CLI/MCP/Webを明確に分離
2. コマンドリファレンスの作成

### Phase 5: 検証
1. ナビゲーションテスト
2. 矛盾チェック
3. レビュー

## メリット

1. **明確な情報階層**: どこに何があるか一目瞭然
2. **DRY原則**: 情報の重複を排除、更新漏れ防止
3. **ロール別ガイド**: 読者に合わせた導線
4. **メンテナンス性**: 変更箇所が明確
5. **スケーラビリティ**: 機能追加時の配置場所が明確

## 課題・トレードオフ

1. **移行コスト**: 既存ドキュメントの大幅な再構成が必要
2. **学習コスト**: 新しい構造に慣れる必要
3. **参照の増加**: 詳細を見るために複数ドキュメントを跨ぐ可能性

## 代替案

### 案B: 最小限のリファクタリング

現在の構造を維持しつつ、最小限の変更：
- README.mdを充実させてナビゲーション強化
- 各ドキュメントの冒頭に「このドキュメントの位置づけ」を明記
- 重複部分に「詳細は@xxx参照」を追加

**メリット**: 低コスト
**デメリット**: 根本的な問題は解決しない

### 案C: モジュラーモノリス

機能単位で完全に独立：
```
docs/
├── task-management/
│   ├── overview.md
│   ├── data.md
│   ├── cli.md
│   └── api.md
├── agent-system/
│   ├── overview.md
│   ├── definition.md
│   ├── execution.md
│   └── scope.md
...
```

**メリット**: 機能追加時に独立
**デメリット**: 横断的な情報（設計原則等）の扱いが難しい
