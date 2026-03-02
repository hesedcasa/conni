/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import {expect} from 'chai'
import esmock from 'esmock'

import {createMockConfig} from '../../../helpers/config-mock.js'

describe('content:attachment', () => {
  let ContentAttachment: any
  let mockReadConfig: any
  let mockAddAttachment: any
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

    mockAddAttachment = async () => ({
      data: {
        id: 'att-123',
        title: 'document.pdf',
      },
      success: true,
    })

    mockClearClients = () => {}

    mockAction = {
      start() {},
      stop() {},
    }

    ContentAttachment = await esmock('../../../../src/commands/conni/content/attachment.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        addAttachment: mockAddAttachment,
        clearClients: mockClearClients,
      },
      '@oclif/core/ux': {action: mockAction},
    })
  })

  it('uploads attachment successfully', async () => {
    const command = new ContentAttachment.default(['123456', './document.pdf'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput).to.not.be.null
    expect(jsonOutput.success).to.be.true
    expect(jsonOutput.data).to.have.property('id', 'att-123')
  })

  it('formats output as TOON when --toon flag is provided', async () => {
    const command = new ContentAttachment.default(['123456', './document.pdf', '--toon'], createMockConfig())

    command.log = (output: string) => {
      logOutput.push(output)
    }

    await command.run()

    expect(logOutput.length).to.be.greaterThan(0)
  })

  it('handles API errors gracefully', async () => {
    mockAddAttachment = async () => ({
      error: 'File upload failed',
      success: false,
    })

    ContentAttachment = await esmock('../../../../src/commands/conni/content/attachment.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        addAttachment: mockAddAttachment,
        clearClients: mockClearClients,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentAttachment.default(['123456', './nonexistent.pdf'], createMockConfig())

    command.logJson = (output: any) => {
      jsonOutput = output
    }

    await command.run()

    expect(jsonOutput.success).to.be.false
    expect(jsonOutput.error).to.include('File upload failed')
  })

  it('exits early when config is not available', async () => {
    mockReadConfig = async () => null

    ContentAttachment = await esmock('../../../../src/commands/conni/content/attachment.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        addAttachment: mockAddAttachment,
        clearClients: mockClearClients,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentAttachment.default(['123456', './document.pdf'], createMockConfig())
    let addAttachmentCalled = false

    mockAddAttachment = async () => {
      addAttachmentCalled = true
      return {data: {}, success: true}
    }

    await command.run()

    expect(addAttachmentCalled).to.be.false
  })

  it('calls clearClients after execution', async () => {
    let clearClientsCalled = false

    mockClearClients = () => {
      clearClientsCalled = true
    }

    ContentAttachment = await esmock('../../../../src/commands/conni/content/attachment.js', {
      '../../../../src/config.js': {readConfig: mockReadConfig},
      '../../../../src/conni/conni-client.js': {
        addAttachment: mockAddAttachment,
        clearClients: mockClearClients,
      },
      '@oclif/core/ux': {action: mockAction},
    })

    const command = new ContentAttachment.default(['123456', './document.pdf'], createMockConfig())
    command.logJson = () => {}

    await command.run()

    expect(clearClientsCalled).to.be.true
  })
})
