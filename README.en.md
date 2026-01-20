# agentmine

**Safe Parallel AI Development Environment**

> Run multiple AIs simultaneously, safely, and manageably

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

English | [日本語](./README.md)

---

## Why agentmine?

**Trying to manage parallel AI development with GitHub Issues doesn't work.**

Issues are for "recording", not for "execution".
Running multiple AIs simultaneously requires **isolation, scope control, and safe automatic execution**.

agentmine is the **execution environment for parallel AI development** that solves these challenges.

---

## Core Value

```
┌─────────────────────────────────────────────────────────────────────┐
│                    agentmine Core Value                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Parallel AI Management                                          │
│     • Run multiple AIs simultaneously (worktree isolation)          │
│     • Assign based on AI strengths                                  │
│     • Switch AIs when context limits are reached                    │
│                                                                     │
│  2. Scope Control                                                   │
│     • Physical access restrictions (sparse-checkout + chmod)        │
│     • Safe automatic execution without Yes/No prompts               │
│     • Use --dangerously-skip-permissions with confidence            │
│                                                                     │
│  3. Human-AI Collaboration                                          │
│     • Works via Orchestrator AI or direct human control             │
│     • Web UI for overall visibility and monitoring                  │
│     • Task definition by humans, execution by AI, approval by humans│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Issue vs agentmine

| Aspect | GitHub Issues | agentmine |
|--------|---------------|-----------|
| **Essence** | Recording & tracking | Execution environment |
| **Parallel execution** | ✗ Cannot manage | ✓ worktree isolation |
| **Scope control** | ✗ No concept | ✓ Physical restrictions |
| **Auto-approval** | ✗ Not relevant | ✓ Safely possible |
| **AI assignment** | ✗ Manual comments | ✓ Agent definitions |
| **State** | Open/Closed | Execution state (running/waiting/done) |

**Manage with Issues, execute with agentmine.** Complementary, not competing.

---

## How to Use

### For Humans: Web UI

```
http://localhost:3333
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Create Task → Select Agent → Start Worker → Monitor → Confirm Done │
│                                                                     │
│  Everything in the browser. No need to learn CLI.                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### For Orchestrator AI: CLI / MCP

Orchestrator AI (Claude Code, etc.) automates via CLI/MCP:

```bash
# Orchestrator executes
agentmine task add "Auth feature" -t feature
agentmine worker run 1 --exec --detach
agentmine worker run 2 --exec --detach
agentmine worker wait 1 2
```

Or direct operation via MCP:

```json
{
  "mcpServers": {
    "agentmine": {
      "command": "npx",
      "args": ["agentmine", "mcp", "serve"]
    }
  }
}
```

**Humans use Web UI, AI uses CLI/MCP. Optimal interface for each.**

---

## Quick Start

```bash
# Install
npm install -g agentmine

# Initialize project
agentmine init

# Start Web UI
agentmine ui
```

Open `http://localhost:3333` in your browser for task creation, Worker startup, and monitoring.

### Using via Orchestrator AI

Let an Orchestrator like Claude Code use agentmine:

```bash
# After MCP configuration, instruct the Orchestrator
"Manage tasks with agentmine and run Workers in parallel"
```

---

## Features

### 1. Web UI - Dashboard for Humans

```bash
agentmine ui  # http://localhost:3333
```

**Humans complete everything in Web UI:**
- Create/edit/delete tasks
- Select/assign agents
- Start/stop Workers
- Monitor progress/confirm completion
- Preview diffs

No need to learn CLI. Manage parallel AI development from your browser.

### 2. Scope Control

```yaml
# Agent definition in DB (editable via Web UI)
name: coder
client: claude-code
model: sonnet
scope:
  read: ["**/*"]                    # Can read all files
  write: ["src/**", "tests/**"]     # Can only edit these
  exclude: ["**/*.env", "**/secrets/**"]  # Physically removed
```

- **exclude**: Physically remove files via sparse-checkout
- **write**: Make non-target files read-only via chmod
- **Result**: Physically limit what AI can touch → **Safe auto-approval**

**Freedom from Yes/No prompts.** Anything within scope is safe.

### 3. Parallel Execution

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Worker 1  │  │  Worker 2  │  │  Worker 3  │
│  (Claude)  │  │  (Codex)   │  │  (Gemini)  │
│ worktree-1 │  │ worktree-2 │  │ worktree-3 │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      └───────────────┴───────────────┘
                      │
                    Git
```

Each Worker operates in an independent worktree. No interference with each other.

### 4. Multiple AI Clients

| Client | Auto-approval Mode | Support |
|--------|-------------------|---------|
| Claude Code | `--dangerously-skip-permissions` | ✓ |
| Codex | `--full-auto` | ✓ |
| Gemini CLI | `-y` | ✓ |
| Aider | `--yes` | ✓ |
| OpenCode | `--auto-approve` | ✓ |

Use different AIs based on their strengths. Switch to another AI when context limits are reached.

### 5. Agent Definitions - Role-based Configuration (DB Managed)

**Agent definitions are managed in DB.** Edit via Web UI, share in real-time across team.

```yaml
# Agent definition in DB (edit via Web UI/CLI)
name: planner
description: "Planning role"
client: claude-code
model: opus            # High-performance model
scope:
  read: ["**/*"]
  write: []            # Read-only
```

```yaml
name: coder
description: "Implementation role"
client: claude-code
model: sonnet
scope:
  write: ["src/**", "tests/**"]
```

Change history is automatically saved. Rollback to previous versions is supported.

### 6. MCP / CLI - For Orchestrator AI

```json
{
  "mcpServers": {
    "agentmine": {
      "command": "npx",
      "args": ["agentmine", "mcp", "serve"]
    }
  }
}
```

Orchestrator AI (Claude Code, etc.) automatically operates agentmine.
CLI is designed for AI/scripts, not humans.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Human ──────┬─────────────────────────────────────┐               │
│              │                                     │               │
│              ▼                                     ▼               │
│  ┌───────────────────┐                  ┌──────────────────┐      │
│  │ Orchestrator AI   │                  │  CLI / Web UI    │      │
│  │ (Claude Code)     │                  │  (Direct control)│      │
│  └─────────┬─────────┘                  └────────┬─────────┘      │
│            │                                     │                 │
│            └──────────────┬──────────────────────┘                 │
│                           ▼                                        │
│            ┌──────────────────────────────┐                       │
│            │          agentmine           │                       │
│            │                              │                       │
│            │  • Task Management           │                       │
│            │  • Worktree + Scope Control  │                       │
│            │  • Worker Lifecycle          │                       │
│            │  • Session Recording         │                       │
│            └──────────────┬───────────────┘                       │
│                           │                                        │
│          ┌────────────────┼────────────────┐                      │
│          ▼                ▼                ▼                      │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│   │  Worker 1  │  │  Worker 2  │  │  Worker 3  │                 │
│   │  (Claude)  │  │  (Codex)   │  │  (Gemini)  │                 │
│   │ worktree-1 │  │ worktree-2 │  │ worktree-3 │                 │
│   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
│         │               │               │                         │
│         └───────────────┴───────────────┘                         │
│                         │                                          │
│                         ▼                                          │
│                       Git                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CLI Reference (for Orchestrator AI / Scripts)

> **Note:** CLI is designed for Orchestrator AI/scripts, not humans.
> Humans should use the Web UI.

### Task Management

```bash
agentmine task add <title> [options]     # Create task
agentmine task list [options]            # List tasks
agentmine task show <id>                 # Show task details
agentmine task update <id> [options]     # Update task
agentmine task delete <id>               # Delete task
```

### Worker Management

```bash
agentmine worker run <task-id> --exec           # Start Worker
agentmine worker run <task-id> --exec --detach  # Start in background
agentmine worker status [task-id]               # Check status
agentmine worker wait <task-ids...>             # Wait for completion
agentmine worker stop <task-ids...>             # Stop
agentmine worker done <task-id>                 # Cleanup
```

### Other

```bash
agentmine init          # Initialize project
agentmine ui            # Start Web UI
agentmine mcp serve     # Start MCP server
```

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Package Manager | pnpm |
| Monorepo | Turborepo |
| Language | TypeScript |
| CLI | Commander.js |
| Web UI | Next.js + React + shadcn/ui + Tailwind |
| ORM | Drizzle ORM |
| DB | **PostgreSQL (main)** / SQLite (sub) |
| Test | Vitest |

### Data Management (DB Master)

All data (tasks, Agent definitions, Memory Bank, settings) is managed in DB. Redmine-style team collaboration.

```
All team members ───→ Shared PostgreSQL ───→ Single source of truth
```

| Data | Storage | Notes |
|------|---------|-------|
| Tasks | DB | tasks table |
| Agent definitions | DB | agents table + change history |
| Memory Bank | DB | memories table + change history |
| Settings | DB | settings table |
| Audit logs | DB | audit_logs table |

Files are exported from DB to worktree when Worker starts. `.agentmine/` is in `.gitignore`.

---

## Development

```bash
# Clone
git clone https://github.com/krtw00/agentmine.git
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
```

---

## Documentation

- [Architecture](./docs/architecture.md) - System Architecture
- [Data Model](./docs/data-model.md) - Data Model
- [CLI Design](./docs/cli-design.md) - CLI Command Design
- [Agent System](./docs/features/agent-system.md) - Agent Definitions
- [Parallel Execution](./docs/features/parallel-execution.md) - Parallel Execution
- [Worktree & Scope](./docs/features/worktree-scope.md) - Scope Control

---

## License

[MIT License](./LICENSE)

---

<p align="center">
  <b>agentmine</b> - Safe Parallel AI Development Environment
</p>
