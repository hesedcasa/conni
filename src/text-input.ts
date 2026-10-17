import {readFile} from 'node:fs/promises'

/**
 * Read a text file, or stdin when `path` is `-`. Large text goes through a file
 * rather than argv because endpoint security agents (e.g. SentinelOne) block
 * processes with huge command lines — which is what `"$(cat file)"` produces.
 *
 * stdin is read as a stream: a synchronous read of fd 0 fails with EAGAIN once
 * anything has put it into non-blocking mode.
 */
const readTextFile = async (path: string): Promise<string> => {
  try {
    if (path !== '-') return await readFile(path, 'utf8')
    process.stdin.setEncoding('utf8')
    let text = ''
    for await (const chunk of process.stdin) text += chunk as string
    return text
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read ${path === '-' ? 'stdin' : path}: ${reason}`, {cause: error})
  }
}

/**
 * The value itself, or the contents of `<path>` when it is `@<path>` (`@-` reads
 * stdin, see {@link readTextFile}), as `--fields` does; `@@` escapes a literal
 * leading `@`.
 */
export const readTextValue = async (value: string): Promise<string> =>
  value.startsWith('@@') ? value.slice(1) : value.startsWith('@') ? readTextFile(value.slice(1)) : value
