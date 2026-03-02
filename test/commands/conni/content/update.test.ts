/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:update', () => {
  let ContentUpdate: any
  let mockReadConfig: any
  let mockUpdateContent: any
  let mockClearClients: any
  let jsonOutput: any

  beforeEach(async () => {
    jsonOutput = null

    mockReadConfig = async () => ({
      auth: {
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      },
    })

    mockUpdateContent = async (_config: any, _pageId: string, _fields: any) => ({
      data: {
        id: '123456',
        title: 'Updated Page',
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })
  })

  it('updates content with valid fields', async () => {
    const command = new ContentUpdate.default(
      ['123456', '--fields', 'title=Updated Title', '--fields', 'body=Updated body'],
      createMockConfig(),
    )

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
  })

  it('parses fields with equals signs in values correctly', async () => {
    let receivedFields: any = null

    mockUpdateContent = async (_config: any, _pageId: string, fields: any) => {
      receivedFields = fields
      return {data: {id: '123456'}, success: true}
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Title=With=Equals'], createMockConfig())

    command.logJson = () => {}

    await command.run()

    expect(receivedFields).to.have.property('title', 'Title=With=Equals')
  })

  it('passes correct page ID to updateContent', async () => {
    let receivedPageId: null | string = null

    mockUpdateContent = async (_config: any, pageId: string, _fields: any) => {
      receivedPageId = pageId
      return {data: {id: pageId}, success: true}
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(['789012', '--fields', 'title=Test'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(receivedPageId).to.equal('789012')
  })

  it('handles multiple field updates', async () => {
    let receivedFields: any = null

    mockUpdateContent = async (_config: any, _pageId: string, fields: any) => {
      receivedFields = fields
      return {data: {id: '123456'}, success: true}
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(
      ['123456', '--fields', 'title=New Title', '--fields', 'body=New Body'],
      createMockConfig(),
    )

    command.logJson = () => {}

    await command.run()

    expect(receivedFields).to.have.property('title', 'New Title')
    expect(receivedFields).to.have.property('body', 'New Body')
  })

  it('handles API errors gracefully', async () => {
    mockUpdateContent = async () => ({
      error: 'Content not found',
      success: false,
    })

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(['999999', '--fields', 'title=Test'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Test'], createMockConfig())
    let updateContentCalled = false

    mockUpdateContent = async () => {
      updateContentCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(updateContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Test'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
