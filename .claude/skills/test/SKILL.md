---
name: test
description: "テストを実行する。コード変更後のテスト実行、テスト追加、テスト修正時に使用。"
allowed-tools: Bash, Read, Grep, Glob
model: haiku
---

# テスト実行スキル

## 概要

Vitestを使用してテストを実行します。

## コマンド

```bash
# 全テスト実行
pnpm test

# 特定パッケージのテスト
pnpm --filter @agentmine/core test
pnpm --filter @agentmine/cli test
pnpm --filter @agentmine/web test

# ファイル指定
pnpm test -- packages/core/src/services/task-service.test.ts

# ウォッチモード
pnpm test -- --watch

# カバレッジ
pnpm test -- --coverage
```

## テストファイル命名規則

- `*.test.ts` - ユニットテスト
- `*.spec.ts` - 結合テスト

## テスト構造

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('機能名', () => {
  describe('メソッド名', () => {
    it('should 期待される動作', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## 失敗時の対応

1. エラーメッセージを確認
2. 該当するテストファイルを読む
3. 実装コードを確認
4. 修正を適用
5. テストを再実行
