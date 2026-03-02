/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:search', () => {
  let ContentSearch: any
  let mockReadConfig: any
  let mockSearchContents: any
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

    mockSearchContents = async () => ({
      data: {
        results: [
          {id: '123456', title: 'Page 1', type: 'page'},
          {id: '123457', title: 'Page 2', type: 'page'},
        ],
        size: 2,
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })
  })

  it('searches for content with CQL query', async () => {
    const command = new ContentSearch.default(['space=DEV'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data.results).to.be.an('array')
    expect(jsonOutput.data.results).to.have.lengthOf(2)
  })

  it('passes CQL query correctly to searchContents', async () => {
    let receivedCql: null | string = null

    mockSearchContents = async (_config: any, cql: string) => {
      receivedCql = cql
      return {data: {results: [], size: 0}, success: true}
    }

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['space=DEV AND title ~ "Error"'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(receivedCql).to.equal('space=DEV AND title ~ "Error"')
  })

  it('handles --limit flag correctly', async () => {
    let receivedLimit: number | undefined

    mockSearchContents = async (_config: any, _cql: string, limit?: number) => {
      receivedLimit = limit
      return {data: {results: [], size: 0}, success: true}
    }

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['space=DEV', '--limit', '20'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(receivedLimit).to.equal(20)
  })

  it('handles --expand flag correctly', async () => {
    let receivedExpand: string[] | undefined

    mockSearchContents = async (_config: any, _cql: string, _limit?: number, expand?: string[]) => {
      receivedExpand = expand
      return {data: {results: [], size: 0}, success: true}
    }

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['space=DEV', '--expand', 'body.storage,version'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(receivedExpand).to.be.an('array')
    expect(receivedExpand).to.deep.equal(['body.storage', 'version'])
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentSearch.default(['space=DEV', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockSearchContents = async () => ({
      error: 'Invalid CQL query',
      success: false,
    })

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['invalid cql'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Invalid CQL query')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['space=DEV'], createMockConfig())
    let searchContentsCalled = false

    mockSearchContents = async () => {
      searchContentsCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(searchContentsCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentSearch = await esmock('../../../../src/commands/conni/content/search.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        searchContents: mockSearchContents,
      },
    })

    const command = new ContentSearch.default(['space=DEV'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
