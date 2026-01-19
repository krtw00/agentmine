import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const memoryTree = [
  {
    category: "アーキテクチャ",
    hint: "基盤設計の決定事項",
    files: [
      {
        path: "architecture/001-monorepo.md",
        title: "モノレポ構成",
        updated: "3日前",
        status: "運用中",
      },
      {
        path: "architecture/002-database.md",
        title: "データベース方針",
        updated: "2週間前",
        status: "安定",
      },
    ],
  },
  {
    category: "ツール",
    hint: "採用ツール",
    files: [
      {
        path: "tooling/001-testing.md",
        title: "テストフレームワーク",
        updated: "5日前",
        status: "下書き",
      },
      {
        path: "tooling/002-lint.md",
        title: "Lintルール",
        updated: "1か月前",
        status: "安定",
      },
    ],
  },
  {
    category: "規約",
    hint: "チーム規約",
    files: [
      {
        path: "convention/001-commit-format.md",
        title: "コミット形式",
        updated: "3週間前",
        status: "安定",
      },
    ],
  },
  {
    category: "ルール",
    hint: "必須ルール",
    files: [
      {
        path: "rule/001-tests-required.md",
        title: "テスト必須",
        updated: "4日前",
        status: "運用中",
      },
    ],
  },
];

const selectedPath = "architecture/001-monorepo.md";

const editorContent = `---
title: モノレポ構成
category: architecture
created: 2025-02-12
updated: 2025-03-03
---

# モノレポ構成

## 決定事項

CLI・core・web の各パッケージに pnpm workspaces と Turborepo を採用する。

## 理由

- CLI・core・web で型を共有できる。
- Turborepo によるビルドキャッシュが効く。
- ツールとスクリプトを一箇所で管理できる。

## 参考リンク

- https://turbo.build/
`;

export default function MemoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Memory Bank
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            共有した決定事項を、すぐに再利用
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            構造化された Markdown で知識を整理し、実行前にエージェントへ渡る
            コンテキストをプレビューします。
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border bg-background/80 px-3 py-1">
              カテゴリ 4件
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1">
              エントリ 6件
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1 font-mono">
              .agentmine/memory
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">新規メモリ</Button>
          <Button variant="outline" size="sm">
            新規フォルダ
          </Button>
          <Button variant="ghost" size="sm">
            コンテキストをプレビュー
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-6 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.16),transparent_55%),radial-gradient(circle_at_90%_10%,rgba(249,115,22,0.18),transparent_45%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">ライブラリ</p>
                  <span className="text-xs text-muted-foreground">
                    下書き 2件
                  </span>
                </div>
                <Input placeholder="メモリを検索" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    すべて
                  </Button>
                  <Button variant="ghost" size="sm">
                    運用中
                  </Button>
                  <Button variant="ghost" size="sm">
                    下書き
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <div className="space-y-6">
                {memoryTree.map((group) => (
                  <div key={group.category} className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{group.category}</span>
                      <span className="rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase">
                        {group.files.length} 件
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {group.hint}
                    </p>
                    <div className="space-y-2">
                      {group.files.map((file) => {
                        const isActive = file.path === selectedPath;
                        return (
                          <button
                            key={file.path}
                            type="button"
                            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                              isActive
                                ? "border-foreground/20 bg-foreground/5 shadow-sm"
                                : "border-transparent bg-background/60 hover:border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  {file.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {file.path}
                                </p>
                              </div>
                              <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {file.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              更新 {file.updated}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-2xl border bg-background/80 p-5 backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-dashed pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      アーキテクチャ
                    </p>
                    <h2 className="text-2xl font-semibold">
                      モノレポ構成
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      プラットフォーム構成に関する決定事項の唯一の参照元。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm">保存</Button>
                    <Button variant="outline" size="sm">
                      複製
                    </Button>
                    <Button variant="ghost" size="sm">
                      削除
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-background/80 px-2 py-1 font-mono">
                    architecture/001-monorepo.md
                  </span>
                  <span className="rounded-full border bg-background/80 px-2 py-1">
                    作成日 2025-02-12
                  </span>
                  <span className="rounded-full border bg-background/80 px-2 py-1">
                    更新日 2025-03-03
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">エディタ</p>
                    <span className="text-xs text-muted-foreground">
                      Markdown
                    </span>
                  </div>
                  <textarea
                    className="mt-3 h-[360px] w-full resize-none rounded-xl border bg-background/80 p-3 font-mono text-xs leading-5 text-foreground shadow-inner focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    defaultValue={editorContent}
                  />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>1行目 / 24行</span>
                    <span>自動保存 有効</span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">プレビュー</p>
                    <span className="text-xs text-muted-foreground">
                      レンダリング
                    </span>
                  </div>
                  <div className="mt-4 space-y-4 text-sm leading-6">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        フロントマター
                      </p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        title: モノレポ構成
                        <br />
                        category: architecture
                        <br />
                        created: 2025-02-12
                        <br />
                        updated: 2025-03-03
                      </p>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">
                        モノレポ構成
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        CLI・core・web の各パッケージに pnpm workspaces と
                        Turborepo を採用する。
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        理由
                      </h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>パッケージ間で型を共有。</li>
                        <li>Turborepo でビルドをキャッシュ。</li>
                        <li>スクリプト管理を一箇所に集約。</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        参考リンク
                      </h4>
                      <div className="mt-2 rounded-xl border bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
                        https://turbo.build/
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    コンテキストプレビュー
                  </p>
                  <p className="text-xs text-muted-foreground">
                    セッション開始時にエージェントへ送る統合コンテキスト。
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  コピー
                </Button>
              </div>
              <div className="mt-4 rounded-2xl border bg-card p-4 font-mono text-xs leading-5 text-muted-foreground">
                <p className="text-foreground">## プロジェクト決定事項</p>
                <p className="mt-2">### アーキテクチャ</p>
                <p>- モノレポ構成: pnpm + Turborepo</p>
                <p className="mt-2">### ツール</p>
                <p>- テストフレームワーク: Vitest</p>
                <p className="mt-2">### ルール</p>
                <p>- テスト必須: 回帰カバレッジ追加</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
