# MySQL vs PostgreSQL: 企業向け詳細比較

agentmineの本番データベース選定のための詳細比較資料。

## Executive Summary

| 観点 | MySQL | PostgreSQL | 勝者 |
|------|-------|------------|------|
| 市場シェア | 40% | 18% | MySQL |
| 開発者人気（2025） | 41% | 46% | PostgreSQL |
| 読み取り性能 | 優秀 | 良好 | MySQL |
| 複雑クエリ性能 | 良好 | 優秀 | PostgreSQL |
| 企業導入実績 | 非常に多い | 多い（増加中） | MySQL |
| ライセンスリスク | Oracle懸念あり | なし | PostgreSQL |
| 運用経験者 | 多い | 増加中 | MySQL |

**結論**: 両方サポートし、ユーザーが選択できるようにする。

---

## 1. グローバル市場シェア

### DB-Engines Ranking (2025年10月)

| Rank | Database | Score |
|------|----------|-------|
| 1 | Oracle | 1,249 |
| 2 | MySQL | 1,092 |
| 3 | Microsoft SQL Server | 862 |
| 4 | PostgreSQL | 682 |

Source: [DB-Engines](https://db-engines.com/en/ranking_trend/system/MySQL;PostgreSQL)

### 実際の採用数

| Database | 企業数 | 市場シェア |
|----------|--------|-----------|
| MySQL | 191,458 | 40.03% |
| PostgreSQL | 84,260 | 17.62% |

Source: [6sense](https://6sense.com/tech/relational-databases/mysql-vs-postgresql)

### 開発者調査（Stack Overflow 2024-2025）

```
PostgreSQL: 45.55% → 最も使用されているDB
MySQL:      41.09%
```

- 2023年にPostgreSQLがMySQLを初めて逆転
- 「最も好まれるDB」「最も使いたいDB」でもPostgreSQLが1位

Source: [Stack Overflow Survey](https://survey.stackoverflow.co/2024/technology)

### 地域別傾向

| 地域 | MySQL優位 | PostgreSQL優位 |
|------|----------|---------------|
| インド | ✓ | |
| ブラジル | ✓ | |
| イギリス | ✓ | |
| アメリカ | | ✓ (44%がUS企業) |
| ドイツ | | ✓ |

---

## 2. 企業導入実績

### PostgreSQLを使用する主要企業

| 企業 | 業界 | 備考 |
|------|------|------|
| Apple | テクノロジー | 2010年にMySQLから移行（OS X Lion以降） |
| Instagram | SNS | 大規模PostgreSQL運用 |
| Spotify | 音楽 | |
| Netflix | 動画 | |
| Uber | モビリティ | 一部はMySQLも併用 |
| Cisco | ネットワーク | |
| Fujitsu | IT | |
| Red Hat | OSS | |
| US FAA | 政府機関 | 航空管制システム |
| Accenture | コンサル | |

Source: [LearnSQL](https://learnsql.com/blog/companies-that-use-postgresql-in-business/), [CYBERTEC](https://www.cybertec-postgresql.com/en/postgresql-overview/solutions-who-uses-postgresql/)

### MySQLを使用する主要企業

| 企業 | 業界 | 備考 |
|------|------|------|
| Facebook/Meta | SNS | 大規模カスタマイズ版 |
| Twitter/X | SNS | |
| YouTube | 動画 | |
| Booking.com | 旅行 | |
| GitHub | 開発 | |
| Airbnb | 旅行 | |
| Uber | モビリティ | PostgreSQLと併用 |
| LinkedIn | SNS | |
| Netflix | 動画 | PostgreSQLと併用 |
| Slack | コミュニケーション | |

### 業界別傾向

**MySQL優位:**
- Web開発 (4,869社)
- デジタルマーケティング (3,700社)
- Eコマース

**PostgreSQL優位:**
- 機械学習 (2,153社)
- AI (1,797社)
- 金融サービス
- 製造業（Oracle離脱先として）
- 政府機関

---

## 3. 技術比較

### パフォーマンス

| ワークロード | MySQL | PostgreSQL |
|-------------|-------|------------|
| 読み取り重視（OLTP） | ◎ 優秀 | ○ 良好 |
| 書き込み重視 | ○ 良好 | ○ 良好 |
| 複雑なクエリ | ○ 良好 | ◎ 優秀 |
| JSON操作 | ○ 良好 | ◎ 優秀（JSONB） |
| 全文検索 | ○ 良好 | ◎ 優秀 |
| 地理空間（GIS） | △ 基本的 | ◎ PostGIS |

> 一般的なワークロードでは性能差は30%以内。インデックス設計の方が重要。
> Source: [Bytebase](https://www.bytebase.com/blog/postgres-vs-mysql/)

### 機能比較

| 機能 | MySQL | PostgreSQL |
|------|-------|------------|
| ACID準拠 | ○ (InnoDB) | ◎ 完全 |
| MVCC | ○ (InnoDB) | ◎ |
| JSON型 | ○ JSON | ◎ JSONB（インデックス可） |
| 配列型 | × | ◎ |
| カスタム型 | × | ◎ |
| Window関数 | ○ | ◎ |
| CTE（WITH句） | ○ | ◎ |
| パーティショニング | ○ | ◎ |
| 並列クエリ | ○ | ◎ |
| 拡張性 | △ 限定的 | ◎ 豊富（PostGIS等） |

### レプリケーション・HA

| 機能 | MySQL | PostgreSQL |
|------|-------|------------|
| 非同期レプリケーション | ◎ | ◎ |
| 同期レプリケーション | ○ 半同期 | ◎ |
| マスター-スレーブ | ◎ | ◎ |
| マスター-マスター | ◎ Group Replication | △ 要BDR等 |
| 論理レプリケーション | △ 限定的 | ◎ |
| 自動フェイルオーバー | ○ InnoDB Cluster | △ 要Patroni等 |
| カスケードレプリケーション | ○ | ◎ |

**HAツール:**
- MySQL: InnoDB Cluster, ProxySQL, Orchestrator
- PostgreSQL: Patroni, pgpool-II, Citus

### SQL標準準拠

| 観点 | MySQL | PostgreSQL |
|------|-------|------------|
| 標準SQL準拠度 | 中程度 | 高い |
| 独自拡張 | 多い | 少ない |
| GROUP BY挙動 | 非標準（ONLY_FULL_GROUP_BY設定） | 標準 |
| 暗黙の型変換 | 多い（予期せぬ動作の原因） | 厳格 |

---

## 4. ライセンス・ベンダーリスク

### MySQL

```
┌─────────────────────────────────────────────────────────────┐
│  MySQL ライセンス構造                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Community Edition (GPLv2)                                  │
│  └─ 無料、OSS                                               │
│  └─ 機能限定                                                │
│                                                             │
│  Enterprise Edition (商用ライセンス)                         │
│  └─ 有料（Oracle契約）                                      │
│  └─ 高度なセキュリティ、監視、バックアップ                    │
│  └─ 価格: サーバーあたり or CPUあたり                       │
│                                                             │
│  ⚠️ Oracle懸念事項:                                         │
│  └─ ライセンス料の値上げリスク                              │
│  └─ Enterprise限定機能の増加                               │
│  └─ ベンダーロックイン                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Oracle買収後の懸念（歴史）:**
- 2010年: OracleがSunを買収、MySQL取得
- MySQL創業者がMariaDBをフォーク
- 50,000人以上の開発者が買収反対署名
- AppleがMySQLからPostgreSQLに移行

**代替選択肢:**
- **MariaDB**: MySQL互換のフォーク、完全OSS
- **Percona Server**: MySQL互換、Enterprise機能が無料

### PostgreSQL

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL ライセンス構造                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PostgreSQL License (BSD-like)                              │
│  └─ 完全無料、OSS                                           │
│  └─ 商用利用制限なし                                        │
│  └─ 単一ベンダー支配なし                                    │
│                                                             │
│  商用サポート（任意）:                                       │
│  └─ EDB (EnterpriseDB)                                     │
│  └─ 2ndQuadrant                                            │
│  └─ Crunchy Data                                           │
│  └─ AWS/Azure/GCPのマネージドサービス                       │
│                                                             │
│  ✓ ベンダーロックインリスクなし                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 運用・エコシステム

### 管理ツール

| ツール | MySQL | PostgreSQL |
|--------|-------|------------|
| 公式GUI | MySQL Workbench | pgAdmin |
| Web管理 | phpMyAdmin | pgAdmin (Web), Adminer |
| 監視 | MySQL Enterprise Monitor, PMM | pgwatch, Datadog |
| バックアップ | mysqldump, Percona XtraBackup | pg_dump, pgBackRest |

### クラウドサポート

| Cloud | MySQL | PostgreSQL |
|-------|-------|------------|
| AWS | RDS, Aurora | RDS, Aurora PostgreSQL |
| Azure | Azure Database for MySQL | Azure Database for PostgreSQL |
| GCP | Cloud SQL | Cloud SQL, AlloyDB |

両方とも主要クラウドで完全サポート。

### ORM/ドライバ対応

| 言語/Framework | MySQL | PostgreSQL |
|----------------|-------|------------|
| Node.js | mysql2, Sequelize, Prisma, Drizzle | pg, Sequelize, Prisma, Drizzle |
| Python | mysqlclient, SQLAlchemy | psycopg2, SQLAlchemy |
| Go | go-sql-driver/mysql | pgx, lib/pq |
| Java | MySQL Connector/J | PostgreSQL JDBC |

---

## 6. agentmineにとっての考慮事項

### 想定ユースケース

| シナリオ | 推奨 |
|----------|------|
| 個人開発者 | SQLite |
| スタートアップ | PostgreSQL（モダン、柔軟） |
| 既存MySQL環境の企業 | MySQL |
| Oracle離脱検討企業 | PostgreSQL |
| 金融・医療 | PostgreSQL（ACID厳格、監査機能） |
| Web系大量読み取り | MySQL |
| AI/ML統合 | PostgreSQL |

### agentmineの技術要件

| 要件 | MySQL | PostgreSQL | 評価 |
|------|-------|------------|------|
| JSON保存（Memory Bank） | ○ | ◎ JSONB | PG有利 |
| 複雑なタスク検索 | ○ | ◎ | PG有利 |
| 単純なCRUD | ◎ | ○ | MySQL有利 |
| 将来のAI機能統合 | ○ | ◎ pgvector | PG有利 |

### 両対応のコスト

Drizzle ORMで両対応は技術的に可能：

```typescript
// スキーマ定義は若干異なるが、クエリAPIは共通
// packages/core/src/db/schema/mysql.ts
// packages/core/src/db/schema/postgres.ts
```

追加開発コスト: 約10-20%増

---

## 7. 結論・推奨

### agentmineの方針

```
┌─────────────────────────────────────────────────────────────┐
│  agentmine データベース戦略                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ローカル開発: SQLite（変更なし）                           │
│                                                             │
│  本番環境: MySQL / PostgreSQL 両対応                        │
│                                                             │
│  # config.yaml                                              │
│  database:                                                  │
│    # SQLite（デフォルト）                                   │
│    url: file:.agentmine/data.db                            │
│                                                             │
│    # MySQL                                                  │
│    url: mysql://user:pass@host:3306/agentmine              │
│                                                             │
│    # PostgreSQL                                             │
│    url: postgres://user:pass@host:5432/agentmine           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 推奨ガイダンス（ドキュメント記載用）

| 状況 | 推奨DB | 理由 |
|------|--------|------|
| 迷ったら | PostgreSQL | 機能豊富、ライセンス安心、成長傾向 |
| 既存MySQL環境 | MySQL | 既存インフラ活用 |
| Oracle離脱 | PostgreSQL | ベンダーロックイン回避 |
| 超大規模読み取り | MySQL | 実績あり |
| AI/ベクトル検索予定 | PostgreSQL | pgvector対応 |

---

## References

- [DB-Engines Ranking](https://db-engines.com/en/ranking_trend/system/MySQL;PostgreSQL)
- [6sense: MySQL vs PostgreSQL](https://6sense.com/tech/relational-databases/mysql-vs-postgresql)
- [Bytebase: Postgres vs MySQL](https://www.bytebase.com/blog/postgres-vs-mysql/)
- [EDB: PostgreSQL vs MySQL Comparison](https://www.enterprisedb.com/blog/postgresql-vs-mysql-360-degree-comparison-syntax-performance-scalability-and-features)
- [Stack Overflow Survey 2024](https://survey.stackoverflow.co/2024/technology)
- [Oracle MySQL Licensing Guide](https://oraclelicensingexperts.com/oracle-mysql-licensing-and-support-a-complete-advisory-guide/)
- [Percona: Oracle License and MySQL](https://www.percona.com/blog/oracle-license-revenue-and-the-mysql-ecosystem/)
- [LearnSQL: Companies using PostgreSQL](https://learnsql.com/blog/companies-that-use-postgresql-in-business/)
- [Medium: PostgreSQL vs MySQL at Fortune 500 Scale](https://medium.com/@jholt1055/postgresql-vs-mysql-in-2025-what-10-years-managing-both-at-fortune-500-scale-taught-me-adc002c10453)
