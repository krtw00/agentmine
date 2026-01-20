# ADR-003: Drizzle ORM

## ステータス

**Accepted** - 2025-01

## コンテキスト

TypeScriptからデータベースにアクセスするためのORMまたはクエリビルダーを選定する必要がある。

### 要件

| 要件 | 説明 |
|------|------|
| SQLite/PostgreSQL両対応 | ADR-002で決定したデュアルDB戦略をサポート |
| 型安全 | TypeScriptの型システムと統合 |
| 軽量 | CLIツールとして起動が速いこと |
| マイグレーション | スキーマ変更を管理 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| Drizzle | 型安全、軽量、SQL-like、両DB対応 | 比較的新しい |
| Prisma | 人気、エコシステム、スキーマ定義が宣言的 | 重い、バイナリ依存 |
| TypeORM | 機能豊富、デコレータベース | 重い、設定複雑 |
| Kysely | 型安全、軽量 | マイグレーション別途 |
| Better-sqlite3 + SQL | 最軽量、直接制御 | 型安全でない |

## 決定

**Drizzle ORM** を採用する。

## 理由

### 1. 型安全性

Drizzleはスキーマ定義から型を自動推論。クエリも型安全。

| 機能 | 説明 |
|------|------|
| 型推論 | typeof tasks.$inferSelect で型が自動生成 |
| クエリ型安全 | tasks.statusは 'open' / 'in_progress' / 'done' のみ許可 |

### 2. SQLiteとPostgreSQLの両対応

スキーマ定義は若干異なるが、クエリAPIは共通。

| データベース | ドライバ |
|-------------|---------|
| SQLite | drizzle-orm/better-sqlite3 |
| PostgreSQL | drizzle-orm/node-postgres |

### 3. 軽量性

| ORM | node_modules size | Cold start |
|-----|-------------------|------------|
| Drizzle | ~2MB | ~50ms |
| Prisma | ~15MB | ~200ms |
| TypeORM | ~8MB | ~150ms |

CLIツールとして起動速度は重要。

### 4. SQL-likeなAPI

SQLに近い構文で学習コストが低い。SQLを知っていれば直感的。

### 5. Prismaを採用しなかった理由

Prismaも有力候補だったが：

| 観点 | 問題 |
|------|------|
| バイナリエンジン | Rust製バイナリが必要で、配布が複雑 |
| 起動時間 | クエリエンジンの初期化が遅い |
| サイズ | node_modulesが大きい |

AgentMineはCLIツールなので、軽量性を重視してDrizzleを選択。

## 結果

### ポジティブ

| 結果 | 説明 |
|------|------|
| 型安全 | 型安全なデータベースアクセス |
| 軽量 | 軽量で起動が速い |
| 学習コスト | SQLを知っていれば学習コストが低い |
| 両DB対応 | SQLite/PostgreSQL両対応 |

### ネガティブ

| 結果 | 説明 |
|------|------|
| エコシステム | Prismaほどのエコシステムがない |
| ドキュメント | ドキュメントがまだ発展途上 |
| 高度機能 | 一部の高度な機能（リレーション等）はPrismaより複雑 |

### リスク

| リスク | 説明 |
|--------|------|
| 破壊的変更 | 比較的新しいライブラリなので、破壊的変更の可能性 |
| コミュニティ | コミュニティがPrismaより小さい |

## マイグレーション戦略

### スキーマ管理

| コマンド | 説明 |
|---------|------|
| npx drizzle-kit generate:sqlite | マイグレーション生成 |
| npx drizzle-kit push:sqlite | マイグレーション適用 |
| npx drizzle-kit studio | スキーマ確認 |

### マイグレーションファイル配置

| パス | 説明 |
|------|------|
| packages/core/drizzle/0000_initial.sql | 初期マイグレーション |
| packages/core/drizzle/0001_add_sessions.sql | セッション追加 |
| packages/core/drizzle/meta/_journal.json | マイグレーション履歴 |

## 参考資料

- Drizzle ORM Documentation: https://orm.drizzle.team/
- Drizzle vs Prisma: https://orm.drizzle.team/docs/prisma
- Drizzle Kit (Migrations): https://orm.drizzle.team/kit-docs/overview
