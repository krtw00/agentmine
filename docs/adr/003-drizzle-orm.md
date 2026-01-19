# ADR-003: Drizzle ORM

## Status

**Accepted** - 2025-01

## Context

TypeScriptからデータベースにアクセスするためのORMまたはクエリビルダーを選定する必要がある。

### 要件

1. **SQLite/PostgreSQL両対応**: ADR-002で決定したデュアルDB戦略をサポート
2. **型安全**: TypeScriptの型システムと統合
3. **軽量**: CLIツールとして起動が速いこと
4. **マイグレーション**: スキーマ変更を管理

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **Drizzle** | 型安全、軽量、SQL-like、両DB対応 | 比較的新しい |
| **Prisma** | 人気、エコシステム、スキーマ定義が宣言的 | 重い、バイナリ依存 |
| **TypeORM** | 機能豊富、デコレータベース | 重い、設定複雑 |
| **Kysely** | 型安全、軽量 | マイグレーション別途 |
| **Better-sqlite3 + SQL** | 最軽量、直接制御 | 型安全でない |

## Decision

**Drizzle ORM** を採用する。

```typescript
// packages/core/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status', { enum: ['open', 'in_progress', 'done'] }),
  // ...
});
```

## Rationale

### 1. 型安全性

Drizzleはスキーマ定義から型を自動推論：

```typescript
// 型が自動生成される
type Task = typeof tasks.$inferSelect;
type NewTask = typeof tasks.$inferInsert;

// クエリも型安全
const openTasks = await db
  .select()
  .from(tasks)
  .where(eq(tasks.status, 'open')); // tasks.status: 'open' | 'in_progress' | 'done'
```

### 2. SQLiteとPostgreSQLの両対応

```typescript
// SQLite
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('data.db');
const db = drizzle(sqlite);

// PostgreSQL
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
```

スキーマ定義は若干異なるが、クエリAPIは共通。

### 3. 軽量性

| ORM | node_modules size | Cold start |
|-----|-------------------|------------|
| Drizzle | ~2MB | ~50ms |
| Prisma | ~15MB | ~200ms |
| TypeORM | ~8MB | ~150ms |

CLIツールとして起動速度は重要。

### 4. SQL-likeなAPI

```typescript
// Drizzle - SQLに近い
await db
  .select({ 
    id: tasks.id, 
    title: tasks.title 
  })
  .from(tasks)
  .where(and(
    eq(tasks.status, 'open'),
    gt(tasks.priority, 5)
  ))
  .orderBy(desc(tasks.createdAt))
  .limit(10);

// 生成されるSQL
// SELECT id, title FROM tasks 
// WHERE status = 'open' AND priority > 5 
// ORDER BY created_at DESC LIMIT 10
```

学習コストが低く、SQLを知っていれば直感的。

### 5. Prismaを採用しなかった理由

Prismaも有力候補だったが：

- **バイナリエンジン**: Rust製バイナリが必要で、配布が複雑
- **起動時間**: クエリエンジンの初期化が遅い
- **サイズ**: node_modulesが大きい

agentmineはCLIツールなので、軽量性を重視してDrizzleを選択。

## Consequences

### Positive

- 型安全なデータベースアクセス
- 軽量で起動が速い
- SQLを知っていれば学習コストが低い
- SQLite/PostgreSQL両対応

### Negative

- Prismaほどのエコシステムがない
- ドキュメントがまだ発展途上
- 一部の高度な機能（リレーション等）はPrismaより複雑

### Risks

- 比較的新しいライブラリなので、破壊的変更の可能性
- コミュニティがPrismaより小さい

## Migration Strategy

### スキーマ管理

```bash
# マイグレーション生成
npx drizzle-kit generate:sqlite

# マイグレーション適用
npx drizzle-kit push:sqlite

# スキーマ確認
npx drizzle-kit studio
```

### マイグレーションファイル

```
packages/core/
└── drizzle/
    ├── 0000_initial.sql
    ├── 0001_add_sessions.sql
    └── meta/
        └── _journal.json
```

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle vs Prisma](https://orm.drizzle.team/docs/prisma)
- [Drizzle Kit (Migrations)](https://orm.drizzle.team/kit-docs/overview)
