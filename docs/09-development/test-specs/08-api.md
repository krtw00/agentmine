# API テスト仕様

## 概要

Web APIエンドポイントの動作を検証する。

## Tasks API

| ID | メソッド | エンドポイント | テスト内容 |
|----|---------|---------------|-----------|
| API-TASK-001 | GET | /api/tasks | 一覧取得 |
| API-TASK-002 | POST | /api/tasks | タスク作成 |
| API-TASK-003 | GET | /api/tasks/{id} | 詳細取得 |
| API-TASK-004 | PATCH | /api/tasks/{id} | 更新 |
| API-TASK-005 | DELETE | /api/tasks/{id} | 削除 |

## Sessions API

| ID | メソッド | エンドポイント | テスト内容 |
|----|---------|---------------|-----------|
| API-SESS-001 | GET | /api/sessions | 一覧取得 |
| API-SESS-002 | GET | /api/sessions/{id} | 詳細取得 |

## Agents API

| ID | メソッド | エンドポイント | テスト内容 |
|----|---------|---------------|-----------|
| API-AGENT-001 | GET | /api/agents | 一覧取得 |
| API-AGENT-002 | POST | /api/agents | 作成 |
| API-AGENT-003 | GET | /api/agents/{id} | 詳細取得 |
| API-AGENT-004 | PATCH | /api/agents/{id} | 更新 |
| API-AGENT-005 | DELETE | /api/agents/{id} | 削除 |

## Memories API

| ID | メソッド | エンドポイント | テスト内容 |
|----|---------|---------------|-----------|
| API-MEM-001 | GET | /api/memories | 一覧取得 |
| API-MEM-002 | POST | /api/memories | 作成 |
| API-MEM-003 | GET | /api/memories/{id} | 詳細取得 |
| API-MEM-004 | PATCH | /api/memories/{id} | 更新 |
| API-MEM-005 | DELETE | /api/memories/{id} | 削除 |

## Settings API

| ID | メソッド | エンドポイント | テスト内容 |
|----|---------|---------------|-----------|
| API-SET-001 | GET | /api/settings | 設定取得 |
| API-SET-002 | POST | /api/settings | 設定更新（upsert） |

## テスト実装場所

`packages/web/src/__tests__/api/` に Vitest で実装

## 合格基準

- 全エンドポイントが正常応答（2xx）を返す
- エラーケース（404, 400等）が適切に処理される
- レスポンス形式がスキーマに準拠する
