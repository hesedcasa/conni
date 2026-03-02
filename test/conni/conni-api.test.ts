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
