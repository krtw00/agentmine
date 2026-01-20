# ADR-002: データベース戦略（SQLite + PostgreSQL）

## ステータス

**Accepted** - 2025-01（PostgreSQL確定）

## コンテキスト

AgentMineはプロジェクト管理データ（タスク、セッション、エージェント定義等）を永続化する必要がある。

### 使用シナリオ

| シナリオ | 対象 |
|---------|------|
| 個人開発者 | ローカルでAIエージェントを使って開発 |
| スタートアップ〜企業 | チームでプロジェクトを共有 |

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| SQLite | ゼロ設定、ファイルベース | 同時書き込みに弱い |
| PostgreSQL | 機能豊富、AI/ベクトル検索対応 | サーバー必要 |
| MySQL | 広く採用、運用経験者多い | AI機能が未成熟 |

詳細比較: @10-decisions/mysql-vs-postgresql-comparison.md を参照

## 決定

**SQLiteをローカル開発用デフォルト、PostgreSQLを本番環境用**とする。**MySQLは対応しない。**

### データベース選択

| 用途 | データベース | 設定 |
|------|-------------|------|
| ローカル開発（デフォルト） | SQLite | file:.agentmine/data.db |
| 本番環境 | PostgreSQL | postgres://user:pass@host:5432/agentmine |

## 理由

### 1. SQLiteをデフォルトにした理由

| 観点 | 説明 |
|------|------|
| ゼロ設定 | agentmine initだけで即座に使える |
| ポータブル | .agentmine/data.dbをコピーするだけでバックアップ |
| 十分な性能 | 個人〜数人の利用なら問題なし |

### 2. PostgreSQLを本番DBとして確定した理由

#### AI機能との親和性（決定的要因）

| 機能 | PostgreSQL | MySQL |
|------|------------|-------|
| ベクトル検索 | pgvector（成熟、2019年〜） | 2025年2月GA（新しい） |
| クラウドサポート | 全主要クラウド | Google Cloud SQLのみ |
| AI統合実績 | 多数（Supabase, Neon等） | 少ない |

AgentMineの将来機能でベクトル検索が必要：

| 用途 | 説明 |
|------|------|
| Memory Bankのセマンティック検索 | プロジェクト決定事項の類似検索 |
| タスク類似検索 | 「似たタスクを探す」 |

#### 技術的優位性

| 観点 | PostgreSQL | MySQL |
|------|------------|-------|
| JSON型 | JSONB（インデックス可） | JSON |
| 標準SQL準拠 | 高い | 独自拡張多い |
| 拡張性 | PostGIS, pgvector等 | 限定的 |
| 複雑クエリ | 優秀 | 良好 |

#### ライセンス・ベンダーリスク

| データベース | リスク |
|-------------|--------|
| PostgreSQL | BSD-like、ベンダーロックインなし |
| MySQL | Oracle所有、Enterprise版への誘導懸念 |

### 3. MySQLを対応しない理由

| 理由 | 説明 |
|------|------|
| AI機能の未成熟 | ベクトル検索のサポートが未成熟 |
| メンテナンスコスト | 2つのRDBMS対応は開発・テストコストが高い |
| PostgreSQLで十分 | 企業ニーズもPostgreSQLでカバー可能 |

既存MySQL環境の企業には、PostgreSQLへの移行またはハイブリッド構成を推奨。

## 結果

### ポジティブ

| 結果 | 説明 |
|------|------|
| メンテナンスコスト削減 | 単一RDBMSでシンプル |
| AI機能活用 | pgvectorをネイティブに活用可能 |
| エコシステム | Supabase, Neon等との親和性 |

### ネガティブ

| 結果 | 説明 |
|------|------|
| MySQL移行必要 | 既存MySQL環境の企業は移行が必要 |
| 学習コスト | MySQLのみ運用経験のあるDBAには学習コスト |

### マイグレーションパス

| 手順 | 操作 |
|------|------|
| 1 | agentmine db export --format sql でエクスポート |
| 2 | settings（database.url）を変更 |
| 3 | agentmine db migrate でマイグレーション |
| 4 | agentmine db import --file backup.sql でインポート |

## 将来の検討

### pgvector統合

Memory Bank（プロジェクト決定事項）のベクトル検索機能。詳細は @04-data/data-model.md を参照。

### Supabase統合（将来）

provider: supabase として直接統合の可能性。

## 参考資料

- pgvector GitHub: https://github.com/pgvector/pgvector
- Timescale: PostgreSQL as Vector Database
- @10-decisions/mysql-vs-postgresql-comparison.md
- SQLite When To Use: https://www.sqlite.org/whentouse.html
