# Authentication

認証・認可の設計。段階的に拡張する方針。

## 概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                       認証アーキテクチャ                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【Phase 1: ローカル開発】                                           │
│  認証なし。SQLiteでローカル完結。                                    │
│                                                                     │
│  【Phase 2: チーム利用】                                             │
│  CLI: APIキー認証（プログラマティックアクセス）                      │
│  Web UI: ID/Password認証（人間によるアクセス）                       │
│                                                                     │
│  【Phase 3: SaaS（将来）】                                           │
│  マルチテナント、組織管理、課金                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 設計方針

### OAuthを使用しない理由

1. **企業利用での独立性**: 外部サービス（Google, GitHub等）への依存を避ける
2. **オンプレミス対応**: インターネット接続なしでも動作可能
3. **シンプルさ**: 認証フローの複雑さを回避

### 二重認証モデル

| アクセス元 | 認証方式 | 理由 |
|------------|----------|------|
| CLI | APIキー | スクリプト・自動化に適する |
| Web UI | ID/Password | 人間の対話的アクセス |

## Phase 1: ローカル開発

認証なし。全機能にアクセス可能。

```yaml
# .agentmine/config.yaml
auth:
  enabled: false  # デフォルト
```

## Phase 2: チーム利用

### データモデル

```typescript
// ユーザー
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),

  name: text('name'),
  role: text('role', {
    enum: ['admin', 'member']
  }).notNull().default('member'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

// APIキー（CLI用）
export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  keyHash: text('key_hash').notNull(),  // ハッシュ化して保存
  keyPrefix: text('key_prefix').notNull(),  // 識別用（例: "am_..."の最初の8文字）

  name: text('name'),  // "CI/CD用", "ローカル開発用"等

  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
});

// Webセッション（Web UI用）
export const webSessions = sqliteTable('web_sessions', {
  id: text('id').primaryKey(),  // UUID

  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
});

// プロジェクトメンバー（将来のマルチプロジェクト対応用）
export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  role: text('role', {
    enum: ['owner', 'admin', 'member', 'viewer']
  }).notNull().default('member'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`),
});
```

### CLI認証フロー

```
┌─────────────────┐
│  CLI Command    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Read API Key    │────▶│ Validate Key    │
│ from env/config │     │ (hash compare)  │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
             ┌──────────┐              ┌──────────┐
             │  Valid   │              │ Invalid  │
             │ Execute  │              │  Error   │
             └──────────┘              └──────────┘
```

**APIキー形式**: `am_<random_32_chars>`

```bash
# 環境変数で設定
export AGENTMINE_API_KEY="am_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# または設定ファイル
# ~/.agentmine/credentials.yaml
api_key: am_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# コマンド実行
agentmine task list
```

### Web UI認証フロー

```
┌─────────────────┐
│  Login Form     │
│  email/password │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ POST /api/login │────▶│ Verify Password │
│                 │     │ (bcrypt)        │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
             ┌──────────────┐          ┌──────────┐
             │ Create       │          │  401     │
             │ Session      │          │ Unauthorized│
             │ Set Cookie   │          └──────────┘
             └──────────────┘
```

**セッション管理**:
- HTTPOnly Cookie
- 有効期限: 7日（設定可能）
- セッションIDはUUID v4

### CLI コマンド

```bash
# ユーザー管理（admin）
agentmine user list
agentmine user add --email user@example.com --role member
agentmine user remove user@example.com

# APIキー管理
agentmine auth key create --name "CI/CD用"
# => APIキーが表示される（一度のみ）

agentmine auth key list
agentmine auth key revoke <key_prefix>

# ログイン確認
agentmine auth whoami
```

### 設定

```yaml
# .agentmine/config.yaml
auth:
  enabled: true

  session:
    expiresIn: 7d  # セッション有効期限

  apiKey:
    expiresIn: 90d  # APIキー有効期限（null = 無期限）
```

## Phase 3: SaaS（将来）

マルチテナント対応時に追加予定:

- 組織（Organization）モデル
- 招待フロー
- 課金・プラン管理
- 監査ログ

## 権限モデル（後で決定）

権限の詳細は後で決定する。基本方針のみ記載。

```typescript
// 将来の権限定義（案）
type Permission =
  | 'task:read'
  | 'task:write'
  | 'task:delete'
  | 'agent:execute'
  | 'memory:read'
  | 'memory:write'
  | 'user:manage'
  | 'project:manage'
  ;

// ロールと権限のマッピング（案）
const rolePermissions: Record<Role, Permission[]> = {
  admin: ['*'],  // 全権限
  member: ['task:read', 'task:write', 'agent:execute', 'memory:read', 'memory:write'],
  viewer: ['task:read', 'memory:read'],
};
```

## セキュリティ考慮事項

### パスワード

- bcryptでハッシュ化（cost factor: 12）
- 最小8文字、複雑性要件は設定可能

### APIキー

- SHA-256でハッシュ化して保存
- 生成時のみ平文を表示
- プレフィックス（`am_`）で識別可能
- 有効期限設定推奨

### セッション

- HTTPOnly, Secure, SameSite=Strict
- CSRFトークン（フォーム送信時）
- セッション固定攻撃対策（ログイン時に再生成）

## API

### AuthService

```typescript
export class AuthService {
  // ユーザー管理
  async createUser(email: string, password: string, role?: Role): Promise<User>;
  async verifyPassword(email: string, password: string): Promise<User | null>;

  // APIキー
  async createApiKey(userId: number, name?: string): Promise<{ key: string; keyPrefix: string }>;
  async validateApiKey(key: string): Promise<User | null>;
  async revokeApiKey(keyPrefix: string): Promise<void>;

  // セッション
  async createSession(userId: number): Promise<string>;  // returns sessionId
  async validateSession(sessionId: string): Promise<User | null>;
  async destroySession(sessionId: string): Promise<void>;
}
```

## References

- [Architecture](../architecture.md)
- [Data Model](../data-model.md)
