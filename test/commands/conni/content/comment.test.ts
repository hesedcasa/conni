/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:comment', () => {
  let ContentAddComment: any
  let mockCreateProfileManager: any
  let mockAddComment: any
  let mockClearClients: any
  let logOutput: string[]

  beforeEach(async () => {
    logOutput = []

    mockCreateProfileManager = () => ({
      loadAuthConfig: async () => ({
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      }),
    })

    mockAddComment = async () => ({
      data: {id: '10001', type: 'comment'},
      success: true,
    })

    mockClearClients = () => {}

    ContentAddComment = await esmock('../../../../src/commands/conni/content/comment.js', {
      '../../../../src/conni/conni-client.js': {
        addComment: mockAddComment,
        clearClients: mockClearClients,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('adds comment successfully', async () => {
    const command = new ContentAddComment.default(['123456', 'Test comment'], createMockConfig())

    const result = await command.run()

    expect(result).to.not.be.null
    expect(result.success).to.be.true
    expect(result.data).to.have.property('id', '10001')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentAddComment.default(['123456', 'Test comment', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockAddComment = async () => ({
      error: 'Permission denied',
      success: false,
    })

    ContentAddComment = await esmock('../../../../src/commands/conni/content/comment.js', {
      '../../../../src/conni/conni-client.js': {
        addComment: mockAddComment,
        clearClients: mockClearClients,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentAddComment.default(['123456', 'Test comment'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Permission denied')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    ContentAddComment = await esmock('../../../../src/commands/conni/content/comment.js', {
      '../../../../src/conni/conni-client.js': {
        addComment: mockAddComment,
        clearClients: mockClearClients,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentAddComment.default(['123456', 'Test comment'], createMockConfig())
    let addCommentCalled = false

    mockAddComment = async () => {
      addCommentCalled = true
      return {data: {}, success: true}
    }

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
      // Pinned contract (CLAUDE.md): a missing profile exits 1 — not an @oclif/core default.
      expect(error.oclif.exit).to.equal(1)
    }

    expect(addCommentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentAddComment = await esmock('../../../../src/commands/conni/content/comment.js', {
      '../../../../src/conni/conni-client.js': {
        addComment: mockAddComment,
        clearClients: mockClearClients,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentAddComment.default(['123456', 'Test comment'], createMockConfig())

    await command.run()

    expect(clearClientsCalled).to.be.true
  })

  describe('@<path> body', () => {
    let dir: string
    let capturedBody: string | undefined

    beforeEach(async () => {
      dir = mkdtempSync(path.join(tmpdir(), 'conni-comment-'))
      capturedBody = undefined
      ContentAddComment = await esmock('../../../../src/commands/conni/content/comment.js', {
        '../../../../src/conni/conni-client.js': {
          async addComment(_config: any, _pageId: string, body: string) {
            capturedBody = body
            return {data: {id: '10001'}, success: true}
          },
          clearClients: mockClearClients,
        },
        '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
      })
    })

    afterEach(() => {
      rmSync(dir, {force: true, recursive: true})
    })

    it('reads the comment from the file', async () => {
      const file = path.join(dir, 'body.md')
      writeFileSync(file, '# Long comment\n\nbody')

      await new ContentAddComment.default(['123456', `@${file}`], createMockConfig()).run()

      expect(capturedBody).to.equal('# Long comment\n\nbody')
    })

    it('keeps a literal leading @ escaped as @@', async () => {
      await new ContentAddComment.default(['123456', '@@team please review'], createMockConfig()).run()

      expect(capturedBody).to.equal('@team please review')
    })
  })
})
