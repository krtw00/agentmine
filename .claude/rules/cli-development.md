---
paths:
  - "packages/cli/**/*.ts"
---

# CLI開発ルール

## Commander.js パターン

```typescript
import { Command } from 'commander';

export const taskCommand = new Command('task')
  .description('タスク管理');

taskCommand
  .command('add <title>')
  .description('タスクを作成')
  .option('-p, --priority <level>', '優先度', 'medium')
  .option('--json', 'JSON出力')
  .action(async (title, options) => {
    // 実装
  });
```

## 出力フォーマット

3種類の出力モードをサポート:

1. **通常**: 人間向け（カラー、テーブル）
2. **--json**: AI向け（構造化データ）
3. **--quiet**: 最小出力（パイプ用、IDのみ等）

```typescript
function formatOutput(data: Task, options: { json?: boolean; quiet?: boolean }) {
  if (options.json) return JSON.stringify(data);
  if (options.quiet) return String(data.id);
  return formatHumanReadable(data);
}
```

## Exit Codes

| Code | 意味 |
|------|------|
| 0 | 成功 |
| 1 | 一般エラー |
| 2 | 引数エラー |
| 3 | 設定エラー |
| 4 | DBエラー |
| 5 | リソース不存在 |
| 6 | 状態エラー |

## MCPとの一貫性

MCPツールはCLIのラッパー。CLIで実装した機能はMCPでも同じ動作を保証する。
