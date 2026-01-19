'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CommitFormat = 'conventional' | 'simple' | 'custom';

type Config = {
  project: {
    name: string;
    description: string;
  };
  database: {
    url: string;
  };
  git: {
    baseBranch: string;
    branchPrefix: string;
    commitConvention: {
      enabled: boolean;
      format: CommitFormat;
    };
  };
  execution: {
    parallel: {
      enabled: boolean;
      maxWorkers: number;
      worktree: {
        path: string;
        cleanup: boolean;
      };
    };
  };
  sessionLog: {
    retention: {
      enabled: boolean;
      days: number;
    };
  };
};

const DEFAULT_CONFIG: Config = {
  project: {
    name: 'agentmine',
    description: 'AI agent orchestration workspace',
  },
  database: {
    url: 'file:.agentmine/agentmine.db',
  },
  git: {
    baseBranch: 'main',
    branchPrefix: 'task-',
    commitConvention: {
      enabled: true,
      format: 'conventional',
    },
  },
  execution: {
    parallel: {
      enabled: false,
      maxWorkers: 2,
      worktree: {
        path: '.agentmine/worktrees',
        cleanup: true,
      },
    },
  },
  sessionLog: {
    retention: {
      enabled: true,
      days: 30,
    },
  },
};

const fieldClassName =
  'border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';
const selectClassName =
  'border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';
const textAreaClassName =
  'border-input min-h-[420px] w-full resize-none rounded-xl border bg-background/80 px-4 py-3 font-mono text-xs leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]';

const formatYamlValue = (value: string | number | boolean) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

const serializeConfigToYaml = (config: Config) => {
  const lines: string[] = [];
  lines.push('# .agentmine/config.yaml');
  lines.push('');
  lines.push('project:');
  lines.push(`  name: ${formatYamlValue(config.project.name)}`);
  lines.push(`  description: ${formatYamlValue(config.project.description)}`);
  lines.push('');
  lines.push('database:');
  lines.push(`  url: ${formatYamlValue(config.database.url)}`);
  lines.push('');
  lines.push('git:');
  lines.push(`  baseBranch: ${formatYamlValue(config.git.baseBranch)}`);
  lines.push(`  branchPrefix: ${formatYamlValue(config.git.branchPrefix)}`);
  lines.push('  commitConvention:');
  lines.push(`    enabled: ${formatYamlValue(config.git.commitConvention.enabled)}`);
  lines.push(`    format: ${formatYamlValue(config.git.commitConvention.format)}`);
  lines.push('');
  lines.push('execution:');
  lines.push('  parallel:');
  lines.push(`    enabled: ${formatYamlValue(config.execution.parallel.enabled)}`);
  lines.push(`    maxWorkers: ${formatYamlValue(config.execution.parallel.maxWorkers)}`);
  lines.push('    worktree:');
  lines.push(`      path: ${formatYamlValue(config.execution.parallel.worktree.path)}`);
  lines.push(`      cleanup: ${formatYamlValue(config.execution.parallel.worktree.cleanup)}`);
  lines.push('');
  lines.push('sessionLog:');
  lines.push('  retention:');
  lines.push(`    enabled: ${formatYamlValue(config.sessionLog.retention.enabled)}`);
  lines.push(`    days: ${formatYamlValue(config.sessionLog.retention.days)}`);
  return lines.join('\n');
};

const parseScalar = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
  }
  if (trimmed === 'null' || trimmed === '~') {
    return null;
  }
  if (/^".*"$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  if (/^'.*'$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  return trimmed;
};

const parseYamlObject = (yaml: string) => {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: root },
  ];

  const lines = yaml.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^:]+):(.*)$/);
    if (!match) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const key = match[1].trim();
    const rawValue = match[2]?.trim() ?? '';
    const value = rawValue.split(/\s+#/)[0]?.trim() ?? '';
    const target = stack[stack.length - 1].obj;

    if (value === '') {
      const next: Record<string, unknown> = {};
      target[key] = next;
      stack.push({ indent, obj: next });
    } else {
      target[key] = parseScalar(value);
    }
  }

  return root;
};

const isValidCommitFormat = (value: unknown): value is CommitFormat =>
  value === 'conventional' || value === 'simple' || value === 'custom';

const normalizeConfig = (input: Record<string, unknown>): Config => {
  const project = input.project && typeof input.project === 'object'
    ? (input.project as Record<string, unknown>)
    : {};
  const database = input.database && typeof input.database === 'object'
    ? (input.database as Record<string, unknown>)
    : {};
  const git = input.git && typeof input.git === 'object'
    ? (input.git as Record<string, unknown>)
    : {};
  const commitConvention = git.commitConvention && typeof git.commitConvention === 'object'
    ? (git.commitConvention as Record<string, unknown>)
    : {};
  const execution = input.execution && typeof input.execution === 'object'
    ? (input.execution as Record<string, unknown>)
    : {};
  const parallel = execution.parallel && typeof execution.parallel === 'object'
    ? (execution.parallel as Record<string, unknown>)
    : {};
  const worktree = parallel.worktree && typeof parallel.worktree === 'object'
    ? (parallel.worktree as Record<string, unknown>)
    : {};
  const sessionLog = input.sessionLog && typeof input.sessionLog === 'object'
    ? (input.sessionLog as Record<string, unknown>)
    : {};
  const retention = sessionLog.retention && typeof sessionLog.retention === 'object'
    ? (sessionLog.retention as Record<string, unknown>)
    : {};

  return {
    project: {
      name: typeof project.name === 'string' ? project.name : DEFAULT_CONFIG.project.name,
      description: typeof project.description === 'string'
        ? project.description
        : DEFAULT_CONFIG.project.description,
    },
    database: {
      url: typeof database.url === 'string' ? database.url : DEFAULT_CONFIG.database.url,
    },
    git: {
      baseBranch: typeof git.baseBranch === 'string' ? git.baseBranch : DEFAULT_CONFIG.git.baseBranch,
      branchPrefix: typeof git.branchPrefix === 'string'
        ? git.branchPrefix
        : DEFAULT_CONFIG.git.branchPrefix,
      commitConvention: {
        enabled: typeof commitConvention.enabled === 'boolean'
          ? commitConvention.enabled
          : DEFAULT_CONFIG.git.commitConvention.enabled,
        format: isValidCommitFormat(commitConvention.format)
          ? commitConvention.format
          : DEFAULT_CONFIG.git.commitConvention.format,
      },
    },
    execution: {
      parallel: {
        enabled: typeof parallel.enabled === 'boolean'
          ? parallel.enabled
          : DEFAULT_CONFIG.execution.parallel.enabled,
        maxWorkers: typeof parallel.maxWorkers === 'number'
          ? parallel.maxWorkers
          : DEFAULT_CONFIG.execution.parallel.maxWorkers,
        worktree: {
          path: typeof worktree.path === 'string'
            ? worktree.path
            : DEFAULT_CONFIG.execution.parallel.worktree.path,
          cleanup: typeof worktree.cleanup === 'boolean'
            ? worktree.cleanup
            : DEFAULT_CONFIG.execution.parallel.worktree.cleanup,
        },
      },
    },
    sessionLog: {
      retention: {
        enabled: typeof retention.enabled === 'boolean'
          ? retention.enabled
          : DEFAULT_CONFIG.sessionLog.retention.enabled,
        days: typeof retention.days === 'number'
          ? retention.days
          : DEFAULT_CONFIG.sessionLog.retention.days,
      },
    },
  };
};

const parseConfigYaml = (yaml: string) => {
  try {
    if (!yaml.trim()) {
      return { error: 'YAML is empty.' };
    }

    const parsed = parseYamlObject(yaml);
    const git = parsed.git as Record<string, unknown> | undefined;
    if (!git || typeof git.baseBranch !== 'string') {
      return { error: 'git.baseBranch is required.' };
    }
    if (!parsed.project || typeof parsed.project !== 'object') {
      return { error: 'project section is required.' };
    }
    return { config: normalizeConfig(parsed) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to parse YAML.',
    };
  }
};

const parseNumberInput = (value: string, fallback: number) => {
  if (value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default function SettingsPage() {
  const [savedConfig, setSavedConfig] = useState<Config>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState<Config>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<'ui' | 'yaml'>('ui');
  const [yamlDraft, setYamlDraft] = useState(serializeConfigToYaml(DEFAULT_CONFIG));
  const [dirty, setDirty] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);

  const yamlStatus = useMemo(() => parseConfigYaml(yamlDraft), [yamlDraft]);
  const previewConfig =
    mode === 'yaml' && yamlStatus.config ? yamlStatus.config : draft;

  const updateDraft = (next: Config) => {
    setDraft(next);
    setYamlDraft(serializeConfigToYaml(next));
    setDirty(true);
    setYamlError(null);
  };

  const handleSave = () => {
    if (mode === 'yaml') {
      if (!yamlStatus.config || yamlStatus.error) {
        setYamlError(yamlStatus.error ?? 'Unable to parse YAML.');
        return;
      }
      const normalized = yamlStatus.config;
      setSavedConfig(normalized);
      setDraft(normalized);
      setYamlDraft(serializeConfigToYaml(normalized));
      setDirty(false);
      setYamlError(null);
      return;
    }

    setSavedConfig(draft);
    setYamlDraft(serializeConfigToYaml(draft));
    setDirty(false);
  };

  const handleReset = () => {
    setDraft(savedConfig);
    setYamlDraft(serializeConfigToYaml(savedConfig));
    setDirty(false);
    setYamlError(null);
  };

  const handleDefaults = () => {
    updateDraft(DEFAULT_CONFIG);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Settings
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Configure your agentmine runtime
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Edit configuration with a structured UI or switch to raw YAML when
            you need full control.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Discard Changes
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border bg-card/70 p-6 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.14),transparent_60%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.14),transparent_45%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Config Editor
                  </p>
                  <h2 className="text-lg font-semibold">config.yaml</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={mode === 'ui' ? 'default' : 'outline'}
                    onClick={() => setMode('ui')}
                  >
                    UI Editor
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === 'yaml' ? 'default' : 'outline'}
                    onClick={() => setMode('yaml')}
                  >
                    YAML Editor
                  </Button>
                </div>
              </div>

              {mode === 'ui' ? (
                <div className="mt-6 space-y-6">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Project</h3>
                      <span className="text-xs text-muted-foreground">
                        Required
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Name
                        </span>
                        <Input
                          value={draft.project.name}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              project: {
                                ...draft.project,
                                name: event.target.value,
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Description
                        </span>
                        <Input
                          value={draft.project.description}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              project: {
                                ...draft.project,
                                description: event.target.value,
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Database</h3>
                        <span className="text-xs text-muted-foreground">
                          Optional
                        </span>
                      </div>
                      <label className="mt-4 block space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          URL
                        </span>
                        <Input
                          value={draft.database.url}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              database: {
                                url: event.target.value,
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Session Log</h3>
                        <span className="text-xs text-muted-foreground">
                          Retention
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
                            checked={draft.sessionLog.retention.enabled}
                            onChange={(event) =>
                              updateDraft({
                                ...draft,
                                sessionLog: {
                                  retention: {
                                    ...draft.sessionLog.retention,
                                    enabled: event.target.checked,
                                  },
                                },
                              })
                            }
                          />
                          Enable retention
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Days
                          </span>
                          <Input
                            type="number"
                            value={String(draft.sessionLog.retention.days)}
                            onChange={(event) =>
                              updateDraft({
                                ...draft,
                                sessionLog: {
                                  retention: {
                                    ...draft.sessionLog.retention,
                                    days: parseNumberInput(
                                      event.target.value,
                                      draft.sessionLog.retention.days
                                    ),
                                  },
                                },
                              })
                            }
                            className="h-9 w-24"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-background/70 p-4">
                    <h3 className="text-sm font-semibold">Git</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Base Branch
                        </span>
                        <Input
                          value={draft.git.baseBranch}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              git: {
                                ...draft.git,
                                baseBranch: event.target.value,
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Branch Prefix
                        </span>
                        <Input
                          value={draft.git.branchPrefix}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              git: {
                                ...draft.git,
                                branchPrefix: event.target.value,
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
                          checked={draft.git.commitConvention.enabled}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              git: {
                                ...draft.git,
                                commitConvention: {
                                  ...draft.git.commitConvention,
                                  enabled: event.target.checked,
                                },
                              },
                            })
                          }
                        />
                        Enable commit convention
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Format
                        </span>
                        <select
                          value={draft.git.commitConvention.format}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              git: {
                                ...draft.git,
                                commitConvention: {
                                  ...draft.git.commitConvention,
                                  format: event.target.value as CommitFormat,
                                },
                              },
                            })
                          }
                          className={selectClassName}
                        >
                          <option value="conventional">conventional</option>
                          <option value="simple">simple</option>
                          <option value="custom">custom</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-background/70 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Execution</h3>
                      <span className="text-xs text-muted-foreground">
                        Parallel workers
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
                          checked={draft.execution.parallel.enabled}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              execution: {
                                parallel: {
                                  ...draft.execution.parallel,
                                  enabled: event.target.checked,
                                },
                              },
                            })
                          }
                        />
                        Enable parallel execution
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Max Workers
                        </span>
                        <Input
                          type="number"
                          value={String(draft.execution.parallel.maxWorkers)}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              execution: {
                                parallel: {
                                  ...draft.execution.parallel,
                                  maxWorkers: parseNumberInput(
                                    event.target.value,
                                    draft.execution.parallel.maxWorkers
                                  ),
                                },
                              },
                            })
                          }
                          className="h-9 w-24"
                        />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="space-y-2 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Worktree Path
                        </span>
                        <Input
                          value={draft.execution.parallel.worktree.path}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              execution: {
                                parallel: {
                                  ...draft.execution.parallel,
                                  worktree: {
                                    ...draft.execution.parallel.worktree,
                                    path: event.target.value,
                                  },
                                },
                              },
                            })
                          }
                          className={fieldClassName}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
                          checked={draft.execution.parallel.worktree.cleanup}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              execution: {
                                parallel: {
                                  ...draft.execution.parallel,
                                  worktree: {
                                    ...draft.execution.parallel.worktree,
                                    cleanup: event.target.checked,
                                  },
                                },
                              },
                            })
                          }
                        />
                        Cleanup worktrees after completion
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <textarea
                    className={cn(
                      textAreaClassName,
                      yamlError && 'border-destructive/60 ring-1 ring-destructive/30'
                    )}
                    value={yamlDraft}
                    onChange={(event) => {
                      setYamlDraft(event.target.value);
                      setDirty(true);
                      setYamlError(null);
                    }}
                    spellCheck={false}
                  />
                  {yamlError ? (
                    <p className="text-xs font-semibold text-destructive">
                      {yamlError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {yamlStatus.error
                        ? yamlStatus.error
                        : 'YAML validated. Press save to apply changes.'}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-background/80 px-3 py-1">
                  {dirty ? 'Unsaved changes' : 'In sync'}
                </span>
                <span className="rounded-full border bg-background/80 px-3 py-1">
                  {mode === 'yaml'
                    ? yamlStatus.error
                      ? 'YAML invalid'
                      : 'YAML valid'
                    : 'UI ready'}
                </span>
                <Button variant="ghost" size="sm" onClick={handleDefaults}>
                  Restore Defaults
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <h3 className="text-sm font-semibold">Config Preview</h3>
              <div className="mt-4 grid gap-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
                  <span>Project</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.project.name || 'unnamed'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
                  <span>Database</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.database.url || 'not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
                  <span>Git</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.git.baseBranch} / {previewConfig.git.branchPrefix}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
                  <span>Parallel</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.execution.parallel.enabled ? 'on' : 'off'} ·{' '}
                    {previewConfig.execution.parallel.maxWorkers} workers
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
                  <span>Retention</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.sessionLog.retention.enabled ? 'on' : 'off'} ·{' '}
                    {previewConfig.sessionLog.retention.days} days
                  </span>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <h3 className="text-sm font-semibold">File Details</h3>
              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Path</span>
                  <span className="font-mono text-foreground">
                    .agentmine/config.yaml
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Format</span>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
                    YAML
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Editor</span>
                  <span>{mode === 'yaml' ? 'Raw YAML' : 'UI Form'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                    dirty ? 'border-amber-400/40 text-amber-600' : 'border-emerald-400/40 text-emerald-600'
                  )}>
                    {dirty ? 'Unsaved' : 'Saved'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <h3 className="text-sm font-semibold">Validation</h3>
              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>YAML</span>
                  <span className={yamlStatus.error ? 'text-destructive' : 'text-emerald-600'}>
                    {yamlStatus.error ? 'Needs attention' : 'Valid'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Base Branch</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.git.baseBranch || 'missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Commit Format</span>
                  <span className="font-mono text-foreground">
                    {previewConfig.git.commitConvention.format}
                  </span>
                </div>
                <div className="rounded-lg border bg-background/70 p-3 text-[11px]">
                  {yamlStatus.error
                    ? yamlStatus.error
                    : 'Configuration matches expected schema.'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
              <h3 className="text-sm font-semibold">Hints</h3>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                <li>Use YAML mode to paste settings from another workspace.</li>
                <li>Parallel execution needs a worktree path to avoid conflicts.</li>
                <li>Retention runs during session log cleanup on startup.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
