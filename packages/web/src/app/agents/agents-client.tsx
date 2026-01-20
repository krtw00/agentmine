'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AgentScope as CoreAgentScope, AgentConfig as CoreAgentConfig } from '@agentmine/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Local types for UI state (normalized, all arrays non-optional)
type AgentScope = {
  read: string[];
  write: string[];
  exclude: string[];
};

type AgentConfig = {
  temperature?: number;
  maxTokens?: number;
};

type AgentState = {
  id?: number;
  name: string;
  description?: string;
  client: string;
  model: string;
  scope: AgentScope;
  config: AgentConfig;
  promptContent?: string;
};

type AgentsClientProps = {
  agents: Agent[];
};

const CLIENT_OPTIONS = ['claude-code', 'codex', 'gemini', 'custom'];
const MODEL_OPTIONS: Record<string, string[]> = {
  'claude-code': ['opus', 'sonnet', 'haiku'],
  codex: ['gpt-4.1', 'o3-mini', 'o4-mini'],
  gemini: ['2.0-pro', '2.0-flash', '2.5-pro'],
  custom: ['custom-model'],
};

const fieldClassName =
  'border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';
const textAreaClassName =
  'border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

const normalizeAgent = (agent: Agent): AgentState => {
  const scope = agent.scope as CoreAgentScope | null;
  const config = agent.config as CoreAgentConfig | null;
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? undefined,
    client: agent.client,
    model: agent.model,
    scope: {
      read: scope?.read ?? [],
      write: scope?.write ?? [],
      exclude: scope?.exclude ?? [],
    },
    config: {
      temperature: config?.temperature,
      maxTokens: config?.maxTokens,
    },
    promptContent: agent.promptContent ?? undefined,
  };
};

const splitValues = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinValues = (values: string[]) => values.join('\n');

const formatYamlValue = (value: string | number | boolean) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

const serializeAgentToYaml = (agent: AgentState) => {
  const lines: string[] = [];
  lines.push(`# .agentmine/agents/${agent.name}.yaml`);
  lines.push(`name: ${formatYamlValue(agent.name)}`);
  if (agent.description) {
    lines.push(`description: ${formatYamlValue(agent.description)}`);
  }
  lines.push('');
  lines.push(`client: ${formatYamlValue(agent.client)}`);
  lines.push(`model: ${formatYamlValue(agent.model)}`);

  lines.push('');
  lines.push('scope:');
  (['read', 'write', 'exclude'] as const).forEach((key) => {
    lines.push(`  ${key}:`);
    agent.scope[key].forEach((entry) => {
      lines.push(`    - ${formatYamlValue(entry)}`);
    });
  });

  if (
    agent.config.temperature !== undefined ||
    agent.config.maxTokens !== undefined
  ) {
    lines.push('');
    lines.push('config:');
    if (agent.config.temperature !== undefined) {
      lines.push(`  temperature: ${agent.config.temperature}`);
    }
    if (agent.config.maxTokens !== undefined) {
      lines.push(`  maxTokens: ${agent.config.maxTokens}`);
    }
  }

  if (agent.promptContent) {
    lines.push('');
    lines.push('promptContent: |');
    agent.promptContent.split('\n').forEach((line) => {
      lines.push(`  ${line}`);
    });
  }

  return lines.join('\n');
};

const parseScalar = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
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

const parseAgentYaml = (yaml: string) => {
  const result: Partial<AgentState> = {};
  const scope: AgentScope = { read: [], write: [], exclude: [] };
  const config: AgentConfig = {};
  let section: 'scope' | 'config' | null = null;
  let arrayKey: keyof AgentScope | null = null;
  let inPromptContent = false;
  let promptContentLines: string[] = [];

  try {
    const lines = yaml.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.replace(/\t/g, '  ');
      const trimmed = line.trim();
      const indent = line.match(/^\s*/)?.[0].length ?? 0;

      // Handle promptContent block scalar
      if (inPromptContent) {
        if (indent >= 2) {
          // Continuation line (remove 2 spaces of indentation)
          promptContentLines.push(line.slice(2));
          continue;
        } else if (trimmed === '') {
          // Empty line in block
          promptContentLines.push('');
          continue;
        } else {
          // End of block scalar
          inPromptContent = false;
          result.promptContent = promptContentLines.join('\n').trimEnd();
        }
      }

      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      if (indent === 0) {
        section = null;
        arrayKey = null;
        const [key, rest] = trimmed.split(/:\s*/, 2);
        if (!key) {
          continue;
        }
        if (rest === undefined || rest === '') {
          if (key === 'scope' || key === 'config') {
            section = key;
          }
        } else if (rest === '|') {
          // Block scalar
          if (key === 'promptContent') {
            inPromptContent = true;
            promptContentLines = [];
          }
        } else {
          if (key === 'name') {
            result.name = String(parseScalar(rest));
          } else if (key === 'description') {
            result.description = String(parseScalar(rest));
          } else if (key === 'client') {
            result.client = String(parseScalar(rest));
          } else if (key === 'model') {
            result.model = String(parseScalar(rest));
          } else if (key === 'promptContent') {
            result.promptContent = String(parseScalar(rest));
          }
        }
        continue;
      }

      if (indent === 2 && section) {
        const [key, rest] = trimmed.split(/:\s*/, 2);
        if (!key) {
          continue;
        }
        if (section === 'scope') {
          if (key === 'read' || key === 'write' || key === 'exclude') {
            arrayKey = key;
            scope[key] = [];
            if (rest && rest !== '') {
              scope[key].push(String(parseScalar(rest)));
            }
          }
        } else if (section === 'config') {
          if (!rest || rest === '') {
            continue;
          }
          const value = parseScalar(rest);
          if (key === 'temperature' && typeof value === 'number') {
            config.temperature = value;
          }
          if (key === 'maxTokens' && typeof value === 'number') {
            config.maxTokens = value;
          }
        }
        continue;
      }

      if (indent >= 4 && section === 'scope' && arrayKey && trimmed.startsWith('-')) {
        const entry = trimmed.replace(/^-/, '').trim();
        if (entry) {
          scope[arrayKey].push(String(parseScalar(entry)));
        }
      }
    }

    // Handle promptContent if it was the last section
    if (inPromptContent && promptContentLines.length > 0) {
      result.promptContent = promptContentLines.join('\n').trimEnd();
    }

    if (!result.name || !result.client || !result.model) {
      return { error: 'name、client、model は必須です。' };
    }

    const agentState: AgentState = {
      name: result.name,
      description: result.description,
      client: result.client,
      model: result.model,
      scope,
      config: Object.keys(config).length ? config : {},
      promptContent: result.promptContent,
    };

    return { agent: agentState };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'YAMLを解析できませんでした。',
    };
  }
};

export default function AgentsClient({ agents: initialAgents }: AgentsClientProps) {
  const initialDraft = initialAgents[0] ? normalizeAgent(initialAgents[0]) : null;
  const [agents, setAgents] = useState<AgentState[]>(() =>
    initialAgents.map(normalizeAgent)
  );
  const [selectedName, setSelectedName] = useState(initialAgents[0]?.name ?? '');
  const [mode, setMode] = useState<'ui' | 'yaml'>('ui');
  const [draft, setDraft] = useState<AgentState | null>(initialDraft);
  const [yamlDraft, setYamlDraft] = useState(
    initialDraft ? serializeAgentToYaml(initialDraft) : ''
  );
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const nextAgentIndex = useRef(1);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return agents;
    }
    return agents.filter((agent) => {
      return (
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query) ||
        agent.client.toLowerCase().includes(query)
      );
    });
  }, [agents, search]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.name === selectedName) ?? null,
    [agents, selectedName]
  );

  const yamlStatus = useMemo(() => parseAgentYaml(yamlDraft), [yamlDraft]);

  useEffect(() => {
    if (!selectedAgent) {
      setDraft(null);
      setYamlDraft('');
      setDirty(false);
      setYamlError(null);
      return;
    }
    setDraft({
      ...selectedAgent,
      scope: { ...selectedAgent.scope },
      config: { ...selectedAgent.config },
    });
    setYamlDraft(serializeAgentToYaml(selectedAgent));
    setDirty(false);
    setYamlError(null);
  }, [selectedAgent?.name]);

  const updateDraft = (next: AgentState) => {
    setDraft(next);
    setYamlDraft(serializeAgentToYaml(next));
    setDirty(true);
    setYamlError(null);
  };

  const updateScope = (key: keyof AgentScope, value: string) => {
    if (!draft) {
      return;
    }
    updateDraft({
      ...draft,
      scope: {
        ...draft.scope,
        [key]: splitValues(value),
      },
    });
  };

  const updateConfig = (key: keyof AgentConfig, value: string) => {
    if (!draft) {
      return;
    }
    let parsed: number | string | undefined;
    if (key === 'temperature' || key === 'maxTokens') {
      parsed = value === '' ? undefined : Number(value);
      if (typeof parsed === 'number' && Number.isNaN(parsed)) {
        parsed = undefined;
      }
    } else {
      parsed = value === '' ? undefined : value;
    }
    updateDraft({
      ...draft,
      config: {
        ...draft.config,
        [key]: parsed,
      },
    });
  };

  const handleSave = () => {
    if (!draft) {
      return;
    }

    const targetName = selectedName;

    if (mode === 'yaml') {
      if (!yamlStatus.agent || yamlStatus.error) {
        setYamlError(yamlStatus.error ?? 'YAMLを解析できませんでした。');
        return;
      }

      const normalized = yamlStatus.agent;

      setAgents((prev) =>
        prev.map((agent) => (agent.name === targetName ? normalized : agent))
      );
      setDraft(normalized);
      setYamlDraft(serializeAgentToYaml(normalized));
      setDirty(false);
      setYamlError(null);
      if (normalized.name !== targetName) {
        setSelectedName(normalized.name);
      }
      return;
    }

    setAgents((prev) =>
      prev.map((agent) => (agent.name === targetName ? draft : agent))
    );
    setYamlDraft(serializeAgentToYaml(draft));
    setDirty(false);
    if (draft.name !== targetName) {
      setSelectedName(draft.name);
    }
  };

  const handleCancel = () => {
    if (!selectedAgent) {
      return;
    }
    setDraft({
      ...selectedAgent,
      scope: { ...selectedAgent.scope },
      config: { ...selectedAgent.config },
    });
    setYamlDraft(serializeAgentToYaml(selectedAgent));
    setDirty(false);
    setYamlError(null);
  };

  const handleNewAgent = () => {
    const existingNames = new Set(agents.map((agent) => agent.name));
    let nextIndex = nextAgentIndex.current;
    let name = `new-agent-${nextIndex}`;
    while (existingNames.has(name)) {
      nextIndex += 1;
      name = `new-agent-${nextIndex}`;
    }
    nextAgentIndex.current = nextIndex + 1;

    const baseAgent = selectedAgent ?? agents[0];
    const client = baseAgent?.client ?? CLIENT_OPTIONS[0];
    const model = baseAgent?.model ?? MODEL_OPTIONS[client]?.[0] ?? '';
    const scope = baseAgent?.scope ?? { read: [], write: [], exclude: [] };

    const agent: AgentState = {
      name,
      description: undefined,
      client,
      model,
      scope: {
        read: [...scope.read],
        write: [...scope.write],
        exclude: [...scope.exclude],
      },
      config: {},
    };
    setAgents((prev) => [agent, ...prev]);
    setSelectedName(name);
    setMode('ui');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">エージェント</h1>
          <p className="text-muted-foreground">
            UIとYAMLエディターでエージェント定義を管理します。
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            placeholder="エージェントを検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-56"
          />
          <Button onClick={handleNewAgent}>新規エージェント</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">エージェント一覧</h2>
                <span className="text-xs text-muted-foreground">
                  {filteredAgents.length} 件
                </span>
              </div>
            </div>
            <div className="divide-y">
              {filteredAgents.map((agent) => {
                const isActive = agent.name === selectedName;
                return (
                  <div
                    key={agent.name}
                    className={cn(
                      'cursor-pointer px-4 py-4 transition hover:bg-accent/40',
                      isActive && 'bg-accent/50'
                    )}
                    onClick={() => setSelectedName(agent.name)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                        <span className="rounded-full border px-2 py-0.5">
                          {agent.client}
                        </span>
                        <span className="rounded-full border px-2 py-0.5">
                          {agent.model}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border px-2 py-0.5">
                        読み取り {agent.scope.read.length}
                      </span>
                      <span className="rounded-full border px-2 py-0.5">
                        書き込み {agent.scope.write.length}
                      </span>
                      <span className="rounded-full border px-2 py-0.5">
                        除外 {agent.scope.exclude.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedName(agent.name);
                          setMode('ui');
                        }}
                      >
                        UI編集
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedName(agent.name);
                          setMode('yaml');
                        }}
                      >
                        YAML編集
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => event.stopPropagation()}
                      >
                        プロンプトを表示
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredAgents.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  検索条件に一致するエージェントがありません。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          {!draft ? (
            <p className="text-sm text-muted-foreground">
              エージェントを選択して定義を表示・編集します。
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    エージェントを編集: {draft.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    UIエディターを使うか、生のYAMLに切り替えて編集します。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={mode === 'ui' ? 'default' : 'outline'}
                    onClick={() => setMode('ui')}
                  >
                    UIエディター
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === 'yaml' ? 'default' : 'outline'}
                    onClick={() => setMode('yaml')}
                  >
                    YAMLエディター
                  </Button>
                  {dirty && (
                    <span className="text-xs text-muted-foreground">
                      未保存の変更
                    </span>
                  )}
                </div>
              </div>

              {mode === 'ui' ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">名前</span>
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft({ ...draft, name: event.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">説明</span>
                      <Input
                        value={draft.description ?? ''}
                        onChange={(event) =>
                          updateDraft({
                            ...draft,
                            description: event.target.value || undefined,
                          })
                        }
                      />
                    </label>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">実行</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">クライアント</span>
                        <select
                          className={fieldClassName}
                          value={draft.client}
                          onChange={(event) => {
                            const nextClient = event.target.value;
                            updateDraft({
                              ...draft,
                              client: nextClient,
                              model:
                                MODEL_OPTIONS[nextClient]?.[0] ?? draft.model,
                            });
                          }}
                        >
                          {CLIENT_OPTIONS.map((client) => (
                            <option key={client} value={client}>
                              {client}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">モデル</span>
                        <select
                          className={fieldClassName}
                          value={draft.model}
                          onChange={(event) =>
                            updateDraft({ ...draft, model: event.target.value })
                          }
                        >
                          {(MODEL_OPTIONS[draft.client] ?? [draft.model]).map(
                            (model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">スコープ</p>
                      <span className="text-xs text-muted-foreground">
                        1行に1パターン
                      </span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">読み取り</span>
                        <textarea
                          className={textAreaClassName}
                          rows={4}
                          value={joinValues(draft.scope.read)}
                          onChange={(event) =>
                            updateScope('read', event.target.value)
                          }
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">書き込み</span>
                        <textarea
                          className={textAreaClassName}
                          rows={4}
                          value={joinValues(draft.scope.write)}
                          onChange={(event) =>
                            updateScope('write', event.target.value)
                          }
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">除外</span>
                        <textarea
                          className={textAreaClassName}
                          rows={4}
                          value={joinValues(draft.scope.exclude)}
                          onChange={(event) =>
                            updateScope('exclude', event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">設定</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">温度</span>
                        <Input
                          type="number"
                          step="0.1"
                          value={draft.config.temperature ?? ''}
                          onChange={(event) =>
                            updateConfig('temperature', event.target.value)
                          }
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">最大トークン</span>
                        <Input
                          type="number"
                          value={draft.config.maxTokens ?? ''}
                          onChange={(event) =>
                            updateConfig('maxTokens', event.target.value)
                          }
                        />
                      </label>
                      <label className="col-span-2 space-y-2 text-sm">
                        <span className="font-medium">プロンプト</span>
                        <textarea
                          className={cn(textAreaClassName, 'min-h-[100px]')}
                          value={draft.promptContent ?? ''}
                          onChange={(event) =>
                            updateDraft({
                              ...draft,
                              promptContent: event.target.value || undefined,
                            })
                          }
                          placeholder="エージェントへの追加指示..."
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>.agentmine/agents/{draft.name}.yaml</span>
                    <span
                      className={cn(
                        'font-medium',
                        yamlStatus.error
                          ? 'text-destructive'
                          : 'text-emerald-600'
                      )}
                    >
                      {yamlStatus.error ? 'YAMLエラー' : 'YAML正常'}
                    </span>
                  </div>
                  <div className="rounded-md border bg-background">
                    <div className="grid grid-cols-[auto_1fr] gap-0">
                      <div className="border-r bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                        {yamlDraft.split(/\r?\n/).map((_, index) => (
                          <div key={index}>{index + 1}</div>
                        ))}
                      </div>
                      <textarea
                        className="min-h-[360px] w-full resize-none bg-transparent px-3 py-3 font-mono text-sm outline-none"
                        value={yamlDraft}
                        onChange={(event) => {
                          setYamlDraft(event.target.value);
                          setDirty(true);
                          setYamlError(null);
                        }}
                      />
                    </div>
                  </div>
                  {yamlError && (
                    <p className="text-xs text-destructive">{yamlError}</p>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={handleCancel}>
                  キャンセル
                </Button>
                <Button onClick={handleSave} disabled={!dirty}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
