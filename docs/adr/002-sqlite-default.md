# ADR-002: Database Strategy (SQLite + PostgreSQL)

## Status

**Accepted** - 2025-01 (Updated: PostgreSQL確定)

## Context

agentmineはプロジェクト管理データ（タスク、セッション、エージェント定義等）を永続化する必要がある。

### 使用シナリオ

1. **個人開発者**: ローカルでAIエージェントを使って開発
2. **スタートアップ〜企業**: チームでプロジェクトを共有

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **SQLite** | ゼロ設定、ファイルベース | 同時書き込みに弱い |
| **PostgreSQL** | 機能豊富、AI/ベクトル検索対応 | サーバー必要 |
| **MySQL** | 広く採用、運用経験者多い | AI機能が未成熟 |

詳細比較: [MySQL vs PostgreSQL 詳細比較](./mysql-vs-postgresql-comparison.md)

## Decision

**SQLiteをローカル開発用デフォルト、PostgreSQLを本番環境用**とする。

```yaml
# .agentmine/config.yaml

# ローカル開発（デフォルト）
database:
  url: file:.agentmine/data.db

# 本番環境
database:
  url: postgres://user:pass@host:5432/agentmine
```

**MySQLは対応しない。**

## Rationale

### 1. SQLiteをデフォルトにした理由

- **ゼロ設定**: `agentmine init`だけで即座に使える
- **ポータブル**: `.agentmine/data.db`をコピーするだけでバックアップ
- **十分な性能**: 個人〜数人の利用なら問題なし

### 2. PostgreSQLを本番DBとして確定した理由

#### AI機能との親和性（決定的要因）

| 機能 | PostgreSQL | MySQL |
|------|------------|-------|
| ベクトル検索 | ◎ pgvector（成熟、2019年〜） | △ 2025年2月GA（新しい） |
| クラウドサポート | ◎ 全主要クラウド | △ Google Cloud SQLのみ |
| AI統合実績 | ◎ 多数（Supabase, Neon等） | △ 少ない |

agentmineの将来機能でベクトル検索が必要：

- **Memory Bankのセマンティック検索**: 過去セッションの類似検索
- **タスク類似検索**: 「似たタスクを探す」
- **スキル推薦**: コンテキストに合ったスキル提案

```sql
-- pgvectorによるセマンティック検索
SELECT * FROM memory_entries
ORDER BY embedding <-> $query_embedding
LIMIT 10;
```

#### 技術的優位性

| 観点 | PostgreSQL | MySQL |
|------|------------|-------|
| JSON型 | ◎ JSONB（インデックス可） | ○ JSON |
| 標準SQL準拠 | ◎ 高い | △ 独自拡張多い |
| 拡張性 | ◎ PostGIS, pgvector等 | △ 限定的 |
| 複雑クエリ | ◎ 優秀 | ○ 良好 |

#### ライセンス・ベンダーリスク

- **PostgreSQL**: BSD-like、ベンダーロックインなし
- **MySQL**: Oracle所有、Enterprise版への誘導懸念

#### 開発者トレンド

- Stack Overflow 2024-2025: PostgreSQLがMySQLを逆転し1位
- 新規プロジェクトの多くがPostgreSQLを選択

### 3. MySQLを対応しない理由

- AI機能（ベクトル検索）のサポートが未成熟
- 2つのRDBMS対応はメンテナンスコストが高い
- PostgreSQLで企業ニーズも十分カバー可能

既存MySQL環境の企業には、PostgreSQLへの移行またはハイブリッド構成を推奨。

## Consequences

### Positive

- 単一RDBMSでメンテナンスコスト削減
- AI機能（pgvector）をネイティブに活用可能
- モダンなエコシステム（Supabase, Neon等）との親和性

### Negative

- 既存MySQL環境の企業は移行が必要
- MySQLのみ運用経験のあるDBAには学習コスト

### Migration Path

```bash
# SQLite → PostgreSQL移行
agentmine db export --format sql > backup.sql
# config.yamlのdatabase.urlを変更
agentmine db migrate
agentmine db import --file backup.sql
```

## Future Considerations

### pgvector統合

```sql
-- Memory Bankのベクトル検索
CREATE TABLE memory_entries (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  content TEXT,
  embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON memory_entries 
USING hnsw (embedding vector_cosine_ops);
```

### Supabase統合（将来）

```yaml
database:
  provider: supabase
  url: https://xxx.supabase.co
  key: ${SUPABASE_KEY}
```

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Timescale: PostgreSQL as Vector Database](https://www.timescale.com/blog/postgresql-as-a-vector-database-create-store-and-query-openai-embeddings-with-pgvector)
- [MySQL vs PostgreSQL 詳細比較](./mysql-vs-postgresql-comparison.md)
- [SQLite When To Use](https://www.sqlite.org/whentouse.html)
