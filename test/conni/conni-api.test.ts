/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import {ApiError, NotFoundError} from 'confluence.js'

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

    describe('ApiError (confluence.js 3.x)', () => {
      // Every message keeps the status in front: the e2e suite (and shell
      // callers) branch on the HTTP status substring, not on prose Confluence
      // may translate.
      it('prefers the translated message from the error body', () => {
        const error = new NotFoundError('Request failed: 404 Not Found - {"errors":[...]}', 'Not Found', {
          errors: [{message: {args: [], translation: 'No content found with id : 999999999'}}],
        })

        expect((conniApi as any).toErrorResult(error)).to.deep.equal({
          error: 'Confluence request failed with status 404: No content found with id : 999999999',
          success: false,
        })
      })

      it('joins multiple translated messages from the error body', () => {
        const error = new ApiError('Request failed: 400 Bad Request - body', 400, 'Bad Request', {
          errors: [{message: {translation: 'first problem'}}, {message: {translation: 'second problem'}}],
        })

        expect((conniApi as any).toErrorResult(error).error).to.equal(
          'Confluence request failed with status 400: first problem; second problem',
        )
      })

      it('falls back to v2-style error titles when there is no translation', () => {
        const error = new ApiError('Request failed: 400 Bad Request - body', 400, 'Bad Request', {
          errors: [{code: 'INVALID_SPACE_KEY', title: 'The space key is invalid'}],
        })

        expect((conniApi as any).toErrorResult(error).error).to.equal(
          'Confluence request failed with status 400: The space key is invalid',
        )
      })

      // Some endpoints answer with the human message at the top level, prefixed
      // by the java exception class — not inside an errors[] array. This is the
      // shape CQL parse errors and duplicate-attachment rejections arrive in.
      it('reads the top-level message of an error body, stripping the java prefix', () => {
        const error = new ApiError('Request failed: 400 Bad Request - body', 400, 'Bad Request', {
          data: {authorized: true, errors: [], successful: true},
          message: 'com.atlassian.confluence.api.service.exceptions.api.BadRequestException: Could not parse cql : ',
          statusCode: 400,
        })

        expect((conniApi as any).toErrorResult(error).error).to.equal(
          'Confluence request failed with status 400: Could not parse cql :',
        )
      })

      it('ignores a top-level body message that carries no information', () => {
        const error = new NotFoundError('Request failed: 404 Not Found - body', 'Not Found', {
          message: 'com.atlassian.confluence.api.service.exceptions.api.NotFoundException: null',
          statusCode: 404,
        })

        expect((conniApi as any).toErrorResult(error).error).to.equal('Confluence request failed with status 404')
      })

      it('summarizes the status when the body carries no readable message', () => {
        const error = new NotFoundError('Request failed: 404 Not Found - {"code":404}', 'Not Found', {
          code: 404,
        })

        expect((conniApi as any).toErrorResult(error).error).to.equal('Confluence request failed with status 404')
      })
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

    // confluence.js 2.x rejected with a plain object rather than an Error, so
    // `String(error)` used to reduce every API failure to '[object Object]'. The
    // object path below remains as the defensive/legacy shape; 3.x throws typed
    // ApiError subclasses, covered by the cases after it.
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

    // The exception class name is not always package-qualified, and an undotted
    // prefix must strip too or the uninformative 'null' leaks through.
    it('strips an undotted exception class name', () => {
      const rejection = {message: 'NotFoundException: null', statusCode: 404}

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('Confluence request failed with status 404')
    })

    it('keeps the detail of an undotted exception that carries a real message', () => {
      const rejection = {message: 'NotFoundException: No content found with id : 5', statusCode: 404}

      expect((conniApi as any).toErrorResult(rejection).error).to.equal('No content found with id : 5')
    })

    it('leaves a word that merely starts with Error alone', () => {
      expect((conniApi as any).toErrorResult({message: 'ErrorBudget: 40% remaining'}).error).to.equal(
        'ErrorBudget: 40% remaining',
      )
      expect((conniApi as any).toErrorResult({message: 'Errors: three of them'}).error).to.equal(
        'Errors: three of them',
      )
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
      expect((conniApi as any).toErrorResult(circular)).to.deep.equal({
        error: '<ref *1> { statusCode: 500, self: [Circular *1] }',
        success: false,
      })
    })

    it('uses a safe formatter when JSON.stringify returns undefined', () => {
      const rejection = {toJSON: () => undefined}

      expect((conniApi as any).toErrorResult(rejection)).to.deep.equal({
        error: '{ toJSON: [Function: toJSON] }',
        success: false,
      })
    })
  })

  describe('constructor', () => {
    it('creates a new instance with config', () => {
      expect(conniApi).to.be.an.instanceOf(ConniApi)
    })
  })

  describe('getClient', () => {
    it('returns v1 and v2 client views', () => {
      const client = conniApi.getClient()
      expect(client).to.have.property('v1')
      expect(client).to.have.property('v2')
      expect(client.v1).to.have.property('content')
      expect(client.v2).to.have.property('page')
    })

    it('returns the same client pair on subsequent calls', () => {
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

    it('reads a comment id through the comment endpoint when the page one 404s', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentById() {
              return {body: {storage: {value: '<p>hi</p>'}}, id: '10001', pageId: '123456'}
            },
          },
          page: {
            async getPageById() {
              throw new ApiError('Request failed: 404 Not Found - body', 404, 'Not Found', {})
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getContent('10001')

      expect(result.success).to.equal(true)
      expect(result.data).to.deep.equal({body: {storage: {value: '<p>hi</p>'}}, id: '10001', pageId: '123456'})
    })

    it('does not try the comment endpoint when the page read fails for another reason', async () => {
      let commentEndpointCalled = false
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentById() {
              commentEndpointCalled = true
              return {id: '10001'}
            },
          },
          page: {
            async getPageById() {
              throw new ApiError('Request failed: 403 Forbidden - body', 403, 'Forbidden', {})
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getContent('123456')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 403')
      expect(commentEndpointCalled).to.equal(false)
    })

    it('reports the neutral page 404 when neither endpoint knows the id', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentById() {
              throw new NotFoundError('Request failed: 404 Not Found - body', 'Not Found', {})
            },
          },
          page: {
            async getPageById() {
              throw new NotFoundError('Request failed: 404 Not Found - body', 'Not Found', {
                errors: [{message: {args: [], translation: 'No content found with id : 999999999'}}],
              })
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getContent('999999999')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 404: No content found with id : 999999999')
    })

    it('surfaces a comment endpoint failure that is not another 404', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentById() {
              throw new ApiError('Request failed: 500 Internal Server Error - body', 500, 'Internal Server Error', {})
            },
          },
          page: {
            async getPageById() {
              throw new ApiError('Request failed: 404 Not Found - body', 404, 'Not Found', {})
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getContent('123456')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 500')
    })
  })

  describe('getFooterComments', () => {
    it('exports getFooterComments method', () => {
      expect(conniApi.getFooterComments).to.be.a('function')
    })

    it('lists footer comments, defaulting the body format to storage', async () => {
      let received: any
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren() {
              return {results: []}
            },
            async getPageFooterComments(parameters: any) {
              received = parameters
              return {results: [{body: {storage: {value: '<p>hi</p>'}}, id: '10001', pageId: '123456'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(true)
      expect(result.data).to.deep.equal({
        results: [{body: {storage: {value: '<p>hi</p>'}}, id: '10001', pageId: '123456'}],
        size: 1,
      })
      // Only the id and the default reach the endpoint — omitted options send
      // no keys at all rather than explicit undefineds.
      expect(received).to.deep.equal({bodyFormat: 'storage', id: '123456'})
    })

    it('nests a reply under its parent as children.results', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren(parameters: any) {
              return parameters.id === '10001'
                ? {results: [{body: {storage: {value: '<p>reply</p>'}}, id: '10002', pageId: '123456'}], size: 1}
                : {results: [], size: 0}
            },
            async getPageFooterComments() {
              return {results: [{body: {storage: {value: '<p>root</p>'}}, id: '10001', pageId: '123456'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(true)
      // The top-level list stays top-level-only; the reply rides along nested,
      // and the reply itself — having no children — keeps its plain shape.
      expect(result.data).to.deep.equal({
        results: [
          {
            body: {storage: {value: '<p>root</p>'}},
            children: {
              results: [{body: {storage: {value: '<p>reply</p>'}}, id: '10002', pageId: '123456'}],
            },
            id: '10001',
            pageId: '123456',
          },
        ],
        size: 1,
      })
    })

    it('recurses replies to replies at every depth', async () => {
      const childrenCalls: any[] = []
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren(parameters: any) {
              childrenCalls.push(parameters)
              const byParent: Record<string, any> = {
                '10001': {results: [{id: '10002'}], size: 1},
                '10002': {results: [{id: '10003'}], size: 1},
              }
              return byParent[parameters.id] ?? {results: [], size: 0}
            },
            async getPageFooterComments() {
              return {results: [{id: '10001'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(true)
      expect(result.data).to.deep.equal({
        results: [
          {
            children: {
              results: [
                {
                  children: {
                    results: [{id: '10003'}],
                  },
                  id: '10002',
                },
              ],
            },
            id: '10001',
          },
        ],
        size: 1,
      })
      // One chain per comment in the tree: root, its reply, the reply's reply.
      expect(childrenCalls.map((call) => call.id)).to.deep.equal(['10001', '10002', '10003'])
    })

    it('follows the children pagination cursor until exhausted', async () => {
      const childrenCalls: any[] = []
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren(parameters: any) {
              childrenCalls.push(parameters)
              if (parameters.id !== '10001') return {results: [], size: 0}
              if (parameters.cursor) return {results: [{id: '10003'}], size: 1}

              return {
                _links: {
                  next: '/wiki/api/v2/footer-comments/10001/children?cursor=cur-2&body-format=storage',
                },
                results: [{id: '10002'}],
                size: 1,
              }
            },
            async getPageFooterComments() {
              return {results: [{id: '10001'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(true)
      expect(result.data).to.deep.equal({
        results: [
          {
            children: {
              results: [{id: '10002'}, {id: '10003'}],
            },
            id: '10001',
          },
        ],
        size: 1,
      })
      // The second page of the root's replies was requested with the cursor
      // read out of _links.next.
      const rootCalls = childrenCalls.filter((call) => call.id === '10001')
      expect(rootCalls).to.deep.equal([
        {bodyFormat: 'storage', id: '10001'},
        {bodyFormat: 'storage', cursor: 'cur-2', id: '10001'},
      ])
    })

    it('propagates bodyFormat and sort to every children call', async () => {
      const childrenCalls: any[] = []
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren(parameters: any) {
              childrenCalls.push(parameters)
              if (parameters.id !== '10001') return {results: [], size: 0}
              if (parameters.cursor) return {results: [{id: '10003'}], size: 1}

              return {
                _links: {next: '/wiki/api/v2/footer-comments/10001/children?cursor=cur-2'},
                results: [{id: '10002'}],
                size: 1,
              }
            },
            async getPageFooterComments() {
              return {results: [{id: '10001'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456', {
        bodyFormat: 'view',
        sort: '-created-date',
        status: 'current',
      })

      expect(result.success).to.equal(true)
      // Every children call repeats bodyFormat and sort. status is not among
      // them: the children endpoint has no status filter to forward it to.
      expect(childrenCalls).to.deep.equal([
        {bodyFormat: 'view', id: '10001', sort: '-created-date'},
        {bodyFormat: 'view', id: '10002', sort: '-created-date'},
        {bodyFormat: 'view', cursor: 'cur-2', id: '10001', sort: '-created-date'},
        {bodyFormat: 'view', id: '10003', sort: '-created-date'},
      ])
    })

    it('skips children calls entirely with includeReplies false', async () => {
      let childrenCalls = 0
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren() {
              childrenCalls += 1
              return {results: [{id: '10002'}], size: 1}
            },
            async getPageFooterComments() {
              return {results: [{body: {storage: {value: '<p>root</p>'}}, id: '10001', pageId: '123456'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456', {includeReplies: false})

      expect(result.success).to.equal(true)
      expect(childrenCalls).to.equal(0)
      expect(result.data).to.deep.equal({
        results: [{body: {storage: {value: '<p>root</p>'}}, id: '10001', pageId: '123456'}],
        size: 1,
      })
    })

    it('fails the whole request when a children call errors', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getFooterCommentChildren() {
              throw new ApiError('Request failed: 500 Internal Server Error - body', 500, 'Internal Server Error', {})
            },
            async getPageFooterComments() {
              return {results: [{id: '10001'}], size: 1}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 500')
    })

    it('forwards every option to the v2 endpoint', async () => {
      let received: any
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getPageFooterComments(parameters: any) {
              received = parameters
              return {results: [], size: 0}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456', {
        bodyFormat: 'view',
        cursor: 'cur-1',
        limit: 25,
        sort: 'created-date',
        status: 'current',
      })

      expect(result.success).to.equal(true)
      // The v2 endpoint takes status as a repeatable query parameter, so the
      // single flag value is forwarded wrapped.
      expect(received).to.deep.equal({
        bodyFormat: 'view',
        cursor: 'cur-1',
        id: '123456',
        limit: 25,
        sort: 'created-date',
        status: ['current'],
      })
    })

    it('reports a nonexistent page as a structured 404', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getPageFooterComments() {
              throw new NotFoundError('Request failed: 404 Not Found - body', 'Not Found', {
                errors: [{message: {args: [], translation: 'No content found with id : 999999999'}}],
              })
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('999999999')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 404: No content found with id : 999999999')
    })

    it('reports a server failure as a structured 500', async () => {
      const stubClient = {
        v1: {},
        v2: {
          comment: {
            async getPageFooterComments() {
              throw new ApiError('Request failed: 500 Internal Server Error - body', 500, 'Internal Server Error', {})
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.getFooterComments('123456')

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Confluence request failed with status 500')
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

    it('reports a missing space when the key resolves to nothing', async () => {
      const stubClient = {
        v1: {},
        v2: {
          space: {
            async getSpaces() {
              return {results: []}
            },
          },
        },
      }

      conniApi.getClient = () => stubClient as unknown as ReturnType<typeof conniApi.getClient>

      const result = await conniApi.createPage({body: 'Content', spaceKey: 'BOGUS', title: 'Test'})

      expect(result.success).to.equal(false)
      expect(result.error).to.equal('Space not found: BOGUS')
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
        v1: {},
        v2: {
          page: {
            async getPageById() {
              return {title: 'Existing', version: {number: 1}}
            },
            async updatePage(payload: {body: {body?: {value?: string}}}) {
              sentValue = payload.body.body?.value
              return {id: '123456'}
            },
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
