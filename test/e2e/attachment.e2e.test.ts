import {expect} from 'chai'
import {Buffer} from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {cleanupRun, deletePage, fixtureTitle, seedPage, trackPage} from './fixtures.js'
import {createConfigDir, E2E_SPACE, removeConfigDir, runCli, runCliJson} from './helpers.js'

type Attachments = {data: {results: Array<{id: string; title: string}>}; success: boolean}
type Download = {data: {filename: string; savedTo: string; size: number}; success: boolean}
type Storage = {data: {body: {storage: {value: string}}; id: string}; success: boolean}

const FILE_BODY = 'e2e attachment fixture\nsecond line\n'
// A one-pixel PNG, so the inline-media test embeds something Confluence will
// actually accept as an image rather than a renamed text file.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('e2e: attachments', () => {
  let configDir: string
  let workDir: string
  let pageId: string

  before(async () => {
    configDir = await createConfigDir()
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conni-e2e-files-'))
    pageId = await seedPage({title: fixtureTitle('attachments')})
  })

  // finally: a failed cleanup must not skip the token-bearing config dir or the
  // temp file directory.
  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
      await fs.rm(workDir, {force: true, recursive: true})
    }
  })

  it('uploads a file and downloads it back byte-for-byte', async () => {
    const source = path.join(workDir, 'fixture.txt')
    await fs.writeFile(source, FILE_BODY)

    const uploaded = await runCliJson<Attachments>(['conni', 'content', 'attachment', pageId, source], configDir)
    expect(uploaded.success).to.be.true
    expect(uploaded.data.results.length).to.equal(1)
    expect(uploaded.data.results[0].title).to.equal('fixture.txt')

    const attachmentId = uploaded.data.results[0].id
    const target = path.join(workDir, 'downloaded.txt')
    const downloaded = await runCliJson<Download>(
      ['conni', 'content', 'attachment-download', attachmentId, target],
      configDir,
    )
    expect(downloaded.success).to.be.true
    expect(downloaded.data.filename).to.equal('fixture.txt')
    expect(downloaded.data.savedTo).to.equal(target)

    // Compared as bytes, not as decoded text: a transfer that mangled the
    // encoding or line endings would still match as a string.
    const original = await fs.readFile(source)
    const roundTripped = await fs.readFile(target)
    expect(roundTripped.equals(original), 'downloaded bytes differ from the uploaded file').to.be.true
    expect(downloaded.data.size).to.equal(original.length)
  })

  it('reports a missing source file without throwing', async () => {
    const missing = path.join(workDir, 'nope.txt')
    const {code, stdout} = await runCli(['conni', 'content', 'attachment', pageId, missing], configDir)

    // Exit 0 with success:false — the documented ApiResult contract, and the
    // reason a shell caller has to branch on `success` rather than on $?.
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
    expect(payload.error).to.contain('File not found')
    expect(payload.error).to.contain('nope.txt')
  })

  it('rejects a second attachment with the same filename', async () => {
    const source = path.join(workDir, 'duplicate.txt')
    await fs.writeFile(source, FILE_BODY)

    const first = await runCliJson<Attachments>(['conni', 'content', 'attachment', pageId, source], configDir)
    expect(first.success).to.be.true

    const {stdout} = await runCli(['conni', 'content', 'attachment', pageId, source], configDir)
    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
    expect(payload.error).to.contain('same file name')
  })

  it('embeds an attachment inline where the Markdown image references it', async () => {
    const image = path.join(workDir, 'diagram.png')
    await fs.writeFile(image, Buffer.from(PNG_BASE64, 'base64'))

    const created = await runCliJson<Storage>(
      [
        'conni',
        'content',
        'create',
        '--fields',
        `spaceKey=${E2E_SPACE}`,
        '--fields',
        `title=${fixtureTitle('inline media')}`,
        '--fields',
        'body=See the diagram:\n![diagram](./diagram.png)',
        '--attach',
        image,
      ],
      configDir,
    )
    expect(created.success).to.be.true
    // Tracked before anything below can fail: a CLI-made page carries no label
    // of its own, so without this a failed assertion would leak it.
    await trackPage(created.data.id)

    const read = await runCliJson<Storage>(['conni', 'content', created.data.id], configDir)
    const storage = read.data.body.storage.value

    // patchMediaNodes() has to have rewritten the external media node to a
    // file node pointing at the upload. If it had not, the body would still
    // carry the ./diagram.png URL as an external image.
    expect(storage).to.contain('diagram.png')
    expect(storage).to.not.contain('./diagram.png')

    // Purged by id rather than left for cleanupRun: the CLI's delete only
    // trashes, and a trashed page is invisible to CQL cleanup.
    await deletePage(created.data.id)
  })

  it('appends an attachment that the body never references', async () => {
    const extra = path.join(workDir, 'report.txt')
    await fs.writeFile(extra, 'unreferenced attachment\n')

    const created = await runCliJson<Storage>(
      [
        'conni',
        'content',
        'create',
        '--fields',
        `spaceKey=${E2E_SPACE}`,
        '--fields',
        `title=${fixtureTitle('appended media')}`,
        '--fields',
        'body=No image reference here.',
        '--attach',
        extra,
      ],
      configDir,
    )
    expect(created.success).to.be.true
    // Tracked before anything below can fail, same as the inline-media test.
    await trackPage(created.data.id)

    const read = await runCliJson<Storage>(['conni', 'content', created.data.id], configDir)
    const storage = read.data.body.storage.value

    // The prose survives and the file still lands on the page, appended by
    // patchMediaNodes() rather than dropped for having no inline reference.
    expect(storage).to.contain('No image reference here.')
    expect(storage).to.contain('report.txt')

    await deletePage(created.data.id)
  })
})
