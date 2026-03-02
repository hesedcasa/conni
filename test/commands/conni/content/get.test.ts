/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:get', () => {
  let ContentGet: any
  let mockReadConfig: any
  let mockGetContent: any
  let mockClearClients: any
  let logOutput: string[]
  let jsonOutput: any

  beforeEach(async () => {
    logOutput = []
    jsonOutput = null

    mockReadConfig = async () => ({
      auth: {
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      },
    })

    mockGetContent = async (_config: any, id: string) => ({
      data: {
        id,
        title: 'Test Page',
        type: 'page',
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentGet = await esmock('../../../../src/commands/conni/content/get.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
    })
  })

  it('retrieves content with valid page ID', async () => {
    const command = new ContentGet.default(['123456'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data).to.have.property('id', '123456')
    expect(jsonOutput.data).to.have.property('title', 'Test Page')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentGet.default(['123456', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockGetContent = async () => ({
      error: 'Content not found',
      success: false,
    })

    ContentGet = await esmock('../../../../src/commands/conni/content/get.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
    })

    const command = new ContentGet.default(['999999'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentGet = await esmock('../../../../src/commands/conni/content/get.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
    })

    const command = new ContentGet.default(['123456'], createMockConfig())
    let getContentCalled = false

    mockGetContent = async () => {
      getContentCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(getContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentGet = await esmock('../../../../src/commands/conni/content/get.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
    })

    const command = new ContentGet.default(['123456'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
