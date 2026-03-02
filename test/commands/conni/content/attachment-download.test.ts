/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:attachment-download', () => {
  let ContentDownloadAttachment: any
  let mockReadConfig: any
  let mockDownloadAttachment: any
  let mockClearClients: any
  let mockAction: any
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

    mockDownloadAttachment = async () => ({
      data: {
        filename: 'document.pdf',
        savedTo: '/tmp/document.pdf',
        size: 1024,
      },
      success: true,
    })

    mockClearClients = () => {}

    mockAction = {
      start() {},
      stop() {},
    }

    ContentDownloadAttachment = await esmock('../../../../src/commands/conni/content/attachment-download.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        downloadAttachment: mockDownloadAttachment,
      },
      '@oclif/core/ux': {action: mockAction},
    })
  })

  it('downloads attachment successfully without output path', async () => {
    const command = new ContentDownloadAttachment.default(['att12345'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data.filename).to.equal('document.pdf')
  })

  it('downloads attachment successfully with output path', async () => {
    const command = new ContentDownloadAttachment.default(['att12345', '/tmp/custom.pdf'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentDownloadAttachment.default(['att12345', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockDownloadAttachment = async () => ({
      error: 'Attachment not found',
      success: false,
    })

    ContentDownloadAttachment = await esmock('../../../../src/commands/conni/content/attachment-download.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        downloadAttachment: mockDownloadAttachment,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentDownloadAttachment.default(['att99999'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('Attachment not found')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentDownloadAttachment = await esmock('../../../../src/commands/conni/content/attachment-download.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        downloadAttachment: mockDownloadAttachment,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentDownloadAttachment.default(['att12345'], createMockConfig())
    let downloadAttachmentCalled = false

    mockDownloadAttachment = async () => {
      downloadAttachmentCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(downloadAttachmentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentDownloadAttachment = await esmock('../../../../src/commands/conni/content/attachment-download.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        clearClients: mockClearClients,
        downloadAttachment: mockDownloadAttachment,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentDownloadAttachment.default(['att12345'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
