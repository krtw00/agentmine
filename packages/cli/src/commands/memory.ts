import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import {
  createDb,
  initializeDb,
  isProjectInitialized,
  MemoryService,
  MemoryNotFoundError,
  type Db,
  type Memory,
  type MemoryStatus,
} from '@agentmine/core'

// ============================================
// Helpers
// ============================================

function ensureInitialized(): boolean {
  if (!isProjectInitialized()) {
    console.error(chalk.red('Error: agentmine not initialized'))
    console.log(chalk.gray('Run `agentmine init` first'))
    process.exit(3)
  }
  return true
}

async function getDb(): Promise<Db> {
  const db = createDb()
  await initializeDb(db)
  return db
}

function getMemoryService(db: Db): MemoryService {
  return new MemoryService(db)
}

interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

function formatMemory(memory: Memory, options: OutputOptions): string {
  if (options.json) {
    return JSON.stringify(memory)
  }
  if (options.quiet) {
    return String(memory.id)
  }
  return `#${memory.id} ${memory.title} (${memory.category})`
}

function formatMemoryList(memories: Memory[], options: OutputOptions): void {
  if (options.json) {
    console.log(JSON.stringify(memories, null, 2))
    return
  }

  if (options.quiet) {
    memories.forEach(m => console.log(m.id))
    return
  }

  if (memories.length === 0) {
    console.log(chalk.gray('No memory entries found.'))
    console.log(chalk.gray('Add one with:'))
    console.log(chalk.cyan('  agentmine memory add <category> <title> -c <content>'))
    return
  }

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('Category'),
      chalk.white('Title'),
      chalk.white('Status'),
      chalk.white('Updated'),
    ],
    style: { head: [], border: [] },
  })

  for (const memory of memories) {
    const statusColor = memory.status === 'active' ? chalk.green :
                        memory.status === 'archived' ? chalk.gray : chalk.yellow
    table.push([
      chalk.cyan(String(memory.id)),
      memory.category,
      memory.title,
      statusColor(memory.status),
      memory.updatedAt.toLocaleDateString(),
    ])
  }

  console.log(table.toString())
}

// ============================================
// Commands
// ============================================

export const memoryCommand = new Command('memory')
  .description('Manage Memory Bank entries')

// memory list
memoryCommand
  .command('list')
  .description('List memory entries')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --status <status>', 'Filter by status (draft, active, archived)')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output (IDs only)')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    const memories = await service.list({
      category: options.category,
      status: options.status as MemoryStatus | undefined,
    })
    formatMemoryList(memories, options)
  })

// memory show
memoryCommand
  .command('show <id>')
  .description('Show memory entry content')
  .option('--json', 'JSON output')
  .action(async (id, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    const memory = await service.get(parseInt(id))

    if (!memory) {
      console.error(chalk.red(`Memory entry #${id} not found`))
      process.exit(5)
    }

    if (options.json) {
      console.log(JSON.stringify(memory, null, 2))
      return
    }

    console.log('')
    console.log(chalk.cyan(`#${memory.id} ${memory.title}`), chalk.gray(`(${memory.category})`))
    console.log(chalk.gray('Status: '), memory.status)
    if (memory.summary) {
      console.log(chalk.gray('Summary:'), memory.summary)
    }
    console.log(chalk.gray('Updated:'), memory.updatedAt.toISOString())
    console.log('')
    console.log(memory.content)
  })

// memory add
memoryCommand
  .command('add <category> <title>')
  .description('Add a new memory entry')
  .option('-c, --content <content>', 'Content (or use stdin)')
  .option('-s, --summary <summary>', 'Short summary')
  .option('-f, --file <file>', 'Read content from file')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (category, title, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    let content = options.content || ''

    // Read from file if specified
    if (options.file) {
      const { readFileSync, existsSync } = await import('fs')
      if (!existsSync(options.file)) {
        console.error(chalk.red(`File not found: ${options.file}`))
        process.exit(5)
      }
      content = readFileSync(options.file, 'utf-8')
    }

    // If no content provided, show error
    if (!content) {
      console.error(chalk.red('Content is required. Use -c or -f option.'))
      process.exit(2)
    }

    const memory = await service.create({
      category,
      title,
      content,
      summary: options.summary,
    })

    if (options.json) {
      console.log(JSON.stringify(memory))
    } else if (options.quiet) {
      console.log(memory.id)
    } else {
      console.log(chalk.green('✓ Created memory entry'), chalk.cyan(`#${memory.id} ${title}`))
    }
  })

// memory edit
memoryCommand
  .command('edit <id>')
  .description('Edit a memory entry')
  .option('-t, --title <title>', 'New title')
  .option('-c, --content <content>', 'New content')
  .option('-s, --summary <summary>', 'New summary')
  .option('--category <category>', 'New category')
  .option('-f, --file <file>', 'Read content from file')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    let content = options.content

    // Read from file if specified
    if (options.file) {
      const { readFileSync, existsSync } = await import('fs')
      if (!existsSync(options.file)) {
        console.error(chalk.red(`File not found: ${options.file}`))
        process.exit(5)
      }
      content = readFileSync(options.file, 'utf-8')
    }

    // Check if any update field is provided
    if (!content && !options.title && !options.summary && !options.category) {
      console.error(chalk.red('At least one field must be provided to update.'))
      console.log(chalk.gray('Use -t, -c, -s, --category, or -f option.'))
      process.exit(2)
    }

    try {
      const memory = await service.update(parseInt(id), {
        title: options.title,
        content,
        summary: options.summary,
        category: options.category,
      })

      if (options.json) {
        console.log(JSON.stringify(memory))
      } else if (options.quiet) {
        console.log(memory.id)
      } else {
        console.log(chalk.green('✓ Updated memory entry'), chalk.cyan(`#${memory.id}`))
      }
    } catch (error) {
      if (error instanceof MemoryNotFoundError) {
        console.error(chalk.red(`Memory entry #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// memory archive
memoryCommand
  .command('archive <id>')
  .description('Archive a memory entry')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    try {
      const memory = await service.archive(parseInt(id))

      if (options.json) {
        console.log(JSON.stringify({ archived: true, id: memory.id }))
      } else if (options.quiet) {
        console.log(memory.id)
      } else {
        console.log(chalk.green('✓ Archived memory entry'), chalk.cyan(`#${memory.id}`))
      }
    } catch (error) {
      if (error instanceof MemoryNotFoundError) {
        console.error(chalk.red(`Memory entry #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// memory remove
memoryCommand
  .command('remove <id>')
  .alias('rm')
  .description('Remove a memory entry')
  .option('--json', 'JSON output')
  .option('--quiet', 'Minimal output')
  .action(async (id, options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    try {
      await service.delete(parseInt(id))

      if (options.json) {
        console.log(JSON.stringify({ deleted: true, id: parseInt(id) }))
      } else if (options.quiet) {
        console.log(id)
      } else {
        console.log(chalk.green('✓ Removed memory entry'), chalk.cyan(`#${id}`))
      }
    } catch (error) {
      if (error instanceof MemoryNotFoundError) {
        console.error(chalk.red(`Memory entry #${id} not found`))
        process.exit(5)
      }
      throw error
    }
  })

// memory preview
memoryCommand
  .command('preview')
  .description('Generate preview for AI consumption')
  .option('--compact', 'Compact format (titles and summaries only)')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    if (options.compact) {
      const preview = await service.previewCompact()
      if (options.json) {
        console.log(JSON.stringify({ preview }))
      } else {
        console.log(preview)
      }
    } else {
      const preview = await service.preview()
      if (options.json) {
        console.log(JSON.stringify({ preview }))
      } else {
        console.log(preview)
      }
    }
  })

// memory categories
memoryCommand
  .command('categories')
  .description('List available categories')
  .option('--json', 'JSON output')
  .action(async (options) => {
    ensureInitialized()
    const db = await getDb()
    const service = getMemoryService(db)

    const categories = await service.getCategories()

    if (options.json) {
      console.log(JSON.stringify(categories))
      return
    }

    if (categories.length === 0) {
      console.log(chalk.gray('No categories found.'))
      return
    }

    console.log(chalk.bold('Categories:'))
    categories.forEach(c => console.log(chalk.cyan(`  ${c}`)))
  })
