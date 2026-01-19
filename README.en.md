# agentmine

**The Project Management Platform Built for AI Agents**

> A project management platform where AI agents and humans truly collaborate

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

English | [日本語](./README.md)

---

## Why agentmine?

We're in an era where AI coding agents (Claude Code, Codex CLI, Gemini CLI, etc.) handle implementation.
However, existing tools have significant limitations:

| Tool | Problem |
|------|---------|
| **GitHub Issues / Jira** | Designed for humans. Low information density for AI, verbose operations |
| **APM** | Focused on context management. Lacks full-fledged project management |
| **TSK** | Focused on sandbox execution. Minimal task management |
| **TaskMaster AI** | Focused on task decomposition. Can't manage entire projects |

**agentmine** is an integrated platform that takes the best from all of these.

---

## Core Features

### 1. Dual Interface - Designed for Both AI and Humans

```
┌─────────────────────────────────────────────────────────────┐
│                        agentmine                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────┐       ┌──────────────────┐          │
│   │       CLI        │       │      Web UI      │          │
│   │                  │       │                  │          │
│   │  AI Agents       │       │  Humans          │          │
│   │  - Structured    │       │  - Kanban board  │          │
│   │  - Fast ops      │       │  - Dashboard     │          │
│   │  - Pipeable      │       │  - Drag & drop   │          │
│   └────────┬─────────┘       └────────┬─────────┘          │
│            └──────────┬───────────────┘                     │
│                       ▼                                      │
│              ┌─────────────────┐                            │
│              │    Shared DB    │                            │
│              │  SQLite / PG    │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Memory Bank - Never Lose Context (Inspired by APM)

Project context persists even when agent sessions end.

```yaml
# .agentmine/memory/project-context.md auto-generated & updated
Session:
  id: 42
  agent: coder
  task_id: 7
  summary: "Implemented JWT auth with refresh token support"
  decisions:
    - "Chose jose library (lightweight)"
    - "Set token expiry to 15 minutes"
  next_steps:
    - "Implement logout functionality"
    - "Add token refresh tests"
```

In a new session:
```bash
agentmine context load  # Restore previous context
```

### 3. Parallel Execution - Run Tasks Concurrently (Inspired by TSK)

```bash
# Run multiple tasks in parallel
agentmine task run --parallel 3

# Compare same task with different agents
agentmine task run 5 --agent coder,reviewer --compare
```

```
┌─────────────────────────────────────────┐
│           Parallel Execution            │
├─────────────────────────────────────────┤
│  Task #3        Task #4        Task #5  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐│
│  │ coder   │   │ coder   │   │ coder   ││
│  │ branch-3│   │ branch-4│   │ branch-5││
│  └────┬────┘   └────┬────┘   └────┬────┘│
│       │             │             │      │
│       ▼             ▼             ▼      │
│    PR #12        PR #13        PR #14   │
└─────────────────────────────────────────┘
```

### 4. Task Decomposition - Auto-generate from PRD (Inspired by TaskMaster AI)

```bash
# Generate tasks from PRD
agentmine task parse-prd ./docs/prd.md

# Expand complex tasks into subtasks
agentmine task expand 3 --depth 2

# Analyze complexity
agentmine task analyze 3
# → Complexity: 7/10
# → Estimated subtasks: 4
# → Suggested approach: "Separate auth and API implementation"
```

### 5. Agent Definitions - Role-based Agent Configuration

```yaml
# .agentmine/config.yaml
agents:
  planner:
    description: "Design and planning"
    model: claude-opus
    tools: [Read, WebSearch, Grep]
    skills: [analyze, design, estimate]

  coder:
    description: "Implementation"
    model: claude-sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]
    skills: [implement, test, debug]

  reviewer:
    description: "Code review"
    model: claude-haiku
    tools: [Read, Grep]
    skills: [review, security-check]
```

### 6. Skill System - Reusable Prompts

```yaml
skills:
  # Built-in skills
  commit:
    source: builtin

  # Custom skills
  api-design:
    source: local
    path: .agentmine/skills/api-design.md

  # Community skills
  security-audit:
    source: remote
    url: https://skills.agentmine.dev/security-audit.md
```

```bash
agentmine skill run security-audit --task 5
```

### 7. MCP Integration - Seamless Editor Integration

```json
// Cursor / Windsurf / Claude Desktop
{
  "mcpServers": {
    "agentmine": {
      "command": "agentmine",
      "args": ["mcp", "serve"]
    }
  }
}
```

Directly from your editor:
- Fetch task list
- Update status
- Load context

---

## Comparison

| Feature | agentmine | APM | TSK | TaskMaster AI | GitHub Issues |
|---------|-----------|-----|-----|---------------|---------------|
| Project Management | ✅ Full | ❌ | ❌ | △ | ✅ |
| CLI (AI-friendly) | ✅ | ❌ | ✅ | ✅ | △ gh CLI |
| Web UI | ✅ | ❌ | ❌ | △ VS Code | ✅ |
| Memory Bank | ✅ | ✅ | ❌ | ❌ | ❌ |
| Parallel Execution | ✅ | ❌ | ✅ | ❌ | ❌ |
| Task Decomposition | ✅ | ❌ | ❌ | ✅ | ❌ |
| Agent Definitions | ✅ | △ | ❌ | ❌ | ❌ |
| Skill System | ✅ | ❌ | ❌ | ❌ | ❌ |
| MCP Support | ✅ | ❌ | ❌ | ✅ | ❌ |
| AI/Human Distinction | ✅ | △ | ❌ | ❌ | ❌ |

---

## Quick Start

```bash
# Install
npm install -g agentmine

# Initialize project
agentmine init

# Create task
agentmine task add "Implement user authentication" -p high -t feature

# Assign to agent
agentmine task assign 1 coder

# Start work (auto-creates branch)
agentmine task start 1

# Complete (auto-creates PR)
agentmine task done 1
```

---

## CLI Reference

### Task Management

```bash
# CRUD
agentmine task add "title" [-p priority] [-t type]
agentmine task list [--status open|in_progress|review|done]
agentmine task show <id>
agentmine task update <id> [--title] [--priority] [--status]
agentmine task delete <id>

# Workflow
agentmine task assign <id> <agent|human> [--ai|--human]
agentmine task start <id>              # Create branch, change status
agentmine task done <id>               # Create PR, change status

# Advanced
agentmine task parse-prd <file>        # Generate tasks from PRD
agentmine task expand <id>             # Expand into subtasks
agentmine task analyze <id>            # Analyze complexity
agentmine task run --parallel <n>      # Parallel execution
```

### Agent Management

```bash
agentmine agent list
agentmine agent show <name>
agentmine agent run <name> "prompt" [--task <id>]
```

### Context / Memory

```bash
agentmine context show                 # Show current context
agentmine context load [--session <id>] # Restore context
agentmine context save                 # Manual save
```

### Skills

```bash
agentmine skill list
agentmine skill run <name> [--task <id>]
agentmine skill add <name> --path <file>
```

### Web UI

```bash
agentmine ui                           # http://localhost:3333
agentmine ui --port 8080
```

---

## Architecture

```
agentmine/
├── packages/
│   ├── cli/              # CLI application
│   │   └── src/
│   │       ├── commands/ # task, agent, skill, context, ui
│   │       └── mcp/      # MCP server
│   ├── web/              # Next.js Web UI
│   │   └── src/
│   │       ├── app/      # App Router
│   │       └── components/
│   └── core/             # Shared logic
│       └── src/
│           ├── db/       # Drizzle ORM
│           ├── models/   # Task, Agent, Session, Skill
│           └── services/ # Business logic
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| CLI | TypeScript + Commander | Type sharing with Web UI, rich ecosystem |
| Web UI | Next.js 15 + shadcn/ui | App Router, Server Components |
| Database | SQLite / PostgreSQL | Local ↔ Team flexibility |
| ORM | Drizzle | Type-safe, lightweight, multi-DB |
| Monorepo | pnpm + Turborepo | Fast builds, caching |

---

## Roadmap

### Phase 1: Foundation (Current)
- [x] Monorepo structure setup
- [ ] Basic CLI commands (task CRUD)
- [ ] SQLite integration
- [ ] Basic task workflow

### Phase 2: Memory & Context
- [ ] Memory Bank implementation
- [ ] Session recording & restoration
- [ ] Auto context summarization

### Phase 3: Agent Integration
- [ ] Agent definition YAML
- [ ] Claude Code / Codex integration
- [ ] Skill system

### Phase 4: Advanced Features
- [ ] Parallel execution engine
- [ ] PRD → Task decomposition
- [ ] Complexity analysis (AI-powered)

### Phase 5: Web UI
- [ ] Dashboard
- [ ] Kanban board
- [ ] Real-time updates (WebSocket)

### Phase 6: MCP & Ecosystem
- [ ] MCP server implementation
- [ ] Cursor / Windsurf integration
- [ ] Skill marketplace

### Phase 7: Team & Scale
- [ ] PostgreSQL support
- [ ] Multi-user
- [ ] GitHub Issues sync
- [ ] Slack/Discord notifications

---

## Development

```bash
# Clone
git clone https://github.com/yourname/agentmine.git
cd agentmine

# Install dependencies
pnpm install

# Development
pnpm dev          # All packages
pnpm cli dev      # CLI only
pnpm web dev      # Web UI only

# Build
pnpm build

# Test
pnpm test

# CLI global install (dev)
cd packages/cli && pnpm link --global
```

---

## Inspiration & Credits

agentmine draws inspiration from these excellent projects:

- [Agentic Project Management (APM)](https://github.com/sdi2200262/agentic-project-management) - Memory Bank, Handover protocols
- [TSK](https://github.com/dtormoen/tsk) - Parallel execution, sandbox architecture
- [TaskMaster AI](https://github.com/eyaltoledano/claude-task-master) - PRD decomposition, MCP integration
- [Claude Squad](https://github.com/smtg-ai/claude-squad) - Multi-agent management
- [Redmine](https://www.redmine.org/) - Full-featured project management UX

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <b>agentmine</b> - Where AI agents and humans collaborate seamlessly
</p>
