# Database Schema

agentmineのSQLiteデータベーススキーマ設計。

## ER図

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  projects   │────<│    tasks    │────<│  histories  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────────────┐  ┌─────────────┐
              │   agents    │  │   skills    │
              └─────────────┘  └─────────────┘
```

## Tables

### projects

プロジェクト情報。

```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,              -- プロジェクトのパス
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### tasks

タスク（チケット）情報。

```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',    -- open, in_progress, review, done, cancelled
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    type TEXT NOT NULL DEFAULT 'task',       -- task, feature, bug, refactor
    assignee_type TEXT,                      -- 'ai' or 'human'
    assignee_name TEXT,                      -- agent name or human name
    branch_name TEXT,                        -- 作業ブランチ名
    pr_url TEXT,                             -- PR URL
    parent_id INTEGER REFERENCES tasks(id),  -- 親タスク（サブタスク用）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_type, assignee_name);
```

### histories

タスクの履歴・変更ログ。

```sql
CREATE TABLE histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    action TEXT NOT NULL,            -- created, status_changed, assigned, commented, etc.
    actor_type TEXT NOT NULL,        -- 'ai' or 'human'
    actor_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_histories_task_id ON histories(task_id);
```

### agents

エージェント定義（プロジェクトローカル設定と併用）。

```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id), -- NULLならグローバル
    name TEXT NOT NULL,
    description TEXT,
    model TEXT DEFAULT 'claude-sonnet',
    tools TEXT,                      -- JSON array
    skills TEXT,                     -- JSON array
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);
```

### skills

スキル定義。

```sql
CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id), -- NULLならグローバル
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'local', -- builtin, local, remote
    path TEXT,                            -- ローカルファイルパス
    url TEXT,                             -- リモートURL
    prompt TEXT,                          -- インラインプロンプト
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);
```

### sessions

AIエージェントの実行セッション。

```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
    input TEXT,                             -- 入力プロンプト
    output TEXT,                            -- 出力結果
    token_usage INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE INDEX idx_sessions_task_id ON sessions(task_id);
```

## Status Flow

```
┌──────┐     ┌─────────────┐     ┌────────┐     ┌──────┐
│ open │────>│ in_progress │────>│ review │────>│ done │
└──────┘     └─────────────┘     └────────┘     └──────┘
    │              │                  │
    └──────────────┴──────────────────┴────> cancelled
```

## Migration

初期マイグレーション:

```sql
-- 001_init.sql
PRAGMA foreign_keys = ON;

-- 上記のCREATE TABLE文をすべて実行
```
