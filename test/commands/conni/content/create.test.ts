/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:create', () => {
  let ContentCreate: any
  let mockReadConfig: any
  let mockCreatePage: any
  let mockClearClients: any
  let jsonOutput: any
  let logOutput: string[]
  let errorOutput: null | string

  beforeEach(async () => {
    jsonOutput = null
    logOutput = []
    errorOutput = null

    mockReadConfig = async () => ({
      auth: {
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      },
    })

    mockCreatePage = async (_config: any, _fields: any) => ({
      data: {
        id: '123456',
        title: 'New Page',
        type: 'page',
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
      },
    })
  })

  it('creates page with all required fields', async () => {
    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=# Hello World'],
      createMockConfig(),
    )

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data).to.have.property('title', 'New Page')
  })

  it('parses fields with equals signs in values correctly', async () => {
    let receivedFields: any = null

    mockCreatePage = async (_config: any, fields: any) => {
      receivedFields = fields
      return {data: {id: '123456', title: 'Test'}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=Title=With=Equals', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(receivedFields).to.have.property('title', 'Title=With=Equals')
  })

  it('throws error when required field "spaceKey" is missing', async () => {
    const command = new ContentCreate.default(
      ['--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.error = (message: string) => {
      errorOutput = message
      throw new Error(message)
    }

    try {
      await command.run()
    } catch {
      // Expected to throw
    }

    expect(errorOutput).to.include('Required field "spaceKey" is missing')
  })

  it('throws error when required field "title" is missing', async () => {
    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.error = (message: string) => {
      errorOutput = message
      throw new Error(message)
    }

    try {
      await command.run()
    } catch {
      // Expected to throw
    }

    expect(errorOutput).to.include('Required field "title" is missing')
  })

  it('throws error when required field "body" is missing', async () => {
    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page'],
      createMockConfig(),
    )

    command.error = (message: string) => {
      errorOutput = message
      throw new Error(message)
    }

    try {
      await command.run()
    } catch {
      // Expected to throw
    }

    expect(errorOutput).to.include('Required field "body" is missing')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content', '--toon'],
      createMockConfig(),
    )

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockCreatePage = async () => ({
      error: 'Permission denied',
      success: false,
    })

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Permission denied')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    let createPageCalled = false

    mockCreatePage = async () => {
      createPageCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(createPageCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
