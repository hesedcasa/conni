/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:comment-list', () => {
  let ContentListComments: any
  let mockCreateProfileManager: any
  let mockGetFooterComments: any
  let mockClearClients: any
  let logOutput: string[]

  const loadCommand = async () =>
    esmock('../../../../src/commands/conni/content/comment-list.js', {
      '../../../../src/conni/conni-client.js': {
        clearClients: () => mockClearClients(),
        getFooterComments: async (...args: any[]) => mockGetFooterComments(...args),
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

    mockGetFooterComments = async () => ({
      data: {
        results: [{body: {storage: {value: '<p>hi</p>'}}, id: '10001', pageId: '123456'}],
        size: 1,
      },
      success: true,
    })

    mockClearClients = () => {}

    ContentListComments = await loadCommand()
  })

  it('lists comments successfully', async () => {
    const command = new ContentListComments.default(['123456'], createMockConfig())

    const result = await command.run()

    expect(result.success).to.be.true
    expect(result.data.results).to.have.lengthOf(1)
  })

  it('passes all flags through', async () => {
    let received: any[] = []
    mockGetFooterComments = async (_auth: any, pageId: string, opts: any) => {
      received = [pageId, opts]
      return {data: {results: []}, success: true}
    }

    await new ContentListComments.default(
      [
        '123456',
        '--limit',
        '25',
        '--cursor',
        'cur-1',
        '--sort',
        'created-date',
        '--status',
        'current',
        '--body-format',
        'view',
      ],
      createMockConfig(),
    ).run()

    expect(received).to.deep.equal([
      '123456',
      {bodyFormat: 'view', cursor: 'cur-1', limit: 25, sort: 'created-date', status: 'current'},
    ])
  })

  it('leaves all opts undefined when flags are omitted', async () => {
    let received: any[] = []
    mockGetFooterComments = async (_auth: any, pageId: string, opts: any) => {
      received = [pageId, opts]
      return {data: {results: []}, success: true}
    }

    await new ContentListComments.default(['123456'], createMockConfig()).run()

    expect(received).to.deep.equal([
      '123456',
      {bodyFormat: undefined, cursor: undefined, limit: undefined, sort: undefined, status: undefined},
    ])
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentListComments.default(['123456', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockGetFooterComments = async () => ({error: 'Page not found', success: false})

    const command = new ContentListComments.default(['999999'], createMockConfig())
    const result = await command.run()

    expect(result.success).to.be.false
    expect(result.error).to.include('Page not found')
  })

  it('exits early when config is not available', async () => {
    mockCreateProfileManager = () => ({
      async loadAuthConfig() {},
    })
    let getFooterCommentsCalled = false
    mockGetFooterComments = async () => {
      getFooterCommentsCalled = true
      return {data: {}, success: true}
    }

    ContentListComments = await loadCommand()
    const command = new ContentListComments.default(['123456'], createMockConfig())

    try {
      await command.run()
    } catch (error: any) {
      expect(error.message).to.include('Missing authentication config.')
    }

    expect(getFooterCommentsCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false
    mockClearClients = () => {
      clearClientsCalled = true
    }

    const command = new ContentListComments.default(['123456'], createMockConfig())
    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
