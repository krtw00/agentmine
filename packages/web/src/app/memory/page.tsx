import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const memoryTree = [
  {
    category: "architecture",
    hint: "core decisions",
    files: [
      {
        path: "architecture/001-monorepo.md",
        title: "Monorepo Architecture",
        updated: "3 days ago",
        status: "active",
      },
      {
        path: "architecture/002-database.md",
        title: "Database Strategy",
        updated: "2 weeks ago",
        status: "stable",
      },
    ],
  },
  {
    category: "tooling",
    hint: "toolchain picks",
    files: [
      {
        path: "tooling/001-testing.md",
        title: "Testing Framework",
        updated: "5 days ago",
        status: "draft",
      },
      {
        path: "tooling/002-lint.md",
        title: "Linting Rules",
        updated: "1 month ago",
        status: "stable",
      },
    ],
  },
  {
    category: "convention",
    hint: "team conventions",
    files: [
      {
        path: "convention/001-commit-format.md",
        title: "Commit Format",
        updated: "3 weeks ago",
        status: "stable",
      },
    ],
  },
  {
    category: "rule",
    hint: "required rules",
    files: [
      {
        path: "rule/001-tests-required.md",
        title: "Tests Required",
        updated: "4 days ago",
        status: "active",
      },
    ],
  },
];

const selectedPath = "architecture/001-monorepo.md";

const editorContent = `---
title: Monorepo Architecture
category: architecture
created: 2025-02-12
updated: 2025-03-03
---

# Monorepo Architecture

## Decision

Use pnpm workspaces with Turborepo for CLI, core, and web packages.

## Reason

- Shared types across CLI, core, and web.
- Cached builds with Turborepo.
- Single place to manage tooling and scripts.

## References

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
            Shared decisions, instantly reusable
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Curate project knowledge as structured markdown and preview the
            context your agents receive before a run starts.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border bg-background/80 px-3 py-1">
              4 categories
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1">
              6 entries
            </span>
            <span className="rounded-full border bg-background/80 px-3 py-1 font-mono">
              .agentmine/memory
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">New Memory</Button>
          <Button variant="outline" size="sm">
            New Folder
          </Button>
          <Button variant="ghost" size="sm">
            Preview Context
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
                  <p className="text-sm font-semibold">Library</p>
                  <span className="text-xs text-muted-foreground">
                    2 drafts
                  </span>
                </div>
                <Input placeholder="Search memories" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    All
                  </Button>
                  <Button variant="ghost" size="sm">
                    Active
                  </Button>
                  <Button variant="ghost" size="sm">
                    Draft
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
                        {group.files.length} files
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
                              Updated {file.updated}
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
                      architecture
                    </p>
                    <h2 className="text-2xl font-semibold">
                      Monorepo Architecture
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Single source of truth for decisions tied to platform
                      structure.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm">Save</Button>
                    <Button variant="outline" size="sm">
                      Duplicate
                    </Button>
                    <Button variant="ghost" size="sm">
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-background/80 px-2 py-1 font-mono">
                    architecture/001-monorepo.md
                  </span>
                  <span className="rounded-full border bg-background/80 px-2 py-1">
                    Created 2025-02-12
                  </span>
                  <span className="rounded-full border bg-background/80 px-2 py-1">
                    Updated 2025-03-03
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Editor</p>
                    <span className="text-xs text-muted-foreground">
                      Markdown
                    </span>
                  </div>
                  <textarea
                    className="mt-3 h-[360px] w-full resize-none rounded-xl border bg-background/80 p-3 font-mono text-xs leading-5 text-foreground shadow-inner focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    defaultValue={editorContent}
                  />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Line 1 of 24</span>
                    <span>Autosave enabled</span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Preview</p>
                    <span className="text-xs text-muted-foreground">
                      Rendered
                    </span>
                  </div>
                  <div className="mt-4 space-y-4 text-sm leading-6">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Front matter
                      </p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        title: Monorepo Architecture
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
                        Monorepo Architecture
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Use pnpm workspaces with Turborepo for CLI, core, and
                        web packages.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Reason
                      </h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>Shared types across packages.</li>
                        <li>Cached builds with Turborepo.</li>
                        <li>Single place to manage scripts.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        References
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
                  <p className="text-sm font-semibold">Context Preview</p>
                  <p className="text-xs text-muted-foreground">
                    Combined context sent to agents at session start.
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Copy
                </Button>
              </div>
              <div className="mt-4 rounded-2xl border bg-card p-4 font-mono text-xs leading-5 text-muted-foreground">
                <p className="text-foreground">## Project Decisions</p>
                <p className="mt-2">### Architecture</p>
                <p>- Monorepo Architecture: pnpm + Turborepo</p>
                <p className="mt-2">### Tooling</p>
                <p>- Testing Framework: Vitest</p>
                <p className="mt-2">### Rules</p>
                <p>- Tests Required: add regression coverage</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
