/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:label-list', () => {
  let ContentListLabels: any
  let mockCreateProfileManager: any
  let mockGetLabels: any
  let mockClearClients: any
  let logOutput: string[]

  const loadCommand = async () =>
    esmock('../../../../src/commands/conni/content/label-list.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: () => mockClearClients(),
        getLabels: async (...args: any[]) => mockGetLabels(...args),
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

    mockGetLabels = async () => ({
      data: {
        results: [{id: '1', label: 'release-notes', name: 'release-notes', prefix: 'global'}],
        size: 1,
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentListLabels = await loadCommand()
  })

  it('lists labels successfully', async () => {
    const command = new ContentListLabels.default(['123456'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.true
    expect(result.data.results).to.have.lengthOf(1)
  })

  it('passes prefix and limit flags through', async () => {
    let received: any[] = []
    mockGetLabels = async (_auth: any, pageId: string, prefix?: string, limit?: number) => {
      received = [pageId, prefix, limit]
      return {data: {results: []}, success: true}
    }

    await new ContentListLabels.default(['123456', '--prefix', 'my', '--limit', '50'], createMockConfig()).run()

    expect(received).to.deep.equal(['123456', 'my', 50])
  })

  it('leaves prefix and limit undefined when flags are omitted', async () => {
    let received: any[] = []
    mockGetLabels = async (_auth: any, pageId: string, prefix?: string, limit?: number) => {
      received = [pageId, prefix, limit]
      return {data: {results: []}, success: true}
    }

    await new ContentListLabels.default(['123456'], createMockConfig()).run()

    expect(received).to.deep.equal(['123456', undefined, undefined])
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentListLabels.default(['123456', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockGetLabels = async () => ({error: 'Page not found', success: false})

    const command = new ContentListLabels.default(['999999'], createMockConfig())
    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Page not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })
    let getLabelsCalled = false
    mockGetLabels = async () => {
      getLabelsCalled = true
      return {data: {}, success: true}
    }

    ContentListLabels = await loadCommand()
    const command = new ContentListLabels.default(['123456'], createMockConfig())

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(getLabelsCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false
    mockClearClients = () => {
      clearClientsCalled = true
    }

    const command = new ContentListLabels.default(['123456'], createMockConfig())
    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
