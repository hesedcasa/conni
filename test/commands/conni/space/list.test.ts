/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('space:list', () => {
  let SpaceList: any
  let mockReadConfig: any
  let mockListSpaces: any
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

    mockListSpaces = async () => ({
      data: [
        {id: '10000', key: 'DEV', name: 'Development', type: 'global'},
        {id: '10001', key: 'OPS', name: 'Operations', type: 'global'},
      ],
      success: true,
    })

    mockClearClients = () => {}

    SpaceList = await esmock('../../../../src/commands/conni/space/list.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        listSpaces: mockListSpaces,
      },
    })
  })

  it('lists spaces successfully', async () => {
    const command = new SpaceList.default([], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data).to.be.an('array')
    expect(jsonOutput.data).to.have.lengthOf(2)
    expect(jsonOutput.data[0]).to.have.property('key', 'DEV')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new SpaceList.default(['--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockListSpaces = async () => ({
      error: 'Authentication failed',
      success: false,
    })

    SpaceList = await esmock('../../../../src/commands/conni/space/list.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        listSpaces: mockListSpaces,
      },
    })

    const command = new SpaceList.default([], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Authentication failed')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    SpaceList = await esmock('../../../../src/commands/conni/space/list.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        listSpaces: mockListSpaces,
      },
    })

    const command = new SpaceList.default([], createMockConfig())
    let listSpacesCalled = false

    mockListSpaces = async () => {
      listSpacesCalled = true
      return {data: [], success: true}
    }

    await command.run()

    expect(listSpacesCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    SpaceList = await esmock('../../../../src/commands/conni/space/list.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        listSpaces: mockListSpaces,
      },
    })

    const command = new SpaceList.default([], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
