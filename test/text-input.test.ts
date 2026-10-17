import {expect} from 'chai'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {readTextValue} from '../src/text-input.js'

describe('text-input', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'conni-text-input-'))
    file = path.join(dir, 'value.md')
    writeFileSync(file, 'from file')
  })

  afterEach(() => {
    rmSync(dir, {force: true, recursive: true})
  })

  it('readTextValue reads @<path>, unescapes @@ and passes anything else through', async () => {
    expect(await readTextValue(`@${file}`)).to.equal('from file')
    expect(await readTextValue('@@team')).to.equal('@team')
    expect(await readTextValue('plain @ text')).to.equal('plain @ text')
  })

  it('readTextValue names the path when it cannot be read', async () => {
    const error = await readTextValue(`@${path.join(dir, 'missing.md')}`).catch((error_: Error) => error_)
    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.include('missing.md')
  })
})
