# MySQL vs PostgreSQL: 企業向け詳細比較

AgentMineの本番データベース選定のための詳細比較資料。

## エグゼクティブサマリー

| 観点 | MySQL | PostgreSQL | 勝者 |
|------|-------|------------|------|
| 市場シェア | 40% | 18% | MySQL |
| 開発者人気（2025） | 41% | 46% | PostgreSQL |
| 読み取り性能 | 優秀 | 良好 | MySQL |
| 複雑クエリ性能 | 良好 | 優秀 | PostgreSQL |
| 企業導入実績 | 非常に多い | 多い（増加中） | MySQL |
| ライセンスリスク | Oracle懸念あり | なし | PostgreSQL |
| 運用経験者 | 多い | 増加中 | MySQL |
| **AI/ベクトル検索** | △ 2025年2月GA | ◎ pgvector成熟 | **PostgreSQL** |

**結論**: **PostgreSQLのみサポート**。AI機能（ベクトル検索）との親和性が決定的要因。

## 1. グローバル市場シェア

### DB-Engines Ranking (2025年10月)

| Rank | Database | Score |
|------|----------|-------|
| 1 | Oracle | 1,249 |
| 2 | MySQL | 1,092 |
| 3 | Microsoft SQL Server | 862 |
| 4 | PostgreSQL | 682 |

### 実際の採用数

| Database | 企業数 | 市場シェア |
|----------|--------|-----------|
| MySQL | 191,458 | 40.03% |
| PostgreSQL | 84,260 | 17.62% |

### 開発者調査（Stack Overflow 2024-2025）

| Database | 使用率 | 備考 |
|----------|--------|------|
| PostgreSQL | 45.55% | 最も使用されているDB |
| MySQL | 41.09% | |

2023年にPostgreSQLがMySQLを初めて逆転。「最も好まれるDB」「最も使いたいDB」でもPostgreSQLが1位。

### 地域別傾向

| 地域 | MySQL優位 | PostgreSQL優位 |
|------|----------|---------------|
| インド | ✓ | |
| ブラジル | ✓ | |
| イギリス | ✓ | |
| アメリカ | | ✓ (44%がUS企業) |
| ドイツ | | ✓ |

## 2. 企業導入実績

### PostgreSQLを使用する主要企業

| 企業 | 業界 | 備考 |
|------|------|------|
| Apple | テクノロジー | 2010年にMySQLから移行（OS X Lion以降） |
| Instagram | SNS | 大規模PostgreSQL運用 |
| Spotify | 音楽 | |
| Netflix | 動画 | |
| Uber | モビリティ | 一部はMySQLも併用 |
| US FAA | 政府機関 | 航空管制システム |

### MySQLを使用する主要企業

| 企業 | 業界 | 備考 |
|------|------|------|
| Facebook/Meta | SNS | 大規模カスタマイズ版 |
| Twitter/X | SNS | |
| YouTube | 動画 | |
| GitHub | 開発 | |
| Airbnb | 旅行 | |

### 業界別傾向

| 傾向 | 業界 |
|------|------|
| MySQL優位 | Web開発、デジタルマーケティング、Eコマース |
| PostgreSQL優位 | 機械学習、AI、金融サービス、政府機関 |

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

一般的なワークロードでは性能差は30%以内。インデックス設計の方が重要。

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
| 拡張性 | △ 限定的 | ◎ 豊富（PostGIS等） |

### レプリケーション・HA

| 機能 | MySQL | PostgreSQL |
|------|-------|------------|
| 非同期レプリケーション | ◎ | ◎ |
| 同期レプリケーション | ○ 半同期 | ◎ |
| マスター-マスター | ◎ Group Replication | △ 要BDR等 |
| 論理レプリケーション | △ 限定的 | ◎ |

**HAツール:**

| データベース | ツール |
|-------------|--------|
| MySQL | InnoDB Cluster, ProxySQL, Orchestrator |
| PostgreSQL | Patroni, pgpool-II, Citus |

### SQL標準準拠

| 観点 | MySQL | PostgreSQL |
|------|-------|------------|
| 標準SQL準拠度 | 中程度 | 高い |
| 独自拡張 | 多い | 少ない |
| GROUP BY挙動 | 非標準 | 標準 |
| 暗黙の型変換 | 多い（予期せぬ動作の原因） | 厳格 |

## 4. ライセンス・ベンダーリスク

### MySQL

| 項目 | 説明 |
|------|------|
| Community Edition | GPLv2、無料、OSS、機能限定 |
| Enterprise Edition | 商用ライセンス、有料（Oracle契約） |
| リスク | ライセンス料の値上げ、Enterprise限定機能の増加 |

**Oracle買収後の懸念:**
- 2010年: OracleがSunを買収、MySQL取得
- MySQL創業者がMariaDBをフォーク
- AppleがMySQLからPostgreSQLに移行

### PostgreSQL

| 項目 | 説明 |
|------|------|
| ライセンス | BSD-like、完全無料、商用利用制限なし |
| 商用サポート | EDB, 2ndQuadrant, Crunchy Data等（任意） |
| リスク | ベンダーロックインリスクなし |

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

## 6. AgentMineにとっての考慮事項

### 想定ユースケース

| シナリオ | 推奨 |
|----------|------|
| 個人開発者 | SQLite |
| スタートアップ | PostgreSQL（モダン、柔軟） |
| 既存MySQL環境の企業 | MySQL |
| Oracle離脱検討企業 | PostgreSQL |
| 金融・医療 | PostgreSQL（ACID厳格、監査機能） |
| AI/ML統合 | PostgreSQL |

### AgentMineの技術要件

| 要件 | MySQL | PostgreSQL | 評価 |
|------|-------|------------|------|
| JSON保存（Memory Bank） | ○ | ◎ JSONB | PG有利 |
| 複雑なタスク検索 | ○ | ◎ | PG有利 |
| 単純なCRUD | ◎ | ○ | MySQL有利 |
| 将来のAI機能統合 | ○ | ◎ pgvector | PG有利 |

## 7. 結論・推奨

### AgentMineの方針（確定）

| 用途 | データベース |
|------|-------------|
| ローカル開発 | SQLite |
| 本番環境 | PostgreSQL のみ |

**MySQLは対応しない。**

### PostgreSQLに確定した決定的理由

**AI機能との親和性が圧倒的に優れている:**

| 機能 | PostgreSQL | MySQL |
|------|------------|-------|
| ベクトル検索 | pgvector（2019年〜、成熟） | 2025年2月GA（新しすぎる） |
| クラウドサポート | 全主要クラウド | Google Cloud SQLのみ |
| AI統合実績 | 多数（Supabase, Neon等） | 少ない |

AgentMineの将来機能（Memory Bankのセマンティック検索、タスク類似検索、スキル推薦）にはベクトル検索が不可欠。MySQLのベクトル検索は2025年2月にようやくGAとなったばかりで、実績・エコシステムともに未成熟。

### MySQLを対応しない理由

| 理由 | 説明 |
|------|------|
| AI機能サポートの未成熟 | pgvectorに比べてMySQLのベクトル検索は実績が少ない |
| メンテナンスコスト | 2つのRDBMS対応は開発・テスト・ドキュメントコストが高い |
| PostgreSQLで十分 | 企業ニーズもPostgreSQLでカバー可能 |

既存MySQL環境の企業には、PostgreSQLへの移行またはハイブリッド構成を推奨する。

## 参考資料

- DB-Engines Ranking: https://db-engines.com/en/ranking_trend/system/MySQL;PostgreSQL
- 6sense: MySQL vs PostgreSQL: https://6sense.com/tech/relational-databases/mysql-vs-postgresql
- Bytebase: Postgres vs MySQL: https://www.bytebase.com/blog/postgres-vs-mysql/
- Stack Overflow Survey 2024: https://survey.stackoverflow.co/2024/technology
- LearnSQL: Companies using PostgreSQL: https://learnsql.com/blog/companies-that-use-postgresql-in-business/
