/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:label', () => {
  let ContentLabel: any
  let mockCreateProfileManager: any
  let mockAddLabels: any
  let mockClearClients: any
  let logOutput: string[]

  const loadCommand = async () =>
    esmock('../../../../src/commands/conni/content/label.js', {
      '../../../../src/conni/conni-client.js': {
        addLabels: async (...args: any[]) => mockAddLabels(...args),
        clearClients: () => mockClearClients(),
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

    mockAddLabels = async () => ({
      data: {results: [{id: '1', label: 'release-notes', name: 'release-notes', prefix: 'global'}], size: 1},
      success: true,
    })

    mockClearClients = () => {}

    ContentLabel = await loadCommand()
  })

  it('adds a single label successfully', async () => {
    const command = new ContentLabel.default(['123456', 'release-notes'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.true
    expect(result.data).to.have.property('size', 1)
  })

  it('splits a comma-separated list into multiple labels', async () => {
    let receivedLabels: string[] = []
    mockAddLabels = async (_auth: any, _pageId: string, labels: string[]) => {
      receivedLabels = labels
      return {data: {}, success: true}
    }

    const command = new ContentLabel.default(['123456', 'release-notes, q3 ,draft'], createMockConfig())
    await command.run()

    expect(receivedLabels).to.deep.equal(['release-notes', 'q3', 'draft'])
  })

  it('defaults the prefix to global and honours --prefix', async () => {
    let receivedPrefix = ''
    mockAddLabels = async (_auth: any, _pageId: string, _labels: string[], prefix: string) => {
      receivedPrefix = prefix
      return {data: {}, success: true}
    }

    await new ContentLabel.default(['123456', 'draft'], createMockConfig()).run()
    expect(receivedPrefix).to.equal('global')

    await new ContentLabel.default(['123456', 'favourite', '--prefix', 'my'], createMockConfig()).run()
    expect(receivedPrefix).to.equal('my')
  })

  it('errors when no label names are provided', async () => {
    let addLabelsCalled = false
    mockAddLabels = async () => {
      addLabelsCalled = true
      return {data: {}, success: true}
    }

    const command = new ContentLabel.default(['123456', ' , '], createMockConfig())

    try {
      await command.run()
      expect.fail('expected an error')
    } catch (error: any) {
      expect(error.message).to.include('No label names provided.')
    }

    expect(addLabelsCalled).to.be.false
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentLabel.default(['123456', 'release-notes', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockAddLabels = async () => ({error: 'Label creation failed', success: false})

    const command = new ContentLabel.default(['123456', 'release-notes'], createMockConfig())
    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Label creation failed')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })
    let addLabelsCalled = false
    mockAddLabels = async () => {
      addLabelsCalled = true
      return {data: {}, success: true}
    }

    ContentLabel = await loadCommand()
    const command = new ContentLabel.default(['123456', 'release-notes'], createMockConfig())

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(addLabelsCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false
    mockClearClients = () => {
      clearClientsCalled = true
    }

    const command = new ContentLabel.default(['123456', 'release-notes'], createMockConfig())
    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
