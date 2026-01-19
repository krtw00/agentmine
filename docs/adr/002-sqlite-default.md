# ADR-002: Database Strategy (SQLite Default, MySQL/PostgreSQL for Production)

## Status

**Accepted** - 2025-01 (Updated)

## Context

agentmineはプロジェクト管理データ（タスク、セッション、エージェント定義等）を永続化する必要がある。

### 使用シナリオ

1. **個人開発者**: ローカルでAIエージェントを使って開発
2. **スタートアップ**: 数人〜数十人でプロジェクトを共有
3. **企業**: 既存インフラ（MySQL/PostgreSQL）を活用、堅実な運用

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **SQLite** | ゼロ設定、ファイルベース、ポータブル | 同時書き込みに弱い |
| **PostgreSQL** | 機能豊富、JSONB、標準SQL準拠 | サーバー必要 |
| **MySQL** | 広く採用、運用経験者多い、読み取り高速 | Oracle懸念、機能やや劣る |
| **JSON/YAML** | シンプル、人間可読 | クエリ困難、競合問題 |

詳細比較: [MySQL vs PostgreSQL 詳細比較](./mysql-vs-postgresql-comparison.md)

## Decision

**SQLiteをデフォルト、MySQL/PostgreSQL両方を本番環境向けにサポート**する。

```yaml
# .agentmine/config.yaml

# ローカル開発（デフォルト）
database:
  url: file:.agentmine/data.db

# MySQL（企業の既存環境）
database:
  url: mysql://user:pass@host:3306/agentmine

# PostgreSQL（モダン環境）
database:
  url: postgres://user:pass@host:5432/agentmine
```

## Rationale

### 1. SQLiteをデフォルトにした理由

- **ゼロ設定**: `agentmine init`だけで即座に使える
- **ポータブル**: `.agentmine/data.db`をコピーするだけでバックアップ
- **十分な性能**: 個人〜数人の利用なら問題なし
- **類似ツールの先例**: TSK, TaskMaster AI等もSQLite採用

### 2. MySQL/PostgreSQL両対応にした理由

企業環境では既存インフラとの親和性が重要：

| シナリオ | 推奨 | 理由 |
|----------|------|------|
| 既存MySQL環境の企業 | MySQL | 既存DBAの知見活用、インフラ統一 |
| 新規構築・スタートアップ | PostgreSQL | 機能豊富、ライセンス安心 |
| Oracle離脱検討企業 | PostgreSQL | ベンダーロックイン回避 |
| 超大規模読み取りワークロード | MySQL | 実績あり |
| AI/ベクトル検索統合予定 | PostgreSQL | pgvector対応 |

### 3. MySQL vs PostgreSQLの判断をユーザーに委ねる理由

グローバル市場の現状：

- **市場シェア**: MySQL (40%) > PostgreSQL (18%)
- **開発者人気**: PostgreSQL (46%) > MySQL (41%) ※2025年逆転
- **Fortune 500**: 両方とも多数採用（Apple, Instagram → PostgreSQL / Meta, GitHub → MySQL）

どちらが「正解」とは言えない。ユーザーの状況に応じた選択を可能にする。

### 4. MariaDBについて

MySQLのフォークであるMariaDBも、MySQL互換として動作する想定。
Oracle懸念を避けたい場合のMySQLの代替として有効。

## Consequences

### Positive

- 初期セットアップが簡単（SQLite）
- 企業の既存インフラに適応可能（MySQL/PostgreSQL）
- ベンダーロックインを回避（選択肢を提供）

### Negative

- 3つのDBをサポートするテスト・メンテナンスコスト
- DB間の微妙な挙動差異への対応が必要
- Drizzle ORMのスキーマ定義がDB毎に若干異なる

### Implementation

```
packages/core/src/db/
├── schema/
│   ├── sqlite.ts      # SQLite用スキーマ
│   ├── mysql.ts       # MySQL用スキーマ
│   └── postgres.ts    # PostgreSQL用スキーマ
├── client.ts          # DB接続（URL判定で自動切替）
└── migrate.ts         # マイグレーション
```

### Migration Path

```bash
# SQLite → MySQL/PostgreSQL移行
agentmine db export --format sql > backup.sql
# config.yamlのdatabase.urlを変更
agentmine db import --file backup.sql
```

## References

- [MySQL vs PostgreSQL 詳細比較](./mysql-vs-postgresql-comparison.md)
- [SQLite When To Use](https://www.sqlite.org/whentouse.html)
- [Drizzle ORM Multi-DB](https://orm.drizzle.team/docs/overview)
- [DB-Engines Ranking](https://db-engines.com/en/ranking)
