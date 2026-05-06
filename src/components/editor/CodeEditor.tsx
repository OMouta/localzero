import Editor, { loader } from '@monaco-editor/react'
import { langFromPath } from '@/lib/utils'

loader.init().then((monaco) => {
  monaco.editor.defineTheme('localzero', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '52525b' },
      { token: 'string', foreground: 'a1a1aa' },
      { token: 'keyword', foreground: 'd4d4d8' },
      { token: 'number', foreground: 'a1a1aa' },
      { token: 'type', foreground: 'e4e4e7' },
    ],
    colors: {
      'editor.background': '#09090b',
      'editor.foreground': '#d4d4d8',
      'editorLineNumber.foreground': '#3f3f46',
      'editorLineNumber.activeForeground': '#71717a',
      'editor.selectionBackground': '#27272a',
      'editor.inactiveSelectionBackground': '#1f1f23',
      'editor.lineHighlightBackground': '#09090b',
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': '#e4e4e7',
      'editorIndentGuide.background1': '#27272a',
      'editorIndentGuide.activeBackground1': '#3f3f46',
      'editorWidget.background': '#18181b',
      'editorWidget.border': '#27272a',
      'editorSuggestWidget.background': '#18181b',
      'editorSuggestWidget.border': '#27272a',
      'editorSuggestWidget.selectedBackground': '#27272a',
      'scrollbarSlider.background': '#27272a80',
      'scrollbarSlider.hoverBackground': '#3f3f46',
      'scrollbarSlider.activeBackground': '#52525b',
      'scrollbar.shadow': '#00000000',
      'stickyScroll.background': '#09090b',
    },
  })
})

interface Props {
  filePath: string
  content: string
}

export function CodeEditor({ filePath, content }: Props) {
  return (
    <Editor
      height="100%"
      language={langFromPath(filePath)}
      value={content}
      theme="localzero"
      options={{
        readOnly: true,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'none',
        scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        renderIndentGuides: true,
        guides: { indentation: true },
      }}
    />
  )
}
