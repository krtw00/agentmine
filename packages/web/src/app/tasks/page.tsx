import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const tasks = [
  {
    id: "T-104",
    title: "認証ミドルウェアを実装",
    status: "進行中",
    priority: "高",
    type: "機能",
    assignee: "Nora",
    eta: "3月12日",
    updated: "2時間前",
    labels: ["API", "セキュリティ"],
    subtasks: 3,
  },
  {
    id: "T-103",
    title: "タスク詳細パネルを設計",
    status: "未着手",
    priority: "中",
    type: "デザイン",
    assignee: "Ken",
    eta: "3月14日",
    updated: "5時間前",
    labels: ["UX", "UI"],
    subtasks: 2,
  },
  {
    id: "T-102",
    title: "セッション取消の競合を修正",
    status: "ブロック中",
    priority: "高",
    type: "不具合",
    assignee: "Liu",
    eta: "3月10日",
    updated: "1日前",
    labels: ["ランタイム"],
    subtasks: 0,
  },
  {
    id: "T-101",
    title: "オンボーディング資料を下書き",
    status: "完了",
    priority: "低",
    type: "ドキュメント",
    assignee: "Ari",
    eta: "3月6日",
    updated: "3日前",
    labels: ["ドキュメント"],
    subtasks: 0,
  },
  {
    id: "T-100",
    title: "タスクフィルターを接続",
    status: "進行中",
    priority: "中",
    type: "機能",
    assignee: "Mia",
    eta: "3月11日",
    updated: "6時間前",
    labels: ["Web UI"],
    subtasks: 4,
  },
];

const statusTone: Record<string, string> = {
  未着手: "border-emerald-200 bg-emerald-50 text-emerald-700",
  進行中: "border-amber-200 bg-amber-50 text-amber-700",
  ブロック中: "border-rose-200 bg-rose-50 text-rose-700",
  完了: "border-slate-200 bg-slate-100 text-slate-700",
};

const priorityTone: Record<string, string> = {
  高: "border-rose-200 bg-rose-50 text-rose-700",
  中: "border-amber-200 bg-amber-50 text-amber-700",
  低: "border-slate-200 bg-slate-100 text-slate-700",
};

const selectedTask = tasks[0];

export default function TasksPage() {
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
              <Input placeholder="タイトル、担当者、ラベルで絞り込み" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                ステータス
              </p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option>すべてのステータス</option>
                <option>未着手</option>
                <option>進行中</option>
                <option>ブロック中</option>
                <option>完了</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                優先度
              </p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option>すべての優先度</option>
                <option>高</option>
                <option>中</option>
                <option>低</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                種別
              </p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option>すべての種別</option>
                <option>機能</option>
                <option>不具合</option>
                <option>デザイン</option>
                <option>ドキュメント</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                並び替え
              </p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option>更新日 (新しい順)</option>
                <option>優先度 (高→低)</option>
                <option>期限 (近い順)</option>
                <option>タイトル (昇順)</option>
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
          <span>タスク 12件</span>
          <span>未着手 4件</span>
          <span>進行中 3件</span>
          <span>ブロック中 1件</span>
          <span>完了 4件</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">タスク一覧</h2>
                <p className="text-xs text-muted-foreground">
                  12件中5件を表示しています。
                </p>
              </div>
              <Button size="sm" variant="outline">
                CSVエクスポート
              </Button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">タスク</th>
                    <th className="px-4 py-2 text-left">ステータス</th>
                    <th className="px-4 py-2 text-left">優先度</th>
                    <th className="px-4 py-2 text-left">種別</th>
                    <th className="px-4 py-2 text-left">担当者</th>
                    <th className="px-4 py-2 text-left">期限</th>
                    <th className="px-4 py-2 text-left">更新</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-t transition hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {task.id}
                            </span>
                            <span className="font-medium">{task.title}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {task.labels.map((label) => (
                              <span
                                key={`${task.id}-${label}`}
                                className="rounded-full border border-border bg-background px-2 py-0.5"
                              >
                                {label}
                              </span>
                            ))}
                            {task.subtasks > 0 ? (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5">
                                サブタスク {task.subtasks}件
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[task.status] ?? ""}`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityTone[task.priority] ?? ""}`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {task.type}
                      </td>
                      <td className="px-4 py-3">{task.assignee}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {task.eta}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {task.updated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  タスク詳細
                </p>
                <h3 className="text-lg font-semibold">
                  {selectedTask.id} · {selectedTask.title}
                </h3>
              </div>
              <Button size="sm" variant="outline">
                編集
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[selectedTask.status] ?? ""}`}
                >
                  {selectedTask.status}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityTone[selectedTask.priority] ?? ""}`}
                >
                  {selectedTask.priority}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold">
                  {selectedTask.type}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                セッショントークンを検証し、期限切れの認証情報を更新し、エラーをオーケストレーターに通知するAPIレイヤーを構築します。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">担当者</p>
                  <p className="font-medium">{selectedTask.assignee}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">期限</p>
                  <p className="font-medium">{selectedTask.eta}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ブランチ</p>
                  <p className="font-medium">task-104-auth-middleware</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">最終更新</p>
                  <p className="font-medium">{selectedTask.updated}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                サブタスク
              </p>
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-center justify-between">
                    <span>JWT検証フローを定義</span>
                    <span className="text-xs text-muted-foreground">
                      進行中
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>トークン更新を文書化</span>
                    <span className="text-xs text-muted-foreground">未着手</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>セッションエラー処理を更新</span>
                    <span className="text-xs text-muted-foreground">
                      ブロック中
                    </span>
                  </li>
                </ul>
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
                <Input defaultValue="認証ミドルウェアを実装" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    ステータス
                  </label>
                  <select
                    defaultValue="進行中"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option>未着手</option>
                    <option>進行中</option>
                    <option>ブロック中</option>
                    <option>完了</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    優先度
                  </label>
                  <select
                    defaultValue="中"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option>高</option>
                    <option>中</option>
                    <option>低</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    種別
                  </label>
                  <select
                    defaultValue="機能"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option>機能</option>
                    <option>不具合</option>
                    <option>デザイン</option>
                    <option>ドキュメント</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    期限
                  </label>
                  <Input defaultValue="3月12日" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  説明
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="セッショントークンを検証し、認証情報を更新し、失敗時にオーケストレーターへ通知します。"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    担当者
                  </label>
                  <Input defaultValue="Nora" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    ブランチ
                  </label>
                  <Input defaultValue="task-104-auth-middleware" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="size-4 rounded border border-input"
                  />
                  レビュー承認を必須にする
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-input"
                  />
                  保存時に担当者へ通知
                </label>
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
