---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
---

# TypeScript コードスタイル

## 基本ルール

- strict mode有効
- 2スペースインデント
- シングルクォート
- セミコロン必須
- 末尾カンマ使用

## 命名規則

- 変数・関数: camelCase
- クラス・型: PascalCase
- 定数: UPPER_SNAKE_CASE
- ファイル: kebab-case.ts

## インポート順序

```typescript
// 1. Node.js built-in
import path from 'path';

// 2. 外部パッケージ
import { Command } from 'commander';

// 3. 内部パッケージ (@agentmine/*)
import { TaskService } from '@agentmine/core';

// 4. 相対インポート
import { formatTask } from './utils/output';
```

## 型定義

- 明示的な型注釈を優先（推論に頼りすぎない）
- `any` 禁止、必要な場合は `unknown` を使用
- Union型は3つまで、それ以上は型定義を作成

## エラーハンドリング

```typescript
// カスタムエラークラスを使用
class TaskNotFoundError extends Error {
  constructor(public taskId: number) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

// try-catchで適切にハンドル
try {
  const task = await taskService.getTask(id);
} catch (error) {
  if (error instanceof TaskNotFoundError) {
    // 具体的な処理
  }
  throw error;
}
```
