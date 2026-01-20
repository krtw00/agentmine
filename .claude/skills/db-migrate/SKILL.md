---
name: db-migrate
description: "DBマイグレーションを実行・管理する。スキーマ変更時、新テーブル追加時に使用。"
allowed-tools: Bash, Read, Write, Edit
model: sonnet
---

# DBマイグレーションスキル

## 概要

Drizzle ORMを使用してデータベースマイグレーションを管理します。

## マイグレーションフロー

### 1. スキーマ変更

```typescript
// packages/core/src/db/schema.ts
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  // 新しいカラムを追加
  newColumn: text('new_column'),
});
```

### 2. マイグレーション生成

```bash
cd packages/core
pnpm drizzle-kit generate
```

### 3. マイグレーション確認

生成されたSQLファイルを確認:

```bash
cat drizzle/*.sql
```

### 4. マイグレーション実行

```bash
pnpm drizzle-kit migrate
```

## 注意事項

- 本番環境ではバックアップを取ってから実行
- 破壊的変更（カラム削除等）は段階的に行う
- SQLiteとPostgreSQLの互換性を確認

## ロールバック

Drizzle Kitは自動ロールバックをサポートしていないため、手動で対応:

```sql
-- 例: カラム追加のロールバック
ALTER TABLE tasks DROP COLUMN new_column;
```

## 参照

- @docs/data-model.md
- packages/core/src/db/schema.ts
