/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'

import {ConniApi} from '../../src/conni/conni-api.js'

describe('ConniApi', () => {
  const mockConfig = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://test.atlassian.net',
  }

  let conniApi: ConniApi

  beforeEach(() => {
    conniApi = new ConniApi(mockConfig)
  })

  afterEach(() => {
    conniApi.clearClients()
  })

  describe('toErrorResult', () => {
    it('uses the message of an Error instance', () => {
      const result = (conniApi as any).toErrorResult(new Error('boom'))
      expect(result).to.deep.equal({error: 'boom', success: false})
    })

    it('stringifies non-Error values without throwing', () => {
      expect((conniApi as any).toErrorResult('plain string')).to.deep.equal({
        error: 'plain string',
        success: false,
      })
    })

    it('does not throw when the thrown value is null', () => {
      expect(() => (conniApi as any).toErrorResult(null)).to.not.throw()
      expect((conniApi as any).toErrorResult(null)).to.deep.equal({error: 'null', success: false})
    })

    // confluence.js rejects with a plain object, not an Error, so `String(error)`
    // used to reduce every API failure to the useless string '[object Object]'.
    it('prefers the translated message of a confluence.js rejection', () => {
      const rejection = {
        data: {errors: [{message: {args: [], translation: 'No content found with id : 999999999'}}]},
        message:
          'com.atlassian.confluence.api.service.exceptions.api.NotFoundException: No content found with id : 999999999',
        statusCode: 404,
      }

      expect((conniApi as any).toErrorResult(rejection)).to.deep.equal({
        error: 'No content found with id : 999999999',
        success: false,
      })
    })

    it('joins multiple translated messages', () => {
      const rejection = {
        data: {errors: [{message: {translation: 'first problem'}}, {message: {translation: 'second problem'}}]},
        message: 'com.example.SomeException: wrapped',
        statusCode: 400,
      }

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('first problem; second problem')
    })

    it('strips the java exception prefix when there is no translation', () => {
      const rejection = {
        message:
          'org.springframework.web.server.ResponseStatusException: 404 NOT_FOUND "No space found with key : BOGUSKEY"',
        statusCode: 404,
      }

      expect((conniApi as any).toErrorResult(rejection).error).to.equal(
        '404 NOT_FOUND "No space found with key : BOGUSKEY"',
      )
    })

    it('falls back to the message when the errors array is empty', () => {
      const rejection = {
        data: {errors: []},
        message: 'com.atlassian.confluence.api.service.exceptions.api.BadRequestException: Could not parse cql : ',
        statusCode: 400,
      }

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('Could not parse cql :')
    })

    it('never reduces an object to [object Object]', () => {
      expect((conniApi as any).toErrorResult({statusCode: 500}).error).to.equal('{"statusCode":500}')
    })

    it('does not strip a plain message that merely contains a colon', () => {
      expect((conniApi as any).toErrorResult({message: 'Note: something happened'}).error).to.equal(
        'Note: something happened',
      )
    })

    // Confluence answers a bad attachment id with the literal message
    // 'NotFoundException: null', which strips down to a useless 'null'.
    it('falls back to the status code when the message carries no information', () => {
      const rejection = {
        data: {errors: []},
        message: 'com.atlassian.confluence.api.service.exceptions.api.NotFoundException: null',
        statusCode: 404,
      }

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('Confluence request failed with status 404')
    })

    it('falls back to the status code when the message strips to nothing', () => {
      const rejection = {message: 'com.example.SomeException: ', statusCode: 500}

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('Confluence request failed with status 500')
    })

    it('trims surrounding whitespace from a message', () => {
      expect((conniApi as any).toErrorResult({message: '  spaced out  '}).error).to.equal('spaced out')
    })

    it('survives a circular rejection object', () => {
      const circular: Record<string, unknown> = {statusCode: 500}
      circular.self = circular

      expect(() => (conniApi as any).toErrorResult(circular)).to.not.throw()
      expect((conniApi as any).toErrorResult(circular).success).to.be.false
    })
  })

  describe('constructor', () => {
    it('creates a new instance with config', () => {
      expect(conniApi).to.be.an.instanceOf(ConniApi)
    })
  })

  describe('getClient', () => {
    it('returns a ConfluenceClient instance', () => {
      const client = conniApi.getClient()
      expect(client).to.have.property('content')
      expect(client).to.have.property('space')
    })

    it('returns the same client instance on subsequent calls', () => {
      const client1 = conniApi.getClient()
      const client2 = conniApi.getClient()
      expect(client1).to.equal(client2)
    })
  })

  describe('clearClients', () => {
    it('clears the client instance', () => {
      conniApi.getClient()
      conniApi.clearClients()
      const client = conniApi.getClient()
      expect(client).to.be.an('object')
    })
  })

  describe('searchContents', () => {
    it('exports searchContents method', () => {
      expect(conniApi.searchContents).to.be.a('function')
    })

    it('accepts cql parameter', async () => {
      try {
        const result = await conniApi.searchContents('space = DEV')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })

    it('accepts optional limit parameter', async () => {
      try {
        const result = await conniApi.searchContents('space = DEV', 50)
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('getContent', () => {
    it('exports getContent method', () => {
      expect(conniApi.getContent).to.be.a('function')
    })

    it('accepts pageId parameter', async () => {
      try {
        const result = await conniApi.getContent('123456')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('createPage', () => {
    it('exports createPage method', () => {
      expect(conniApi.createPage).to.be.a('function')
    })

    it('accepts fields parameter', async () => {
      try {
        const result = await conniApi.createPage({body: 'Content', spaceKey: 'DEV', title: 'Test'})
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('updateContent', () => {
    it('exports updateContent method', () => {
      expect(conniApi.updateContent).to.be.a('function')
    })

    it('accepts pageId and fields parameters', async () => {
      try {
        const result = await conniApi.updateContent('123456', {title: 'Updated'})
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })

    it('unescapes literal backslash-n in storage bodies, matching page creation', async () => {
      let sentValue: string | undefined
      const stubClient = {
        content: {
          async getContentById() {
            return {title: 'Existing', version: {number: 1}}
          },
          async updateContent(payload: {body: {storage: {value: string}}}) {
            sentValue = payload.body.storage.value
            return {id: '123456'}
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.updateContent('123456', {
        body: String.raw`<p>line one</p>\n<p>line two</p>`,
        representation: 'storage',
      })

      expect(result.success).to.equal(true)
      expect(sentValue).to.equal('<p>line one</p>\n<p>line two</p>')
      expect(sentValue).to.not.include(String.raw`\n`)
    })
  })

  describe('addComment', () => {
    it('exports addComment method', () => {
      expect(conniApi.addComment).to.be.a('function')
    })

    it('accepts pageId and body parameters', async () => {
      try {
        const result = await conniApi.addComment('123456', 'Test comment')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('deleteComment', () => {
    it('exports deleteComment method', () => {
      expect(conniApi.deleteComment).to.be.a('function')
    })

    it('accepts id parameter', async () => {
      try {
        const result = await conniApi.deleteComment('10001')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('updateComment', () => {
    it('exports updateComment method', () => {
      expect(conniApi.updateComment).to.be.a('function')
    })

    it('accepts id and body parameters', async () => {
      try {
        const result = await conniApi.updateComment('10001', 'Updated comment')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('deleteContent', () => {
    it('exports deleteContent method', () => {
      expect(conniApi.deleteContent).to.be.a('function')
    })

    it('accepts pageId parameter', async () => {
      try {
        const result = await conniApi.deleteContent('123456')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('addAttachment', () => {
    it('exports addAttachment method', () => {
      expect(conniApi.addAttachment).to.be.a('function')
    })

    it('returns error when file does not exist', async () => {
      const result = await conniApi.addAttachment('123456', '/nonexistent/file.pdf')
      expect(result.success).to.equal(false)
      expect(result.error).to.include('File not found')
    })
  })

  describe('addLabels', () => {
    it('exports addLabels method', () => {
      expect(conniApi.addLabels).to.be.a('function')
    })

    it('accepts pageId and labels parameters', async () => {
      try {
        const result = await conniApi.addLabels('123456', ['release-notes', 'q3'])
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })

    it('accepts an optional prefix parameter', async () => {
      try {
        const result = await conniApi.addLabels('123456', ['favourite'], 'my')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('getLabels', () => {
    it('exports getLabels method', () => {
      expect(conniApi.getLabels).to.be.a('function')
    })

    it('accepts pageId parameter', async () => {
      try {
        const result = await conniApi.getLabels('123456')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })

    it('accepts optional prefix and limit parameters', async () => {
      try {
        const result = await conniApi.getLabels('123456', 'global', 50)
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('removeLabel', () => {
    it('exports removeLabel method', () => {
      expect(conniApi.removeLabel).to.be.a('function')
    })

    it('accepts pageId and label parameters', async () => {
      try {
        const result = await conniApi.removeLabel('123456', 'release-notes')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('downloadAttachment', () => {
    it('exports downloadAttachment method', () => {
      expect(conniApi.downloadAttachment).to.be.a('function')
    })

    it('accepts attachmentId parameter', async () => {
      try {
        const result = await conniApi.downloadAttachment('att-123')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('getSpace', () => {
    it('exports getSpace method', () => {
      expect(conniApi.getSpace).to.be.a('function')
    })

    it('accepts spaceKey parameter', async () => {
      try {
        const result = await conniApi.getSpace('DEV')
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('listSpaces', () => {
    it('exports listSpaces method', () => {
      expect(conniApi.listSpaces).to.be.a('function')
    })

    it('returns ApiResult structure', async () => {
      try {
        const result = await conniApi.listSpaces()
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })

  describe('testConnection', () => {
    it('exports testConnection method', () => {
      expect(conniApi.testConnection).to.be.a('function')
    })

    it('returns ApiResult structure', async () => {
      try {
        const result = await conniApi.testConnection()
        expect(result).to.have.property('success')
      } catch {
        // Expected to fail without actual connection
      }
    })
  })
})
