import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SessionStatus = "running" | "completed" | "failed" | "cancelled";
type RecentStatus = Exclude<SessionStatus, "running">;

const filters = [
  { id: "all", label: "すべて", count: 18 },
  { id: "running", label: "実行中", count: 2 },
  { id: "completed", label: "完了", count: 12 },
  { id: "failed", label: "失敗", count: 3 },
  { id: "cancelled", label: "キャンセル", count: 1 },
];

const sessionStats = [
  {
    label: "稼働中セッション",
    value: "2",
    detail: "レビュー待ち1件",
    className: "from-emerald-200/70 via-emerald-50/70 to-transparent",
  },
  {
    label: "本日完了",
    value: "6",
    detail: "中央値 9分12秒",
    className: "from-sky-200/70 via-sky-50/70 to-transparent",
  },
  {
    label: "今週の失敗",
    value: "1",
    detail: "最後のエラーは2日前",
    className: "from-rose-200/70 via-rose-50/70 to-transparent",
  },
  {
    label: "成果物の追跡",
    value: "23",
    detail: "4タスク分",
    className: "from-amber-200/70 via-amber-50/70 to-transparent",
  },
];

const runningSessions = [
  {
    id: 118,
    taskId: 42,
    taskTitle: "ログインエンドポイント追加",
    agent: "coder",
    model: "claude-code / opus",
    startedAt: "今日 14:30",
    duration: "12分12秒",
    worktree: "task-42-add-login",
    activity: "認証ハンドラを同期中",
    progress: 72,
  },
  {
    id: 117,
    taskId: 37,
    taskTitle: "請求同期のリファクタ",
    agent: "reviewer",
    model: "claude-code / sonnet",
    startedAt: "今日 14:22",
    duration: "5分08秒",
    worktree: "task-37-billing-sync",
    activity: "対象テストを実行中",
    progress: 46,
  },
];

const recentSessions: Array<{
  id: number;
  taskId: number;
  taskTitle: string;
  agent: string;
  duration: string;
  completedAt: string;
  status: RecentStatus;
  outcome: string;
  artifacts: number;
  summary: string;
}> = [
  {
    id: 116,
    taskId: 33,
    taskTitle: "データベーススキーマ設定",
    agent: "coder",
    duration: "12分04秒",
    completedAt: "今日 12:10",
    status: "completed",
    outcome: "マージ",
    artifacts: 3,
    summary: "スキーマ移行 + リポジトリフック",
  },
  {
    id: 115,
    taskId: 29,
    taskTitle: "認証タイムアウトの不具合修正",
    agent: "coder",
    duration: "8分47秒",
    completedAt: "昨日 18:24",
    status: "failed",
    outcome: "タイムアウト",
    artifacts: 1,
    summary: "API再試行ループが制限時間に到達",
  },
  {
    id: 114,
    taskId: 27,
    taskTitle: "リリースノート準備",
    agent: "planner",
    duration: "4分12秒",
    completedAt: "昨日 17:02",
    status: "cancelled",
    outcome: "手動停止",
    artifacts: 0,
    summary: "実行中にスコープ変更",
  },
];

const activityFeed = [
  {
    time: "14:44",
    label: "成果物を記録",
    detail: "セッション #118 が2ファイル追加",
  },
  {
    time: "14:39",
    label: "セッションを一時停止",
    detail: "セッション #117 承認待ち",
  },
  {
    time: "12:10",
    label: "セッション完了",
    detail: "セッション #116 が main にマージ",
  },
  {
    time: "11:55",
    label: "ワーカー起動",
    detail: "セッション #118 が worker-2 で実行中",
  },
];

const reviewQueue = [
  {
    id: 118,
    taskTitle: "ログインエンドポイント追加",
    agent: "coder",
    eta: "残り3分",
  },
  {
    id: 112,
    taskTitle: "テレメトリ更新",
    agent: "reviewer",
    eta: "トリアージ待ち",
  },
];

const statusMeta: Record<
  RecentStatus,
  { label: string; badge: string; dot: string }
> = {
  completed: {
    label: "完了",
    badge: "bg-emerald-500/10 text-emerald-700",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "失敗",
    badge: "bg-rose-500/10 text-rose-700",
    dot: "bg-rose-500",
  },
  cancelled: {
    label: "キャンセル",
    badge: "bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
};

export default function SessionsPage() {
  const activeFilterId = "all";

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
              合計18セッション
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1">
              実行中2件
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
            />
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const isActive = filter.id === activeFilterId;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? "border-foreground/30 bg-foreground/10 text-foreground"
                        : "border-transparent bg-background/80 text-muted-foreground hover:border-border hover:text-foreground"
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
              {runningSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border bg-background/80 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        <p className="text-sm font-semibold">
                          タスク #{session.taskId}: {session.taskTitle}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        エージェント: {session.agent} / {session.model}
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
                        {session.startedAt}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em]">所要時間</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {session.duration}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em]">ワークツリー</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {session.worktree}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        現在の作業
                      </span>
                      <span className="font-medium text-foreground">
                        {session.activity}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
              {recentSessions.map((session) => {
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
                            タスク #{session.taskId}: {session.taskTitle}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          エージェント: {session.agent} / 所要時間{" "}
                          {session.duration} / 完了 {session.completedAt}
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
                          {session.outcome}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.2em]">成果物</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {session.artifacts} 件
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.2em]">概要</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {session.summary}
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
                      {session.status === "failed" ? (
                        <Button size="sm">再実行</Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  アクティビティ
                </p>
                <h3 className="text-lg font-semibold">最新イベント</h3>
              </div>
              <Button size="sm" variant="outline">
                フィードを見る
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {activityFeed.map((event) => (
                <div
                  key={`${event.time}-${event.label}`}
                  className="rounded-2xl border bg-background/80 p-3 text-sm"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{event.time}</span>
                    <span className="rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      イベント
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border bg-card/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  レビュー待ち
                </p>
                <h3 className="text-lg font-semibold">確認対象セッション</h3>
              </div>
              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                {reviewQueue.length} 件
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {reviewQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border bg-background/80 p-4 text-sm"
                >
                  <p className="font-semibold">
                    セッション #{item.id} / {item.taskTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    エージェント: {item.agent} / {item.eta}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/sessions/${item.id}`}>開く</Link>
                    </Button>
                    <Button size="sm" variant="ghost">
                      承認
                    </Button>
                  </div>
                </div>
              ))}
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
                クリーンアップは毎週日曜02:00に実行されます。次の7日で14セッションが
                期限切れになります。
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
