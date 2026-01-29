# Review Findings

## 1. 用語の不統一（表記揺れ）
- AIクライアント名が `gemini` と `gemini-cli` で混在しており、設定値・enum・MCP入力の一致が取れない（docs/architecture.md:112, docs/data-model.md:168, docs/features/agent-system.md:359, docs/features/worktree-scope.md:129, docs/features/mcp-integration.md:247）。
- Claude Codeの実行バイナリ名が `claude` と `claude-code` で混在し、コマンド例が不一致（docs/cli-design.md:421, docs/architecture.md:113, docs/features/agent-execution.md:523）。
- `task get` と `task show` が併記され、どちらが正式コマンドか不明（docs/cli-design.md:90, docs/cli-design.md:262, docs/features/mcp-integration.md:628, docs/implementation-plan.md:215）。

## 2. データフロー・責務分担の矛盾
- 「AI as Orchestrator」方針に対し、Web UIがWorker起動・停止を人間操作の中心機能としているため、責務の前提が食い違う（docs/architecture.md:20, docs/architecture.md:29, docs/features/web-ui.md:1393, docs/features/web-ui.md:1402）。
- worktreeへの出力範囲が「Memory Bankのみ（Agent/Promptは出力しない）」と明記される一方、promptContentを `.claude/CLAUDE.md` に出力する手順が書かれている（docs/architecture.md:300, docs/features/agent-system.md:234, docs/features/worktree-scope.md:125）。
- 成果物（artifacts）の収集責務が、agentmineの自動収集とOrchestratorの手動指定で食い違う（docs/features/session-log.md:103, docs/features/agent-execution.md:480）。
- Fail Fastの原則でリカバリーはOrchestrator責務としつつ、agentmine側で自動リキューを行うロジックが記載されている（docs/architecture.md:31, docs/features/error-handling.md:184）。
- Web UIのWorker起動APIは事前にworktree作成/スコープ適用を行った後、`agentmine worker run` を呼び出す設計になっており、worktree作成が二重化する（docs/features/web-ui.md:1642, docs/architecture.md:100）。

## 3. コマンド例とドキュメント記載の不一致
- `agent create/update/delete/history/rollback/import/export` がAgent Systemで前提だが、CLI設計は `agent list/show` のみ（docs/features/agent-system.md:420, docs/cli-design.md:96）。
- `agentmine errors` や `task retry` が記載されているが、CLI設計では `errors` コマンドを削除している（docs/features/error-handling.md:277, docs/cli-design.md:126）。
- `agentmine user` / `agentmine auth key` の認証系コマンドが追加されているが、CLI設計に存在しない（docs/features/authentication.md:191, docs/cli-design.md:90）。
- `worker command` がImplementation PlanとMCPで前提になっているが、CLI設計にサブコマンドが存在しない（docs/implementation-plan.md:230, docs/features/mcp-integration.md:230, docs/cli-design.md:99）。
- `db migrate:generate` / `db migrate:rollback` / `db import` / `agentmine export` がデータモデルで前提だが、CLI設計では `db migrate/reset` のみ（docs/data-model.md:592, docs/cli-design.md:118）。
- `memory export/import` がMemory Bankで前提だが、CLI設計の `memory` サブコマンドにない（docs/features/memory-bank.md:175, docs/cli-design.md:112）。

## 4. 設計原則との齟齬
- 「Single Source of Truth = DB」方針に対し、Web UI APIがMemoryをファイルパスで読み書きする設計になっている（docs/architecture.md:27, docs/features/memory-bank.md:20, docs/features/web-ui.md:1518）。
- タスクのステータスは観測可能な事実で自動判定としつつ、Web UIのUpdate APIに `status` 更新フィールドが含まれる（docs/cli-design.md:303, docs/features/web-ui.md:1553）。

## 5. ドキュメント間での説明の食い違い
- DB戦略: 「PostgreSQLのみサポート」vs「SQLite + PostgreSQLデュアル戦略」（docs/adr/mysql-vs-postgresql-comparison.md:18, docs/adr/002-sqlite-default.md:28, docs/architecture.md:267）。
- baseBranchの既定値/例が `develop` と `main` で分裂（docs/cli-design.md:161, docs/features/web-ui.md:396, docs/features/worktree-scope.md:91, docs/features/parallel-execution.md:212）。
- DB URL例が `file:./data.db` と `file:.agentmine/data.db` で不一致（docs/features/web-ui.md:392, docs/cli-design.md:901, docs/adr/002-sqlite-default.md:33）。
- MCPのエラーコード割り当てで exit code 5 が「リソース不存在」と「Git操作エラー」の両方に使われており、CLI設計のexit code表と不整合（docs/features/mcp-integration.md:756, docs/cli-design.md:883）。

## 6. 実装に必要だが未定義の項目
- 認証系テーブル（users/api_keys/web_sessions/project_members）が設計済みだが、データモデル側に未定義（docs/features/authentication.md:52, docs/data-model.md:31）。
- `task_errors` テーブルや `task.attemptCount` がエラーハンドリングで前提だが、タスクスキーマに該当項目がない（docs/features/error-handling.md:206, docs/data-model.md:100）。
- Workerの `pid` / `progress` / `activity` がCLI/Web UIで前提だが、sessionsスキーマに対応フィールドがなく取得元も未定義（docs/cli-design.md:621, docs/features/web-ui.md:1581, docs/data-model.md:350）。
- AIクライアントごとのコンテキストファイル配置が `claude-code` 以外はTBDで、対応クライアントに対する実装詳細が欠落（docs/features/worktree-scope.md:125, docs/architecture.md:112）。
- Web UIの `dryRun` や自動承認オプション、MCPの `auto` フラグの扱いがCLIオプション/設定スキーマに定義されていない（docs/features/web-ui.md:1425, docs/features/web-ui.md:1569, docs/features/mcp-integration.md:252）。
- `complexity` フィールドはスキーマとUIに登場するが、CLI/APIで入力・更新する仕様が未定義（docs/data-model.md:141, docs/features/web-ui.md:170, docs/features/web-ui.md:1533）。
