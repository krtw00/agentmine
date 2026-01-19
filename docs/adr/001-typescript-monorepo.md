# ADR-001: TypeScript Monorepo

## Status

**Accepted** - 2025-01

## Context

agentmineは以下の3つのコンポーネントで構成される：

1. **CLI** - AIエージェント向けコマンドラインインターフェース
2. **Web UI** - 人間向けダッシュボード
3. **Core** - 共有ビジネスロジック・データアクセス

これらをどの言語で、どのようなプロジェクト構成で開発するかを決定する必要があった。

### 検討した選択肢

#### 言語

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **TypeScript** | 型安全、Web UIと統一、npm エコシステム | CLIバイナリ配布が複雑 |
| **Go** | シングルバイナリ、高速、並行処理 | Web UIは別言語、型共有不可 |
| **Rust** | 高速、安全、シングルバイナリ | 学習コスト、Web UIは別言語 |
| **Python** | AI/MLエコシステム、簡潔 | 型が弱い、配布が複雑 |

#### プロジェクト構成

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **Monorepo** | 型共有、一括ビルド・テスト、依存関係管理 | 初期設定の複雑さ |
| **Polyrepo** | 独立したリリースサイクル | 型共有が困難、同期コスト |

## Decision

**TypeScript + pnpm Monorepo + Turborepo** を採用する。

```
agentmine/
├── packages/
│   ├── cli/      # TypeScript (Commander.js)
│   ├── web/      # Next.js
│   └── core/     # 共有ロジック
├── pnpm-workspace.yaml
└── turbo.json
```

## Rationale

### 1. TypeScriptを選んだ理由

- **型共有**: CLI/Web/Core間で同じ型定義を使用できる
- **Web UIとの親和性**: Next.jsをそのまま使える
- **エコシステム**: npm/pnpmの豊富なパッケージ
- **AIツールとの相性**: Claude Code等のAIエージェントがTypeScriptを得意とする

Goも有力候補だったが、Web UIとの型共有ができない点で除外。
実際、初期実装はGoで行ったが、TypeScript Monorepoに移行した。

### 2. Monorepoを選んだ理由

- **型の一貫性**: `@agentmine/core`の型をCLI/Webで直接import
- **アトミックな変更**: データモデル変更時にCLI/Web/Coreを同時に更新
- **開発効率**: `pnpm dev`で全パッケージを同時起動

### 3. pnpm + Turborepoを選んだ理由

- **pnpm**: 高速インストール、厳格な依存関係、ディスク効率
- **Turborepo**: ビルドキャッシュ、並列実行、タスク依存関係管理

## Consequences

### Positive

- CLI/Web間で型定義を共有でき、不整合が起きにくい
- 単一リポジトリでCI/CDが簡潔
- `pnpm dev`で開発環境を一発起動

### Negative

- CLIのバイナリ配布にはpkg/nexe等の追加ツールが必要
- Node.jsランタイムが必要（Goのようなシングルバイナリではない）
- モノレポの初期設定に時間がかかった

### Risks

- Node.jsのバージョン管理（nvmやvoltaで対応）
- パッケージ間の循環依存に注意が必要

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Monorepo vs Polyrepo](https://monorepo.tools/)
