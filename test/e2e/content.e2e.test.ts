import {expect} from 'chai'

import {cleanupRun, fixtureTitle, seedPage} from './fixtures.js'
import {createConfigDir, isNumericId, removeConfigDir, runCli, runCliJson} from './helpers.js'

type Storage = {data: {body: {storage: {value: string}}}; success: boolean}
type Labels = {data: {results: Array<{name: string; prefix: string}>; size: number}; success: boolean}

describe('e2e: content conversion, comments and labels', () => {
  let configDir: string
  let pageId: string

  before(async () => {
    configDir = await createConfigDir()
    pageId = await seedPage({title: fixtureTitle('content')})
  })

  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  /**
   * Replaces the page body with `markdown` and returns the storage-format XHTML
   * Confluence stored, which is what the Markdown → ADF conversion ultimately
   * has to produce.
   */
  async function roundTrip(markdown: string): Promise<string> {
    await runCliJson(['conni', 'content', 'update', pageId, '--fields', `body=${markdown}`], configDir)
    const read = await runCliJson<Storage>(['conni', 'content', pageId], configDir)
    return read.data.body.storage.value
  }

  it('renders a single newline as a hard break, not a collapsed paragraph', async () => {
    // The highest-value assertion in the suite. src/markdown.ts enables marked's
    // `breaks` option so a single newline becomes a hardBreak node; without it
    // marklassian collapses the two lines into one run-on paragraph and this
    // fails. There is no false-green path: `<br />` is either there or it is not.
    const storage = await roundTrip('line one\nline two')
    expect(storage).to.contain('line one<br />line two')
  })

  it(String.raw`unescapes a literal \n typed inside one shell argument`, async () => {
    // How shell users pass a multi-line body without a real newline. Handled by
    // unescapeNewlines(), and it must reach the same hard break as above.
    const storage = await roundTrip(String.raw`esc one\nesc two`)
    expect(storage).to.contain('esc one<br />esc two')
  })

  it('applies hard breaks inside list items and blockquotes too', async () => {
    const storage = await roundTrip('- item a\nline under a\n- item b\n\n> quote one\n> quote two')
    expect(storage).to.contain('item a<br />line under a')
    expect(storage).to.contain('quote one<br />quote two')
  })

  it('leaves code blocks unpadded and free of injected breaks', async () => {
    const storage = await roundTrip('```bash\nls -a\ncd /tmp\n```')

    // marked's grammar protects block constructs, so `breaks` must not reach
    // inside a fenced block. The newline between the two commands has to stay a
    // real newline in the CDATA rather than becoming a <br /> or gaining
    // surrounding blank lines.
    expect(storage).to.contain('<![CDATA[ls -a\ncd /tmp]]>')
    expect(storage).to.contain('ac:name="code"')
    expect(storage).to.contain('<ac:parameter ac:name="language">bash</ac:parameter>')
  })

  it('converts a Markdown table into real table structure', async () => {
    const storage = await roundTrip('| A | B |\n| - | - |\n| 1 | 2 |')

    // Asserting on the structure, not just the cell text: text alone would
    // still pass if the table were never parsed and the pipes survived as a
    // literal paragraph.
    expect(storage).to.contain('<table')
    expect(storage).to.contain('<th><p>A</p></th>')
    expect(storage).to.contain('<td><p>1</p></td>')
    expect(storage).to.not.contain('| A | B |')
  })

  it('converts headings and inline emphasis', async () => {
    const storage = await roundTrip('# Head\n\nsome **bold** and *italic* text')
    expect(storage).to.contain('<h1>Head</h1>')
    expect(storage).to.contain('<strong>bold</strong>')
    expect(storage).to.contain('<em>italic</em>')
  })

  it('adds, updates and deletes a comment', async () => {
    const added = await runCliJson<{data: {id: string; pageId: string}; success: boolean}>(
      ['conni', 'content', 'comment', pageId, 'first line\nsecond line'],
      configDir,
    )
    expect(added.success).to.be.true
    // The comment response carries no `type` field; pageId is what identifies
    // the created thing as a comment on this page.
    expect(added.data.pageId).to.equal(pageId)
    const commentId = added.data.id
    expect(isNumericId(commentId), `expected a numeric comment id, got ${commentId}`).to.be.true

    // A comment body goes through the same Markdown → ADF path as a page body,
    // so the hard break has to survive here too.
    const read = await runCliJson<Storage>(['conni', 'content', commentId], configDir)
    expect(read.data.body.storage.value).to.contain('first line<br />second line')

    const updated = await runCliJson<{success: boolean}>(
      ['conni', 'content', 'comment-update', commentId, 'edited body'],
      configDir,
    )
    expect(updated.success).to.be.true

    const reread = await runCliJson<Storage>(['conni', 'content', commentId], configDir)
    expect(reread.data.body.storage.value).to.contain('edited body')
    expect(reread.data.body.storage.value).to.not.contain('first line')

    const deleted = await runCliJson<{success: boolean}>(['conni', 'content', 'comment-delete', commentId], configDir)
    expect(deleted.success).to.be.true
  })

  it('adds, lists and removes labels', async () => {
    const added = await runCliJson<Labels>(['conni', 'content', 'label', pageId, 'alpha,beta'], configDir)
    expect(added.success).to.be.true
    expect(added.data.results.map((label) => label.name)).to.include.members(['alpha', 'beta'])

    const listed = await runCliJson<Labels>(['conni', 'content', 'label-list', pageId], configDir)
    expect(listed.data.results.map((label) => label.name)).to.include.members(['alpha', 'beta'])

    const removed = await runCliJson<{success: boolean}>(
      ['conni', 'content', 'label-delete', pageId, 'alpha'],
      configDir,
    )
    expect(removed.success).to.be.true

    const after = await runCliJson<Labels>(['conni', 'content', 'label-list', pageId], configDir)
    const names = after.data.results.map((label) => label.name)
    expect(names).to.not.include('alpha')
    // Only the named label goes: a delete that took the rest with it would
    // still satisfy the assertion above.
    expect(names).to.include('beta')
  })

  it('reports a failure when commenting on a page that does not exist', async () => {
    const {code, stdout} = await runCli(['conni', 'content', 'comment', '999999999', 'orphan'], configDir)
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
  })
})
