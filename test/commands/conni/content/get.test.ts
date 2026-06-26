/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:get', () => {
  let ContentGet: any
  let mockCreateProfileManager: any
  let mockGetContent: any
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

    mockGetContent = async (_config: any, id: string) => ({
      data: {
        id,
        title: 'Test Page',
        type: 'page',
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentGet = await esmock('../../../../src/commands/conni/content/index.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('retrieves content with valid page ID', async () => {
    const command = new ContentGet.default(['123456'], createMockConfig())

    const result = await command.run()

    expect(result).to.not.be.null
    expect(result.success).to.be.true
    expect(result.data).to.have.property('id', '123456')
    expect(result.data).to.have.property('title', 'Test Page')
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

    ContentGet = await esmock('../../../../src/commands/conni/content/index.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentGet.default(['999999'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    ContentGet = await esmock('../../../../src/commands/conni/content/index.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentGet.default(['123456'], createMockConfig())
    let getContentCalled = false

    mockGetContent = async () => {
      getContentCalled = true
      return {data: {}, success: true}
    }

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(getContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentGet = await esmock('../../../../src/commands/conni/content/index.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getContent: mockGetContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentGet.default(['123456'], createMockConfig())

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
