/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:update', () => {
  let ContentUpdate: any
  let mockCreateProfileManager: any
  let mockUpdateContent: any
  let mockClearClients: any

  beforeEach(async () => {
    mockCreateProfileManager = () => ({
      loadAuthConfig: async () => ({
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      }),
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
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('updates content with valid fields', async () => {
    const command = new ContentUpdate.default(
      ['123456', '--fields', 'title=Updated Title', '--fields', 'body=Updated body'],
      createMockConfig(),
    )

    const result = await command.run()

    expect(result).to.not.be.null
    expect(result.success).to.be.true
  })

  it('parses fields with equals signs in values correctly', async () => {
    let receivedFields: any = null

    mockUpdateContent = async (_config: any, _pageId: string, fields: any) => {
      receivedFields = fields
      return {data: {id: '123456'}, success: true}
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Title=With=Equals'], createMockConfig())

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
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(['789012', '--fields', 'title=Test'], createMockConfig())

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
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(
      ['123456', '--fields', 'title=New Title', '--fields', 'body=New Body'],
      createMockConfig(),
    )

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
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(['999999', '--fields', 'title=Test'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Test'], createMockConfig())
    let updateContentCalled = false

    mockUpdateContent = async () => {
      updateContentCalled = true
      return {data: {}, success: true}
    }

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(updateContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentUpdate = await esmock('../../../../src/commands/conni/content/update.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        updateContent: mockUpdateContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentUpdate.default(['123456', '--fields', 'title=Test'], createMockConfig())

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
