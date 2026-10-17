/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:comment-update', () => {
  let ContentUpdateComment: any
  let mockCreateProfileManager: any
  let mockUpdateComment: any
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

    mockUpdateComment = async () => ({
      data: {
        id: '1544224770',
        type: 'comment',
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('updates comment successfully', async () => {
    const command = new ContentUpdateComment.default(['1544224770', 'Updated comment text'], createMockConfig())

    const result = await command.run()

    expect(result).to.not.be.null
    expect(result.success).to.be.true
    expect(result.data.id).to.equal('1544224770')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentUpdateComment.default(
      ['1544224770', 'Updated comment text', '--toon'],
      createMockConfig(),
    )

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockUpdateComment = async () => ({
      error: 'Comment not found',
      success: false,
    })

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdateComment.default(['9999999', 'Updated text'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Comment not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdateComment.default(['1544224770', 'Updated text'], createMockConfig())
    let updateCommentCalled = false

    mockUpdateComment = async () => {
      updateCommentCalled = true
      return {data: {}, success: true}
    }

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(updateCommentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdateComment.default(['1544224770', 'Updated text'], createMockConfig())

    await command.run()

    expect(clearClientsCalled).to.be.true
  })

  it('reads the comment from an @<path> body', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'conni-comment-update-'))
    const file = path.join(dir, 'body.md')
    writeFileSync(file, 'updated from file')
    let capturedBody: string | undefined

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        async updateComment(_config: any, _id: string, body: string) {
          capturedBody = body
          return {data: {id: '10001'}, success: true}
        },
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    try {
      await new ContentUpdateComment.default(['10001', `@${file}`], createMockConfig()).run()
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }

    expect(capturedBody).to.equal('updated from file')
  })
})
