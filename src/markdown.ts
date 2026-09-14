import {setOptions} from 'marked'
import {markdownToAdf} from 'marklassian'

export type AdfDocument = ReturnType<typeof markdownToAdf>

// marklassian converts Markdown to ADF by calling `marked.lexer` with marked's
// default options, where a single newline is a *soft* break that collapses into
// the surrounding paragraph. CLI users pass `\n`-separated bodies expecting each
// line on its own line, so enable `breaks` — marked then emits a `br` token for
// single newlines, which marklassian renders as a `hardBreak` node. marked's own
// grammar still protects block constructs (code blocks, tables, lists), so those
// are never corrupted. setOptions mutates a global default, so we apply it once.
//
// That global lives on the marked *module instance*, so this only works while
// npm resolves one copy of marked for both this package and marklassian. The
// `marked` dependency exists solely to reach marklassian's lexer — it is never
// used as a library here — so its range must stay inside marklassian's own
// (`^15.0.6 || ^16.0.0` as of marklassian 1.2.1). A wider range makes npm nest a
// second copy under marklassian, `breaks` never reaches the lexer, and every
// single newline silently collapses again. test/markdown.test.ts asserts both
// the shared resolution and the resulting hardBreak nodes.
let isBreaksEnabled = false

/**
 * Turn literal `\n` sequences (as typed inside a single shell argument) into
 * real newlines.
 */
export function unescapeNewlines(input: string): string {
  return input.replaceAll(String.raw`\n`, '\n')
}

/**
 * Convert a Markdown string into a Confluence ADF document.
 *
 * Literal `\n` sequences (as typed inside a single shell argument) are unescaped
 * to real newlines, and single newlines produce hard line breaks rather than
 * collapsing into one run-on paragraph.
 */
export function markdownToAdfDocument(markdown: string): AdfDocument {
  if (!isBreaksEnabled) {
    setOptions({breaks: true})
    isBreaksEnabled = true
  }

  return markdownToAdf(unescapeNewlines(markdown))
}
