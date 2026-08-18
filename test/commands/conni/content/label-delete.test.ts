/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:label-delete', () => {
  let ContentDeleteLabel: any
  let mockCreateProfileManager: any
  let mockRemoveLabel: any
  let mockClearClients: any
  let logOutput: string[]

  const loadCommand = async () =>
    esmock('../../../../src/commands/conni/content/label-delete.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: () => mockClearClients(),
        removeLabel: async (...args: any[]) => mockRemoveLabel(...args),
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

  beforeEach(async () => {
    logOutput = []

    mockCreateProfileManager = () => ({
      loadAuthConfig: async () => ({
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      }),
    })

    mockRemoveLabel = async () => ({data: true, success: true})
    mockClearClients = () => {}

    ContentDeleteLabel = await loadCommand()
  })

  it('removes a label successfully', async () => {
    const command = new ContentDeleteLabel.default(['123456', 'release-notes'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.true
    expect(result.data).to.be.true
  })

  it('passes the page ID and label name through', async () => {
    let received: any[] = []
    mockRemoveLabel = async (_auth: any, pageId: string, label: string) => {
      received = [pageId, label]
      return {data: true, success: true}
    }

    await new ContentDeleteLabel.default(['123456', 'team/backend'], createMockConfig()).run()

    expect(received).to.deep.equal(['123456', 'team/backend'])
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentDeleteLabel.default(['123456', 'release-notes', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockRemoveLabel = async () => ({error: 'Label not found', success: false})

    const command = new ContentDeleteLabel.default(['123456', 'missing'], createMockConfig())
    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Label not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })
    let removeLabelCalled = false
    mockRemoveLabel = async () => {
      removeLabelCalled = true
      return {data: true, success: true}
    }

    ContentDeleteLabel = await loadCommand()
    const command = new ContentDeleteLabel.default(['123456', 'release-notes'], createMockConfig())

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(removeLabelCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false
    mockClearClients = () => {
      clearClientsCalled = true
    }

    const command = new ContentDeleteLabel.default(['123456', 'release-notes'], createMockConfig())
    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
