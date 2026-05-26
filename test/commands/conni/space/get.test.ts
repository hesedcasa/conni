/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('space:get', () => {
  let SpaceGet: any
  let mockCreateProfileManager: any
  let mockGetSpace: any
  let mockClearClients: any
  let logOutput: string[]
  let jsonOutput: any

  beforeEach(async () => {
    logOutput = []
    jsonOutput = null

    mockCreateProfileManager = () => ({
      loadAuthConfig: async () => ({
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      }),
    })

    mockGetSpace = async (_config: any, spaceKey: string) => ({
      data: {
        description: {plain: {value: 'Test space description'}},
        key: spaceKey,
        name: 'Test Space',
        type: 'global',
      },
      success: true,
    })

    mockClearClients = () => {}

    SpaceGet = await esmock('../../../../src/commands/conni/space/get.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getSpace: mockGetSpace,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('retrieves space with valid space key', async () => {
    const command = new SpaceGet.default(['DEV'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data).to.have.property('key', 'DEV')
    expect(jsonOutput.data).to.have.property('name', 'Test Space')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new SpaceGet.default(['DEV', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockGetSpace = async () => ({
      error: 'Space not found',
      success: false,
    })

    SpaceGet = await esmock('../../../../src/commands/conni/space/get.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getSpace: mockGetSpace,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new SpaceGet.default(['INVALID'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Space not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    SpaceGet = await esmock('../../../../src/commands/conni/space/get.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getSpace: mockGetSpace,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new SpaceGet.default(['DEV'], createMockConfig())
    let getSpaceCalled = false

    mockGetSpace = async () => {
      getSpaceCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(getSpaceCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    SpaceGet = await esmock('../../../../src/commands/conni/space/get.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        getSpace: mockGetSpace,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new SpaceGet.default(['DEV'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
