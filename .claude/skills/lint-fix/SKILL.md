---
name: lint-fix
description: "リントエラーを検出・修正する。コードスタイル違反の修正時に使用。"
allowed-tools: Bash, Read, Edit
model: haiku
---

# リント修正スキル

## 概要

ESLintとPrettierを使用してコードスタイルを検証・修正します。

## コマンド

```bash
# リントチェック
pnpm lint

# 自動修正
pnpm lint:fix

# Prettierフォーマット
pnpm format

# 特定ファイルのみ
pnpm eslint packages/cli/src/commands/task.ts --fix
```

## よくあるエラーと修正

### unused-vars

```typescript
// Before
const unused = 'value';

// After (削除 or アンダースコア)
const _unused = 'value'; // 意図的に未使用
```

### prefer-const

```typescript
// Before
let x = 1;

// After
const x = 1;
```

### no-explicit-any

```typescript
// Before
function process(data: any) {}

// After
function process(data: unknown) {}
// または具体的な型を定義
```

### import/order

インポートを正しい順序に並び替え:

1. Node.js built-in
2. 外部パッケージ
3. 内部パッケージ (@agentmine/*)
4. 相対インポート

## 設定ファイル

- `.eslintrc.js` - ESLint設定
- `.prettierrc` - Prettier設定
- `tsconfig.json` - TypeScript設定
