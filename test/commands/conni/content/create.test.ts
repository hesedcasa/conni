/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:create', () => {
  let ContentCreate: any
  let mockReadConfig: any
  let mockCreatePage: any
  let mockCreatePageWithMedia: any
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

    mockCreatePageWithMedia = async (_config: any, _fields: any, _filePaths: any) => ({
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
        createPageWithMedia: mockCreatePageWithMedia,
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
        createPageWithMedia: mockCreatePageWithMedia,
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
        createPageWithMedia: mockCreatePageWithMedia,
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
        createPageWithMedia: mockCreatePageWithMedia,
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
        createPageWithMedia: mockCreatePageWithMedia,
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

  it('calls createPageWithMedia when --attach flag is provided', async () => {
    let createPageWithMediaCalled = false
    let receivedFilePaths: any = null

    mockCreatePageWithMedia = async (_config: any, _fields: any, filePaths: any) => {
      createPageWithMediaCalled = true
      receivedFilePaths = filePaths
      return {data: {id: '123456', title: 'New Page', type: 'page'}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const command = new ContentCreate.default(
      [
        '--fields',
        'spaceKey=DEV',
        '--fields',
        'title=New Page',
        '--fields',
        'body=![img](./image.png)',
        '--attach',
        './image.png',
      ],
      createMockConfig(),
    )

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(createPageWithMediaCalled).to.be.true
    expect(receivedFilePaths).to.deep.equal(['./image.png'])
    expect(jsonOutput.success).to.be.true
  })

  it('calls createPage (not createPageWithMedia) when no --attach flag', async () => {
    let createPageCalled = false
    let createPageWithMediaCalled = false

    mockCreatePage = async () => {
      createPageCalled = true
      return {data: {id: '123456', title: 'New Page'}, success: true}
    }

    mockCreatePageWithMedia = async () => {
      createPageWithMediaCalled = true
      return {data: {}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(createPageCalled).to.be.true
    expect(createPageWithMediaCalled).to.be.false
  })

  it('passes multiple attach paths to createPageWithMedia', async () => {
    let receivedFilePaths: any = null

    mockCreatePageWithMedia = async (_config: any, _fields: any, filePaths: any) => {
      receivedFilePaths = filePaths
      return {data: {id: '123456', title: 'New Page'}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const command = new ContentCreate.default(
      [
        '--fields',
        'spaceKey=DEV',
        '--fields',
        'title=New Page',
        '--fields',
        'body=Content',
        '--attach',
        './image.png',
        '--attach',
        './report.pdf',
      ],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(receivedFilePaths).to.deep.equal(['./image.png', './report.pdf'])
  })

  it('passes useStorageFormat=true to createPage when --storage flag is provided', async () => {
    let receivedUseStorageFormat: any = null

    mockCreatePage = async (_config: any, _fields: any, useStorageFormat: any) => {
      receivedUseStorageFormat = useStorageFormat
      return {data: {id: '123456', title: 'New Page'}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const storageBody =
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Note</p></ac:rich-text-body></ac:structured-macro>'

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', `--fields`, `body=${storageBody}`, '--storage'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(receivedUseStorageFormat).to.be.true
  })

  it('passes useStorageFormat=false to createPage when --storage flag is not provided', async () => {
    let receivedUseStorageFormat: any = null

    mockCreatePage = async (_config: any, _fields: any, useStorageFormat: any) => {
      receivedUseStorageFormat = useStorageFormat
      return {data: {id: '123456', title: 'New Page'}, success: true}
    }

    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const command = new ContentCreate.default(
      ['--fields', 'spaceKey=DEV', '--fields', 'title=New Page', '--fields', 'body=Content'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(receivedUseStorageFormat).to.be.false
  })

  it('errors when both --storage and --attach are provided', async () => {
    ContentCreate = await esmock('../../../../src/commands/conni/content/create.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        createPage: mockCreatePage,
        createPageWithMedia: mockCreatePageWithMedia,
      },
    })

    const command = new ContentCreate.default(
      [
        '--fields',
        'spaceKey=DEV',
        '--fields',
        'title=New Page',
        '--fields',
        'body=Content',
        '--storage',
        '--attach',
        './image.png',
      ],
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

    expect(errorOutput).to.include('--storage and --attach cannot be used together')
  })
})
