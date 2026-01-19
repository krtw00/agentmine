# ADR-002: SQLite as Default Database

## Status

**Accepted** - 2025-01

## Context

agentmineはプロジェクト管理データ（タスク、セッション、エージェント定義等）を永続化する必要がある。

### 使用シナリオ

1. **個人開発者**: ローカルでAIエージェントを使って開発
2. **小規模チーム**: 数人でプロジェクトを共有
3. **大規模チーム**: 多数のユーザーが同時アクセス

### 検討した選択肢

| 選択肢 | メリット | デメリット |
|--------|---------|-----------|
| **SQLite** | ゼロ設定、ファイルベース、ポータブル | 同時書き込みに弱い |
| **PostgreSQL** | スケーラブル、同時接続、機能豊富 | サーバー必要、設定複雑 |
| **MySQL** | 広く使われている、安定 | サーバー必要 |
| **JSON/YAML** | シンプル、人間可読 | クエリ困難、競合問題 |
| **LevelDB/RocksDB** | 高速KVS | SQLなし、クエリ困難 |

## Decision

**SQLiteをデフォルト、PostgreSQLをオプション**で対応する。

```yaml
# .agentmine/config.yaml

# ローカル開発（デフォルト）
database:
  url: file:.agentmine/data.db

# チーム共有
database:
  url: postgres://user:pass@host:5432/agentmine
```

## Rationale

### 1. SQLiteをデフォルトにした理由

- **ゼロ設定**: `agentmine init`だけで即座に使える
- **ポータブル**: `.agentmine/data.db`をコピーするだけでバックアップ
- **Git管理可能**: 小規模なら`.gitignore`から外してチーム共有も可能
- **十分な性能**: 個人〜数人の利用なら問題なし
- **TSK/TaskMaster AIも同様**: 類似ツールもSQLiteを採用

### 2. PostgreSQLをオプションにした理由

- **スケーラビリティ**: 大規模チーム、多数の同時接続
- **高度な機能**: JSONカラム、全文検索、トリガー
- **Supabase対応**: Supabaseを使えばホスト不要で利用可能

### 3. JSON/YAMLを採用しなかった理由

当初、設定ファイル（`config.yaml`）と同様にデータもYAMLで管理することを検討したが：

- 複雑なクエリ（「ステータスがopenでpriorityがhighのタスク」）が困難
- 複数プロセスからの同時書き込みで競合
- データ量が増えると読み込みが遅い

ただし、**Memory Bank**（コンテキスト保存）はMarkdownファイルで管理する。
これは人間が読む・Gitで差分を見ることを重視したため。

## Consequences

### Positive

- 初期セットアップが簡単（DBサーバー不要）
- 開発環境の再現が容易（ファイルコピーだけ）
- Drizzle ORMで両DBを透過的に扱える

### Negative

- チーム利用時はPostgreSQLへの移行が必要
- マイグレーションの互換性に注意が必要

### Migration Path

```bash
# SQLite → PostgreSQL移行
agentmine db export --format sql > backup.sql
# config.yamlのdatabase.urlを変更
agentmine db import --file backup.sql
```

## Alternatives Considered

### Supabase統合

将来的にはSupabase（PostgreSQL + Auth + Storage）との統合を検討：

```yaml
database:
  provider: supabase
  url: https://xxx.supabase.co
  key: ${SUPABASE_KEY}
```

これにより：
- ホスティング不要でPostgreSQLが使える
- 認証機能も統合可能
- リアルタイム同期が可能

## References

- [SQLite When To Use](https://www.sqlite.org/whentouse.html)
- [Drizzle ORM - SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [TSK Architecture](https://github.com/dtormoen/tsk) - SQLite採用
