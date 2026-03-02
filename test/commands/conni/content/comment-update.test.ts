/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:comment-update', () => {
  let ContentUpdateComment: any
  let mockReadConfig: any
  let mockUpdateComment: any
  let mockClearClients: any
  let jsonOutput: any
  let logOutput: string[]

  beforeEach(async () => {
    jsonOutput = null
    logOutput = []

    mockReadConfig = async () => ({
      auth: {
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      },
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
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
    })
  })

  it('updates comment successfully', async () => {
    const command = new ContentUpdateComment.default(['1544224770', 'Updated comment text'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data.id).to.equal('1544224770')
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
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
    })

    const command = new ContentUpdateComment.default(['9999999', 'Updated text'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Comment not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
    })

    const command = new ContentUpdateComment.default(['1544224770', 'Updated text'], createMockConfig())
    let updateCommentCalled = false

    mockUpdateComment = async () => {
      updateCommentCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(updateCommentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentUpdateComment = await esmock('../../../../src/commands/conni/content/comment-update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateComment: mockUpdateComment,
      },
    })

    const command = new ContentUpdateComment.default(['1544224770', 'Updated text'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
