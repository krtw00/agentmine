# ADR-001: TypeScript Monorepo

## ステータス

**Accepted** - 2025-01

## コンテキスト

AgentMineは以下の3つのコンポーネントで構成される：

| コンポーネント | 役割 |
|---------------|------|
| CLI | AIエージェント向けコマンドラインインターフェース |
| Web UI | 人間向けダッシュボード |
| Core | 共有ビジネスロジック・データアクセス |

これらをどの言語で、どのようなプロジェクト構成で開発するかを決定する必要があった。

## 検討した選択肢

### 言語

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| TypeScript | 型安全、Web UIと統一、npm エコシステム | CLIバイナリ配布が複雑 |
| Go | シングルバイナリ、高速、並行処理 | Web UIは別言語、型共有不可 |
| Rust | 高速、安全、シングルバイナリ | 学習コスト、Web UIは別言語 |
| Python | AI/MLエコシステム、簡潔 | 型が弱い、配布が複雑 |

### プロジェクト構成

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| Monorepo | 型共有、一括ビルド・テスト、依存関係管理 | 初期設定の複雑さ |
| Polyrepo | 独立したリリースサイクル | 型共有が困難、同期コスト |

## 決定

**TypeScript + pnpm Monorepo + Turborepo** を採用する。

### パッケージ構成

| パッケージ | 技術 | 役割 |
|-----------|------|------|
| packages/cli | TypeScript (Commander.js) | CLI |
| packages/web | Next.js | Web UI |
| packages/core | TypeScript | 共有ロジック |

## 理由

### 1. TypeScriptを選んだ理由

| 観点 | 説明 |
|------|------|
| 型共有 | CLI/Web/Core間で同じ型定義を使用できる |
| Web UIとの親和性 | Next.jsをそのまま使える |
| エコシステム | npm/pnpmの豊富なパッケージ |
| AIツールとの相性 | Claude Code等のAIエージェントがTypeScriptを得意とする |

Goも有力候補だったが、Web UIとの型共有ができない点で除外。実際、初期実装はGoで行ったが、TypeScript Monorepoに移行した。

### 2. Monorepoを選んだ理由

| 観点 | 説明 |
|------|------|
| 型の一貫性 | @agentmine/coreの型をCLI/Webで直接import |
| アトミックな変更 | データモデル変更時にCLI/Web/Coreを同時に更新 |
| 開発効率 | pnpm devで全パッケージを同時起動 |

### 3. pnpm + Turborepoを選んだ理由

| ツール | 選定理由 |
|--------|---------|
| pnpm | 高速インストール、厳格な依存関係、ディスク効率 |
| Turborepo | ビルドキャッシュ、並列実行、タスク依存関係管理 |

## 結果

### ポジティブ

| 結果 | 説明 |
|------|------|
| 型共有 | CLI/Web間で型定義を共有でき、不整合が起きにくい |
| CI/CD | 単一リポジトリでCI/CDが簡潔 |
| 開発体験 | pnpm devで開発環境を一発起動 |

### ネガティブ

| 結果 | 説明 |
|------|------|
| バイナリ配布 | CLIのバイナリ配布にはpkg/nexe等の追加ツールが必要 |
| ランタイム依存 | Node.jsランタイムが必要（Goのようなシングルバイナリではない） |
| 初期設定 | モノレポの初期設定に時間がかかった |

### リスク

| リスク | 対策 |
|--------|------|
| Node.jsバージョン管理 | nvmやvoltaで対応 |
| 循環依存 | パッケージ間の依存関係に注意 |

## 参考資料

- pnpm Workspaces: https://pnpm.io/workspaces
- Turborepo Documentation: https://turbo.build/repo/docs
- Monorepo vs Polyrepo: https://monorepo.tools/
