/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:delete', () => {
  let ContentDelete: any
  let mockReadConfig: any
  let mockDeleteContent: any
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

    mockDeleteContent = async () => ({
      data: true,
      success: true,
    })

    mockClearClients = () => {}

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
    })
  })

  it('deletes content successfully', async () => {
    const command = new ContentDelete.default(['123456'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
  })

  it('handles API errors gracefully', async () => {
    mockDeleteContent = async () => ({
      error: 'Content not found',
      success: false,
    })

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
    })

    const command = new ContentDelete.default(['999999'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
    })

    const command = new ContentDelete.default(['123456'], createMockConfig())
    let deleteContentCalled = false

    mockDeleteContent = async () => {
      deleteContentCalled = true
      return {data: true, success: true}
    }

    await command.run()

    expect(deleteContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
    })

    const command = new ContentDelete.default(['123456'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
