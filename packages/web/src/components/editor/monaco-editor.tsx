'use client'

import { useRef, useCallback } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'

export type EditorLanguage = 'yaml' | 'markdown' | 'json' | 'plaintext'

interface MonacoEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: EditorLanguage
  readOnly?: boolean
  height?: string | number
  minHeight?: string | number
  className?: string
  onMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function MonacoEditor({
  value,
  onChange,
  language = 'plaintext',
  readOnly = false,
  height = '400px',
  minHeight,
  className,
  onMount: onMountProp,
}: MonacoEditorProps) {
  const { theme, systemTheme } = useTheme()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light'

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      folding: true,
      renderLineHighlight: 'line',
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
    })

    // YAML schema validation
    if (language === 'yaml') {
      monaco.languages.yaml?.yamlDefaults?.setDiagnosticsOptions({
        validate: true,
        enableSchemaRequest: true,
        hover: true,
        completion: true,
      })
    }

    // JSON schema validation
    if (language === 'json') {
      monaco.languages.json?.jsonDefaults?.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemaValidation: 'error',
      })
    }

    if (onMountProp) {
      onMountProp(editor)
    }
  }, [language, onMountProp])

  const handleChange: OnChange = useCallback((value) => {
    if (onChange && value !== undefined) {
      onChange(value)
    }
  }, [onChange])

  return (
    <div className={className} style={{ minHeight }}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        theme={monacoTheme}
        loading={<EditorSkeleton height={height} />}
        options={{
          readOnly,
          domReadOnly: readOnly,
        }}
      />
    </div>
  )
}

function EditorSkeleton({ height }: { height: string | number }) {
  return (
    <div style={{ height }} className="flex flex-col gap-2 p-4 bg-muted/30 rounded-lg">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

// Export a wrapper for YAML editing with schema support
interface YamlEditorProps extends Omit<MonacoEditorProps, 'language'> {
  schema?: object
}

export function YamlEditor({ schema, ...props }: YamlEditorProps) {
  return <MonacoEditor {...props} language="yaml" />
}

// Export a wrapper for Markdown editing
export function MarkdownEditor(props: Omit<MonacoEditorProps, 'language'>) {
  return <MonacoEditor {...props} language="markdown" />
}

// Export a wrapper for JSON editing
export function JsonEditor(props: Omit<MonacoEditorProps, 'language'>) {
  return <MonacoEditor {...props} language="json" />
}
