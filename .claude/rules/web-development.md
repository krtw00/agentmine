---
paths:
  - "packages/web/**/*.ts"
  - "packages/web/**/*.tsx"
---

# Web UI開発ルール

## Next.js App Router

```
src/app/
├── layout.tsx      # ルートレイアウト
├── page.tsx        # ダッシュボード
├── tasks/
│   ├── page.tsx    # タスク一覧
│   └── [id]/
│       └── page.tsx # タスク詳細
└── api/
    └── tasks/
        └── route.ts # API Route
```

## コンポーネント構成

```typescript
// Server Component (default)
export default async function TasksPage() {
  const tasks = await taskService.listTasks();
  return <TaskList tasks={tasks} />;
}

// Client Component (必要な場合のみ)
'use client';
export function TaskCard({ task }: { task: Task }) {
  const [isEditing, setIsEditing] = useState(false);
  // ...
}
```

## shadcn/ui

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export function TaskCard({ task }: { task: Task }) {
  return (
    <Card>
      <CardHeader>{task.title}</CardHeader>
      <CardContent>
        <Button variant="outline">Edit</Button>
      </CardContent>
    </Card>
  );
}
```

## Tailwind CSS

- ユーティリティクラスを直接使用
- カスタムCSSは最小限に
- レスポンシブ: `sm:`, `md:`, `lg:`プレフィックス

## API Routes

@agentmine/coreのサービスを呼び出す:

```typescript
// app/api/tasks/route.ts
import { taskService } from '@agentmine/core';

export async function GET() {
  const tasks = await taskService.listTasks();
  return Response.json(tasks);
}
```
