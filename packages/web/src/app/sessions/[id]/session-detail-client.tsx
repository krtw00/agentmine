'use client';

import Link from 'next/link';
import type { Session, SessionStatus } from '@agentmine/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SessionDetailClientProps = {
  session: Session;
  task: any;
};

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
    return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
};

const formatDateTime = (date: Date | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function SessionDetailClient({ session, task }: SessionDetailClientProps) {
  const status = statusMeta[session.status];

  const runtimeSignals = [
    { label: 'Worker', value: session.worktreePath || '-' },
    { label: 'PID', value: session.pid ? session.pid.toString() : '-' },
    { label: 'Exit code', value: session.exitCode?.toString() ?? '-' },
    { label: 'Signal', value: session.signal ?? '-' },
    { label: 'DoD result', value: session.dodResult ?? 'pending' },
    {
      label: 'Artifacts',
      value: `${session.artifacts?.length ?? 0} file${
        (session.artifacts?.length ?? 0) === 1 ? '' : 's'
      }`,
    },
  ];

  return (
    <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
      <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-6 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.16),transparent_55%),radial-gradient(circle_at_90%_10%,rgba(248,113,113,0.12),transparent_50%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Session
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Session #{session.id}
            </h1>
            <p className="text-sm text-muted-foreground">
              {task ? (
                <>
                  Task #{session.taskId}: {task.title}
                </>
              ) : (
                <>Task #{session.taskId}</>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${status.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1">
                Agent: {session.agentName}
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1">
                Started {formatDateTime(session.startedAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/sessions">Back to sessions</Link>
            </Button>
            {session.taskId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tasks/${session.taskId}`}>View task</Link>
              </Button>
            )}
            {session.status === 'running' && (
              <Button variant="destructive" size="sm">
                Cancel session
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Overview
                </p>
                <h2 className="text-lg font-semibold">Session summary</h2>
              </div>
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                {session.status === 'running' ? 'live' : 'closed'}
              </span>
            </div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Duration
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatDuration(session.durationMs)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.status === 'running'
                    ? 'Updating while session runs.'
                    : 'Session completed.'}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Worktree
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {session.worktreePath || '-'}
                </p>
                <p className="text-xs text-muted-foreground">Base branch main</p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  DoD Result
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {session.dodResult || 'pending'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.reviewStatus === 'pending'
                    ? 'Awaiting reviewer decision'
                    : session.reviewStatus}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Exit status
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {session.exitCode?.toString() ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Signal {session.signal ?? '-'}
                </p>
              </div>
            </div>
            {session.reviewComment && (
              <div className="mt-4 rounded-2xl border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Review comment
                </p>
                <p className="mt-2 text-sm font-medium">{session.reviewComment}</p>
                {session.reviewedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    By {session.reviewedBy} at {formatDateTime(session.reviewedAt)}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Artifacts
                </p>
                <h2 className="text-lg font-semibold">Changed files</h2>
              </div>
              <Button size="sm" variant="outline">
                View diff
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {!session.artifacts || session.artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files captured yet.
                </p>
              ) : (
                session.artifacts.map((artifact: string, index: number) => (
                  <div
                    key={`${artifact}-${index}`}
                    className="rounded-2xl border bg-background/80 px-3 py-2 font-mono text-xs"
                  >
                    {artifact}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Errors
                </p>
                <h2 className="text-lg font-semibold">Failure details</h2>
              </div>
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                {session.error ? 'error' : 'none'}
              </span>
            </div>
            <div className="mt-4 rounded-2xl border bg-background/80 p-4 text-sm">
              {session.error ? (
                <div className="space-y-2">
                  <p className="font-semibold">{session.error.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {session.error.message}
                  </p>
                  {session.error.details ? (
                    <div className="mt-2 rounded border bg-muted/50 p-2 font-mono text-xs">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(session.error.details, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No error recorded for this session.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Log stream
                </p>
                <h2 className="text-lg font-semibold">Session log</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  Live tail
                </Button>
                <Button size="sm" variant="outline">
                  Export
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <Input placeholder="Filter by keyword" className="md:max-w-xs" />
            </div>
            <div className="mt-4 h-[420px] overflow-auto rounded-2xl border bg-background/80 p-4 font-mono text-xs">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Session log streaming not yet implemented.
                </p>
                <p className="text-muted-foreground">
                  Session #{session.id} started at {formatDateTime(session.startedAt)}
                </p>
                {session.completedAt && (
                  <p className="text-muted-foreground">
                    Completed at {formatDateTime(session.completedAt)}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Signals
              </p>
              <h2 className="text-lg font-semibold">Runtime telemetry</h2>
              <p className="text-sm text-muted-foreground">
                Signals reported by the orchestrator while the session runs.
              </p>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {runtimeSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-2xl border bg-background/80 p-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {signal.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{signal.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
