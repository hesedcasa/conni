/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:delete', () => {
  let ContentDelete: any
  let mockCreateProfileManager: any
  let mockDeleteContent: any
  let mockClearClients: any

  beforeEach(async () => {
    mockCreateProfileManager = () => ({
      loadAuthConfig: async () => ({
        apiToken: 'test-token',
        email: 'test@example.com',
        host: 'https://test.atlassian.net',
      }),
    })

    mockDeleteContent = async () => ({
      data: true,
      success: true,
    })

    mockClearClients = () => {}

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })
  })

  it('deletes content successfully', async () => {
    const command = new ContentDelete.default(['123456'], createMockConfig())

    const result = await command.run()

    expect(result).to.not.be.null
    expect(result.success).to.be.true
  })

  it('handles API errors gracefully', async () => {
    mockDeleteContent = async () => ({
      error: 'Content not found',
      success: false,
    })

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentDelete.default(['999999'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Content not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentDelete.default(['123456'], createMockConfig())
    let deleteContentCalled = false

    mockDeleteContent = async () => {
      deleteContentCalled = true
      return {data: true, success: true}
    }

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(deleteContentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentDelete = await esmock('../../../../src/commands/conni/content/delete.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        deleteContent: mockDeleteContent,
      },
      '@hesed/plugin-lib': {createProfileManager: mockCreateProfileManager},
    })

    const command = new ContentDelete.default(['123456'], createMockConfig())

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
