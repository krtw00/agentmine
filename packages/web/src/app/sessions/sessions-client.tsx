'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Session, SessionStatus } from '@agentmine/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SessionsClientProps = {
  sessions: Session[];
  stats: {
    counts: Record<SessionStatus, number>;
    runningCount: number;
    reviewQueueCount: number;
  };
};

type FilterId = 'all' | SessionStatus;

const statusMeta: Record<
  SessionStatus,
  { label: string; badge: string; dot: string }
> = {
  running: {
    label: '実行中',
    badge: 'bg-emerald-500/10 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  completed: {
    label: '完了',
    badge: 'bg-sky-500/10 text-sky-700',
    dot: 'bg-sky-500',
  },
  failed: {
    label: '失敗',
    badge: 'bg-rose-500/10 text-rose-700',
    dot: 'bg-rose-500',
  },
  cancelled: {
    label: 'キャンセル',
    badge: 'bg-amber-500/10 text-amber-700',
    dot: 'bg-amber-500',
  },
};

const formatDuration = (ms: number | null | undefined): string => {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}時間${minutes % 60}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
};

const formatDateTime = (date: Date | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }
  if (diffDays < 7) {
    return `${diffDays}日前`;
  }

  return d.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SessionsClient({ sessions, stats }: SessionsClientProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const filters = useMemo(() => {
    const totalCount = sessions.length;
    return [
      { id: 'all' as FilterId, label: 'すべて', count: totalCount },
      { id: 'running' as FilterId, label: '実行中', count: stats.counts.running },
      { id: 'completed' as FilterId, label: '完了', count: stats.counts.completed },
      { id: 'failed' as FilterId, label: '失敗', count: stats.counts.failed },
      { id: 'cancelled' as FilterId, label: 'キャンセル', count: stats.counts.cancelled },
    ];
  }, [sessions.length, stats.counts]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === activeFilter);
    }

    // Apply search
    const query = search.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((s) => {
        return (
          s.id.toString().includes(query) ||
          s.taskId?.toString().includes(query) ||
          s.agentName.toLowerCase().includes(query) ||
          s.worktreePath?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [sessions, activeFilter, search]);

  const runningSessions = useMemo(
    () => sessions.filter((s) => s.status === 'running'),
    [sessions]
  );

  const recentSessions = useMemo(
    () => sessions.filter((s) => s.status !== 'running').slice(0, 10),
    [sessions]
  );

  const sessionStats = useMemo(() => {
    const completedToday = sessions.filter((s) => {
      if (s.status !== 'completed' || !s.completedAt) return false;
      const completedDate = new Date(s.completedAt);
      const today = new Date();
      return completedDate.toDateString() === today.toDateString();
    });

    const failedThisWeek = sessions.filter((s) => {
      if (s.status !== 'failed' || !s.completedAt) return false;
      const completedDate = new Date(s.completedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return completedDate >= weekAgo;
    });

    const totalArtifacts = sessions.reduce(
      (sum, s) => sum + (s.artifacts?.length ?? 0),
      0
    );

    return [
      {
        label: '稼働中セッション',
        value: stats.runningCount.toString(),
        detail: `レビュー待ち${stats.reviewQueueCount}件`,
        className: 'from-emerald-200/70 via-emerald-50/70 to-transparent',
      },
      {
        label: '本日完了',
        value: completedToday.length.toString(),
        detail: completedToday.length > 0 ? `平均${formatDuration(completedToday.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / completedToday.length)}` : '-',
        className: 'from-sky-200/70 via-sky-50/70 to-transparent',
      },
      {
        label: '今週の失敗',
        value: failedThisWeek.length.toString(),
        detail: failedThisWeek.length > 0 ? `最後のエラーは${formatDateTime(failedThisWeek[0].completedAt)}` : '-',
        className: 'from-rose-200/70 via-rose-50/70 to-transparent',
      },
      {
        label: '成果物の追跡',
        value: totalArtifacts.toString(),
        detail: `${sessions.length}セッション分`,
        className: 'from-amber-200/70 via-amber-50/70 to-transparent',
      },
    ];
  }, [sessions, stats]);

  return (
    <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            セッション
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            セッション管制室
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            すべてのエージェント実行を追跡し、ボトルネックを素早く検知し、
            異常があればセッションログを掘り下げます。
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border bg-background/80 px-3 py-1">
              合計{sessions.length}セッション
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1">
              実行中{stats.runningCount}件
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1 font-mono">
              .agentmine/sessions
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">セッション開始</Button>
          <Button variant="outline" size="sm">
            レビュー待ち
          </Button>
          <Button variant="ghost" size="sm">
            ログをエクスポート
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border bg-card/70 p-6 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.16),transparent_55%),radial-gradient(circle_at_90%_10%,rgba(56,189,248,0.18),transparent_50%)]" />
        <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sessionStats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border bg-gradient-to-br ${stat.className} p-4 shadow-sm`}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="タスク、エージェント、セッションIDで検索"
              className="md:max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const isActive = filter.id === activeFilter;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? 'border-foreground/30 bg-foreground/10 text-foreground'
                        : 'border-transparent bg-background/80 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {filter.label} <span className="ml-1">({filter.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline">
              フィルタ
            </Button>
            <Button size="sm" variant="outline">
              新しい順
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  実行中
                </p>
                <h2 className="text-xl font-semibold">稼働中セッション</h2>
              </div>
              <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase">
                {runningSessions.length}件稼働中
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {runningSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  現在実行中のセッションはありません。
                </p>
              ) : (
                runningSessions.map((session) => {
                  const startTime = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
                  const duration = Date.now() - startTime;

                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            <p className="text-sm font-semibold">
                              {session.taskId ? `タスク #${session.taskId}` : `セッション #${session.id}`}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            エージェント: {session.agentName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/sessions/${session.id}`}>表示</Link>
                          </Button>
                          <Button variant="destructive" size="sm">
                            停止
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                        <div>
                          <p className="uppercase tracking-[0.2em]">開始</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatDateTime(session.startedAt)}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em]">所要時間</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatDuration(duration)}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em]">ワークツリー</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {session.worktreePath || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  最近
                </p>
                <h2 className="text-xl font-semibold">完了済みセッション</h2>
              </div>
              <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase">
                直近48時間
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  完了済みセッションはありません。
                </p>
              ) : (
                recentSessions.map((session) => {
                  const meta = statusMeta[session.status];
                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-2 w-2 rounded-full ${meta.dot}`}
                            />
                            <p className="text-sm font-semibold">
                              {session.taskId ? `タスク #${session.taskId}` : `セッション #${session.id}`}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            エージェント: {session.agentName} / 所要時間{' '}
                            {formatDuration(session.durationMs)} / 完了{' '}
                            {formatDateTime(session.completedAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                        <div>
                          <p className="uppercase tracking-[0.2em]">結果</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {session.dodResult || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em]">成果物</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {session.artifacts?.length ?? 0} 件
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em]">終了コード</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {session.exitCode ?? '-'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/sessions/${session.id}`}>表示</Link>
                        </Button>
                        <Button variant="ghost" size="sm">
                          削除
                        </Button>
                        {session.status === 'failed' ? (
                          <Button size="sm">再実行</Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  フィルタ結果
                </p>
                <h3 className="text-lg font-semibold">検索結果</h3>
              </div>
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                {filteredSessions.length} 件
              </span>
            </div>
            <div className="mt-4 max-h-[500px] space-y-2 overflow-auto">
              {filteredSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  条件に一致するセッションがありません。
                </p>
              ) : (
                filteredSessions.map((session) => {
                  const meta = statusMeta[session.status];
                  return (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className="block rounded-2xl border bg-background/80 p-3 text-sm transition hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`}
                          />
                          <p className="font-semibold">セッション #{session.id}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {session.agentName} / {formatDateTime(session.startedAt)}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                保持
              </p>
              <h3 className="text-lg font-semibold">セッションログの保管</h3>
              <p className="text-sm text-muted-foreground">
                ログはプロジェクトのデータベースに保存されます。保持期間は90日で、
                週次クリーンアップが実行されます。
              </p>
            </div>
            <div className="mt-4 rounded-2xl border bg-background/80 p-4 text-sm">
              <p className="font-semibold">保持ポリシー</p>
              <p className="text-xs text-muted-foreground">
                クリーンアップは毎週日曜02:00に実行されます。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  ポリシー編集
                </Button>
                <Button size="sm" variant="ghost">
                  クリーンアップ実行
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
