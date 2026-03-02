/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:comment-delete', () => {
  let ContentDeleteComment: any
  let mockReadConfig: any
  let mockDeleteComment: any
  let mockClearClients: any
  let jsonOutput: any

  beforeEach(async () => {
    jsonOutput = null

    mockReadConfig = async () => ({
      auth: {
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      },
    })

    mockDeleteComment = async () => ({
      data: true,
      success: true,
    })

    mockClearClients = () => {}

    ContentDeleteComment = await esmock('../../../../src/commands/conni/content/comment-delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteComment: mockDeleteComment,
      },
    })
  })

  it('deletes comment successfully', async () => {
    const command = new ContentDeleteComment.default(['1544224770'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
  })

  it('handles API errors gracefully', async () => {
    mockDeleteComment = async () => ({
      error: 'Comment not found',
      success: false,
    })

    ContentDeleteComment = await esmock('../../../../src/commands/conni/content/comment-delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteComment: mockDeleteComment,
      },
    })

    const command = new ContentDeleteComment.default(['9999999'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Comment not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentDeleteComment = await esmock('../../../../src/commands/conni/content/comment-delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteComment: mockDeleteComment,
      },
    })

    const command = new ContentDeleteComment.default(['1544224770'], createMockConfig())
    let deleteCommentCalled = false

    mockDeleteComment = async () => {
      deleteCommentCalled = true
      return {data: true, success: true}
    }

    await command.run()

    expect(deleteCommentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentDeleteComment = await esmock('../../../../src/commands/conni/content/comment-delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteComment: mockDeleteComment,
      },
    })

    const command = new ContentDeleteComment.default(['1544224770'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
