'use client';

import { useMemo, useState } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskType } from '@agentmine/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TasksClientProps = {
  tasks: Task[];
};

type SortOption = 'updated-desc' | 'priority-desc' | 'created-desc' | 'title-asc';

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: '未着手',
  in_progress: '進行中',
  done: '完了',
  failed: '失敗',
  cancelled: 'キャンセル',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '緊急',
};

const TYPE_LABELS: Record<TaskType, string> = {
  task: 'タスク',
  feature: '機能',
  bug: '不具合',
  refactor: 'リファクタ',
};

const statusTone: Record<TaskStatus, string> = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  done: 'border-slate-200 bg-slate-100 text-slate-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
};

const priorityTone: Record<TaskPriority, string> = {
  critical: 'border-rose-300 bg-rose-100 text-rose-800',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-100 text-slate-700',
};

const formatDate = (date: Date | number | null | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return '数分前';
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
};

export default function TasksClient({ tasks: initialTasks }: TasksClientProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(
    initialTasks[0]?.id ?? null
  );

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...initialTasks];

    // Search filter
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter((task) => {
        return (
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.assigneeName?.toLowerCase().includes(query)
        );
      });
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter) {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter((task) => task.type === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated-desc': {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        }
        case 'priority-desc': {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        case 'created-desc': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }
        case 'title-asc':
          return a.title.localeCompare(b.title, 'ja');
        default:
          return 0;
      }
    });

    return filtered;
  }, [initialTasks, search, statusFilter, priorityFilter, typeFilter, sortBy]);

  const selectedTask = useMemo(
    () => filteredAndSortedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [filteredAndSortedTasks, selectedTaskId]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      open: 0,
      in_progress: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const task of initialTasks) {
      counts[task.status]++;
    }
    return counts;
  }, [initialTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">タスク</h1>
          <p className="text-muted-foreground">
            ワークスペース内のタスクを管理し、絞り込みや優先順位付けを行います。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">インポート</Button>
          <Button variant="secondary">一括編集</Button>
          <Button>新規タスク</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                検索
              </p>
              <Input
                placeholder="タイトル、担当者で絞り込み"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                ステータス
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
              >
                <option value="">すべてのステータス</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                優先度
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
              >
                <option value="">すべての優先度</option>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                種別
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TaskType | '')}
              >
                <option value="">すべての種別</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                並び替え
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="updated-desc">更新日 (新しい順)</option>
                <option value="priority-desc">優先度 (高→低)</option>
                <option value="created-desc">作成日 (新しい順)</option>
                <option value="title-asc">タイトル (昇順)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary">
              リスト
            </Button>
            <Button size="sm" variant="outline">
              ボード
            </Button>
            <Button size="sm" variant="outline">
              階層
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>タスク {initialTasks.length}件</span>
          <span>未着手 {statusCounts.open}件</span>
          <span>進行中 {statusCounts.in_progress}件</span>
          <span>完了 {statusCounts.done}件</span>
          <span>失敗 {statusCounts.failed}件</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">タスク一覧</h2>
                <p className="text-xs text-muted-foreground">
                  {initialTasks.length}件中{filteredAndSortedTasks.length}
                  件を表示しています。
                </p>
              </div>
              <Button size="sm" variant="outline">
                CSVエクスポート
              </Button>
            </div>
            <div className="overflow-auto">
              {filteredAndSortedTasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  条件に一致するタスクがありません。
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">タスク</th>
                      <th className="px-4 py-2 text-left">ステータス</th>
                      <th className="px-4 py-2 text-left">優先度</th>
                      <th className="px-4 py-2 text-left">種別</th>
                      <th className="px-4 py-2 text-left">担当者</th>
                      <th className="px-4 py-2 text-left">更新</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedTasks.map((task) => (
                      <tr
                        key={task.id}
                        className={cn(
                          'cursor-pointer border-t transition hover:bg-muted/20',
                          selectedTaskId === task.id && 'bg-accent/50'
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">
                                #{task.id}
                              </span>
                              <span className="font-medium">{task.title}</span>
                            </div>
                            {task.labels && task.labels.length > 0 && (
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {task.labels.map((label) => (
                                  <span
                                    key={`${task.id}-${label}`}
                                    className="rounded-full border border-border bg-background px-2 py-0.5"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              statusTone[task.status]
                            )}
                          >
                            {STATUS_LABELS[task.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              priorityTone[task.priority]
                            )}
                          >
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {TYPE_LABELS[task.type]}
                        </td>
                        <td className="px-4 py-3">
                          {task.assigneeName ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(task.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedTask ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    タスク詳細
                  </p>
                  <h3 className="text-lg font-semibold">
                    #{selectedTask.id} · {selectedTask.title}
                  </h3>
                </div>
                <Button size="sm" variant="outline">
                  編集
                </Button>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                      statusTone[selectedTask.status]
                    )}
                  >
                    {STATUS_LABELS[selectedTask.status]}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                      priorityTone[selectedTask.priority]
                    )}
                  >
                    {PRIORITY_LABELS[selectedTask.priority]}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold">
                    {TYPE_LABELS[selectedTask.type]}
                  </span>
                </div>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.description}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">担当者</p>
                    <p className="font-medium">
                      {selectedTask.assigneeName ?? '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">担当タイプ</p>
                    <p className="font-medium">
                      {selectedTask.assigneeType === 'ai'
                        ? 'AI'
                        : selectedTask.assigneeType === 'human'
                          ? '人間'
                          : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ブランチ</p>
                    <p className="font-medium">
                      {selectedTask.branchName ?? '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最終更新</p>
                    <p className="font-medium">
                      {formatDate(selectedTask.updatedAt)}
                    </p>
                  </div>
                  {selectedTask.complexity && (
                    <div>
                      <p className="text-xs text-muted-foreground">複雑度</p>
                      <p className="font-medium">{selectedTask.complexity}/10</p>
                    </div>
                  )}
                  {selectedTask.prUrl && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">PR URL</p>
                      <a
                        href={selectedTask.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {selectedTask.prUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm">セッション開始</Button>
                <Button size="sm" variant="outline">
                  履歴を見る
                </Button>
                <Button size="sm" variant="ghost">
                  タスクリンクをコピー
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                タスクを選択して詳細を表示します。
              </p>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  作成/編集
                </p>
                <h3 className="text-lg font-semibold">タスクフォーム</h3>
              </div>
              <Button size="sm" variant="secondary">
                下書きを保存
              </Button>
            </div>
            <form className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  タイトル
                </label>
                <Input placeholder="タスクのタイトルを入力" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    ステータス
                  </label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    優先度
                  </label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    種別
                  </label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    担当者
                  </label>
                  <Input placeholder="担当者名" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  説明
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="タスクの説明を入力"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    ブランチ
                  </label>
                  <Input placeholder="task-123-feature-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    複雑度 (1-10)
                  </label>
                  <Input type="number" min="1" max="10" placeholder="5" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button">タスクを保存</Button>
                <Button type="button" variant="outline">
                  キャンセル
                </Button>
                <Button type="button" variant="ghost">
                  複製
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
