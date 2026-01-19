# Skill System

再利用可能なプロンプトテンプレートシステム。

## 概要

頻繁に使用するプロンプトパターンを「スキル」として定義し、
エージェントやCLIから呼び出し可能にする。

## 設計目標

1. **再利用性**: 同じプロンプトを何度も書かない
2. **共有可能**: チーム・コミュニティで共有
3. **パラメータ化**: 変数を使って柔軟に
4. **バージョン管理**: スキルの更新・履歴管理

## スキル定義

### 基本構造

```yaml
# .agentmine/config.yaml
skills:
  <name>:
    source: builtin | local | remote
    path: string       # local
    url: string        # remote
    description: string
```

### ソースタイプ

| Source | Description | Example |
|--------|-------------|---------|
| `builtin` | 組み込みスキル | commit, review |
| `local` | ローカルファイル | .agentmine/skills/deploy.md |
| `remote` | リモートURL | https://skills.example.com/audit.md |

## 組み込みスキル

### commit

```markdown
# Commit Skill

## Instructions
以下の手順でコミットを作成してください：

1. `git status` で変更を確認
2. `git diff` で差分を確認
3. 変更内容を分析
4. Conventional Commits形式でコミットメッセージを作成
   - feat: 新機能
   - fix: バグ修正
   - docs: ドキュメント
   - refactor: リファクタリング
   - test: テスト
   - chore: その他
5. `git add` と `git commit` を実行

## Output Format
```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```
```

### review

```markdown
# Code Review Skill

## Instructions
コードレビューを実施してください：

1. 変更されたファイルを確認
2. 以下の観点でレビュー：
   - コードの正確性
   - エラーハンドリング
   - パフォーマンス
   - セキュリティ
   - 可読性・保守性
   - テストカバレッジ

3. 問題点を指摘（重要度付き）
4. 改善提案

## Output Format
```
## Review Summary

### Critical Issues
- [ ] Issue description

### Suggestions
- [ ] Suggestion description

### Good Points
- Point description

## Verdict
APPROVE / REQUEST_CHANGES / COMMENT
```
```

### test

```markdown
# Test Skill

## Instructions
テストを作成・実行してください：

1. 対象コードを分析
2. テストケースを設計
   - 正常系
   - 異常系
   - 境界値
3. テストコードを作成
4. テストを実行
5. カバレッジを確認

## Guidelines
- 各テストは独立して実行可能に
- モック・スタブを適切に使用
- アサーションは具体的に
```

## ローカルスキル

### ファイル構造

```
.agentmine/
└── skills/
    ├── deploy.md
    ├── security-audit.md
    └── api-design.md
```

### スキルファイル形式

```markdown
# Skill Name

## Description
スキルの説明。

## Parameters
- `{{param1}}`: パラメータ1の説明
- `{{param2}}`: パラメータ2の説明

## Instructions
実行手順...

## Examples
使用例...

## Output Format
出力形式...
```

### 例: deploy.md

```markdown
# Deploy Skill

## Description
本番環境へのデプロイを実行します。

## Parameters
- `{{environment}}`: デプロイ先環境 (staging | production)
- `{{version}}`: デプロイバージョン

## Instructions

### Pre-deploy Checks
1. すべてのテストが通っていることを確認
2. ビルドが成功することを確認
3. 環境変数が正しく設定されていることを確認

### Deploy Steps
1. `npm run build` でビルド
2. `npm run deploy:{{environment}}` でデプロイ
3. ヘルスチェックを実行

### Post-deploy
1. デプロイログを確認
2. 動作確認
3. 問題があればロールバック

## Rollback
```bash
npm run rollback:{{environment}}
```
```

## リモートスキル

### 設定

```yaml
skills:
  security-audit:
    source: remote
    url: https://skills.agentmine.dev/security-audit.md
    # キャッシュ設定
    cache:
      enabled: true
      ttl: 86400  # 24時間
```

### セキュリティ

```yaml
# 許可するドメインを制限
skills:
  remoteAllowedDomains:
    - skills.agentmine.dev
    - raw.githubusercontent.com
```

## API

### SkillService

```typescript
// packages/core/src/services/skill-service.ts

export class SkillService {
  constructor(
    private config: Config,
    private cache: Cache,
  ) {}

  // スキル一覧
  async listSkills(): Promise<Skill[]>;

  // スキル取得
  async getSkill(name: string): Promise<Skill>;

  // スキル内容取得（パラメータ展開済み）
  async getSkillContent(
    name: string,
    params?: Record<string, string>,
  ): Promise<string>;

  // スキル実行
  async runSkill(
    name: string,
    agent: Agent,
    params?: Record<string, string>,
  ): Promise<SkillResult>;

  // スキル追加
  async addSkill(skill: NewSkill): Promise<void>;

  // スキル削除
  async removeSkill(name: string): Promise<void>;
}
```

### Skill型

```typescript
interface Skill {
  name: string;
  description?: string;
  source: 'builtin' | 'local' | 'remote';
  path?: string;     // local
  url?: string;      // remote
  content?: string;  // 読み込み済みコンテンツ
  parameters?: SkillParameter[];
}

interface SkillParameter {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}
```

## CLI

```bash
# スキル一覧
agentmine skill list

# スキル詳細
agentmine skill show commit

# スキル実行
agentmine skill run commit
agentmine skill run deploy --param environment=staging

# タスクに紐づけて実行
agentmine skill run review --task 5

# スキル追加
agentmine skill add my-skill --path ./skills/my-skill.md

# リモートスキル追加
agentmine skill add security --url https://example.com/security.md

# スキル削除
agentmine skill remove my-skill

# スキル編集
agentmine skill edit my-skill
```

## 出力例

### skill list

```
Name              Source   Description
────────────────────────────────────────────────────────────
commit            builtin  Conventional Commitsでコミット作成
review            builtin  コードレビュー実施
test              builtin  テスト作成・実行
deploy            local    本番環境へのデプロイ
security-audit    remote   セキュリティ監査
```

### skill show

```
Skill: deploy

Source: local
Path: .agentmine/skills/deploy.md

Description:
  本番環境へのデプロイを実行します。

Parameters:
  - environment (required): デプロイ先環境 (staging | production)
  - version (optional): デプロイバージョン

Used by agents:
  - coder
```

### skill run

```
Running skill: deploy
Agent: coder
Parameters:
  - environment: staging

───────────────────────────────────────────────────

[coder] デプロイを開始します。

Pre-deploy checks...
✓ Tests passed
✓ Build successful
✓ Environment variables configured

Deploying to staging...
<tool_use: Bash npm run deploy:staging>

Deploy successful!
Health check: OK

───────────────────────────────────────────────────

Skill execution complete.
```

## スキルマーケットプレイス（将来）

```bash
# 公開スキルの検索
agentmine skill search "security"

# スキルのインストール
agentmine skill install @community/owasp-check
agentmine skill install @company/internal-deploy

# スキルの公開
agentmine skill publish ./skills/my-skill.md

# スキルの更新
agentmine skill update @community/owasp-check
```

### マーケットプレイスAPI

```
https://skills.agentmine.dev/api/v1/
  GET  /skills              # 一覧
  GET  /skills/:name        # 詳細
  GET  /skills/:name/raw    # 生コンテンツ
  POST /skills              # 公開
```

## パラメータ展開

```typescript
// テンプレート
const template = `
Deploy to {{environment}}
Version: {{version | default: "latest"}}
`;

// パラメータ
const params = {
  environment: 'staging',
};

// 展開結果
const expanded = `
Deploy to staging
Version: latest
`;
```

### 展開構文

| Syntax | Description |
|--------|-------------|
| `{{name}}` | 必須パラメータ |
| `{{name \| default: "value"}}` | デフォルト値付き |
| `{{name \| upper}}` | 大文字変換 |
| `{{name \| lower}}` | 小文字変換 |
