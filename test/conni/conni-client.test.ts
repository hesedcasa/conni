/* eslint-disable @typescript-eslint/no-explicit-any */
import {expect} from 'chai'
import esmock from 'esmock'

describe('conni-client', () => {
  let conniClient: any
  let mockConniApi: any
  let mockConniApiInstance: any

  const mockConfig = {
    apiToken: 'test-token',
    email: 'test@example.com',
    host: 'https://test.atlassian.net',
  }

  beforeEach(async () => {
    // Create mock methods that will be assigned to the ConniApi instance
    mockConniApiInstance = {
      addAttachment: async () => ({data: {id: 'att-123'}, success: true}),
      addComment: async () => ({data: {id: '10001'}, success: true}),
      clearClients() {},
      createPage: async () => ({data: {id: '123456', title: 'Test Page'}, success: true}),
      deleteComment: async () => ({data: {}, success: true}),
      deleteContent: async () => ({data: {}, success: true}),
      downloadAttachment: async () => ({data: {}, success: true}),
      getContent: async () => ({data: {id: '123456', title: 'Test Page'}, success: true}),
      getSpace: async () => ({data: {id: '10000', key: 'DEV', name: 'Development'}, success: true}),
      listSpaces: async () => ({data: [{id: '10000', key: 'DEV', name: 'Development', type: 'global'}], success: true}),
      searchContents: async () => ({data: {results: [], size: 0}, success: true}),
      testConnection: async () => ({data: {currentUser: {}, serverInfo: {}}, success: true}),
      updateComment: async () => ({data: {id: '10001'}, success: true}),
      updateContent: async () => ({data: {id: '123456'}, success: true}),
    }

    // Mock the ConniApi class constructor
    mockConniApi = class {
      constructor() {
        Object.assign(this, mockConniApiInstance)
      }
    }

    // Import with mocked ConniApi
    conniClient = await esmock('../../src/conni/conni-client.js', {
      '../../src/conni/conni-api.js': {ConniApi: mockConniApi},
    })
  })

  afterEach(() => {
    conniClient.clearClients()
  })

  describe('listSpaces', () => {
    it('returns successful result with spaces list', async () => {
      mockConniApiInstance.listSpaces = async () => ({
        data: [
          {id: '10000', key: 'DEV', name: 'Development', type: 'global'},
          {id: '10001', key: 'OPS', name: 'Operations', type: 'global'},
        ],
        success: true,
      })

      const result = await conniClient.listSpaces(mockConfig)

      expect(result.success).to.be.true
      expect(result.data).to.be.an('array')
      expect(result.data).to.have.lengthOf(2)
      expect(result.data[0]).to.have.property('key', 'DEV')
    })

    it('handles API errors gracefully', async () => {
      mockConniApiInstance.listSpaces = async () => ({
        error: 'Authentication failed',
        success: false,
      })

      const result = await conniClient.listSpaces(mockConfig)

      expect(result.success).to.be.false
      expect(result.error).to.include('Authentication failed')
    })
  })

  describe('getSpace', () => {
    it('returns space details for valid space key', async () => {
      mockConniApiInstance.getSpace = async (spaceKey: string) => ({
        data: {
          id: '10000',
          key: spaceKey,
          name: 'Development',
          type: 'global',
        },
        success: true,
      })

      const result = await conniClient.getSpace(mockConfig, 'DEV')

      expect(result.success).to.be.true
      expect(result.data).to.have.property('key', 'DEV')
      expect(result.data).to.have.property('name', 'Development')
    })

    it('handles space not found error', async () => {
      mockConniApiInstance.getSpace = async () => ({
        error: 'Space not found',
        success: false,
      })

      const result = await conniClient.getSpace(mockConfig, 'INVALID')

      expect(result.success).to.be.false
      expect(result.error).to.include('Space not found')
    })
  })

  describe('searchContents', () => {
    it('returns search results', async () => {
      mockConniApiInstance.searchContents = async () => ({
        data: {
          results: [
            {id: '123456', title: 'Page 1'},
            {id: '123457', title: 'Page 2'},
          ],
          size: 2,
        },
        success: true,
      })

      const result = await conniClient.searchContents(mockConfig, 'space = DEV')

      expect(result.success).to.be.true
      expect(result.data.results).to.be.an('array')
      expect(result.data.results).to.have.lengthOf(2)
    })

    it('accepts optional limit and expand parameters', async () => {
      const result = await conniClient.searchContents(mockConfig, 'space = DEV', 50, ['body.storage'])

      expect(result.success).to.be.true
    })

    it('handles invalid CQL error', async () => {
      mockConniApiInstance.searchContents = async () => ({
        error: 'Invalid CQL query',
        success: false,
      })

      const result = await conniClient.searchContents(mockConfig, 'invalid cql')

      expect(result.success).to.be.false
      expect(result.error).to.include('Invalid CQL')
    })
  })

  describe('getContent', () => {
    it('returns page details for valid page ID', async () => {
      mockConniApiInstance.getContent = async (pageId: string) => ({
        data: {
          id: pageId,
          title: 'Test Page',
          type: 'page',
        },
        success: true,
      })

      const result = await conniClient.getContent(mockConfig, '123456')

      expect(result.success).to.be.true
      expect(result.data).to.have.property('id', '123456')
      expect(result.data).to.have.property('title', 'Test Page')
    })

    it('handles page not found error', async () => {
      mockConniApiInstance.getContent = async () => ({
        error: 'Content not found',
        success: false,
      })

      const result = await conniClient.getContent(mockConfig, '999999')

      expect(result.success).to.be.false
      expect(result.error).to.include('Content not found')
    })
  })

  describe('createPage', () => {
    it('creates page with provided fields', async () => {
      const fields = {
        body: '# Hello World',
        spaceKey: 'DEV',
        title: 'New Page',
      }

      mockConniApiInstance.createPage = async () => ({
        data: {
          id: '123456',
          title: 'New Page',
        },
        success: true,
      })

      const result = await conniClient.createPage(mockConfig, fields)

      expect(result.success).to.be.true
      expect(result.data).to.have.property('title', 'New Page')
    })

    it('handles creation errors', async () => {
      mockConniApiInstance.createPage = async () => ({
        error: 'Permission denied',
        success: false,
      })

      const result = await conniClient.createPage(mockConfig, {})

      expect(result.success).to.be.false
      expect(result.error).to.include('Permission denied')
    })
  })

  describe('updateContent', () => {
    it('updates page fields successfully', async () => {
      const fields = {
        title: 'Updated Title',
      }

      mockConniApiInstance.updateContent = async () => ({
        data: {
          id: '123456',
          title: 'Updated Title',
        },
        success: true,
      })

      const result = await conniClient.updateContent(mockConfig, '123456', fields)

      expect(result.success).to.be.true
    })

    it('handles update errors', async () => {
      mockConniApiInstance.updateContent = async () => ({
        error: 'Permission denied',
        success: false,
      })

      const result = await conniClient.updateContent(mockConfig, '123456', {})

      expect(result.success).to.be.false
      expect(result.error).to.include('Permission denied')
    })
  })

  describe('deleteContent', () => {
    it('deletes page successfully', async () => {
      mockConniApiInstance.deleteContent = async () => ({
        data: true,
        success: true,
      })

      const result = await conniClient.deleteContent(mockConfig, '123456')

      expect(result.success).to.be.true
    })

    it('handles delete errors', async () => {
      mockConniApiInstance.deleteContent = async () => ({
        error: 'Cannot delete page',
        success: false,
      })

      const result = await conniClient.deleteContent(mockConfig, '123456')

      expect(result.success).to.be.false
    })
  })

  describe('addComment', () => {
    it('adds comment successfully', async () => {
      mockConniApiInstance.addComment = async () => ({
        data: {
          id: '10001',
          type: 'comment',
        },
        success: true,
      })

      const result = await conniClient.addComment(mockConfig, '123456', 'Test comment')

      expect(result.success).to.be.true
      expect(result.data).to.have.property('id')
    })
  })

  describe('updateComment', () => {
    it('updates comment successfully', async () => {
      mockConniApiInstance.updateComment = async () => ({
        data: {
          id: '10001',
          type: 'comment',
        },
        success: true,
      })

      const result = await conniClient.updateComment(mockConfig, '10001', 'Updated comment')

      expect(result.success).to.be.true
    })
  })

  describe('deleteComment', () => {
    it('deletes comment successfully', async () => {
      mockConniApiInstance.deleteComment = async () => ({
        data: true,
        success: true,
      })

      const result = await conniClient.deleteComment(mockConfig, '10001')

      expect(result.success).to.be.true
    })
  })

  describe('addAttachment', () => {
    it('adds attachment successfully', async () => {
      mockConniApiInstance.addAttachment = async () => ({
        data: {
          id: 'att-123',
          title: 'document.pdf',
        },
        success: true,
      })

      const result = await conniClient.addAttachment(mockConfig, '123456', '/tmp/document.pdf')

      expect(result.success).to.be.true
    })
  })

  describe('downloadAttachment', () => {
    it('downloads attachment successfully', async () => {
      mockConniApiInstance.downloadAttachment = async () => ({
        data: {filename: 'file.pdf', filePath: '/tmp/file.pdf'},
        success: true,
      })

      const result = await conniClient.downloadAttachment(mockConfig, 'att-123', '/tmp/file.pdf')

      expect(result.success).to.be.true
    })
  })

  describe('testConnection', () => {
    it('successfully tests connection', async () => {
      mockConniApiInstance.testConnection = async () => ({
        data: {
          currentUser: {emailAddress: 'test@example.com'},
          serverInfo: {},
        },
        success: true,
      })

      const result = await conniClient.testConnection(mockConfig)

      expect(result.success).to.be.true
      expect(result.data).to.have.property('currentUser')
    })

    it('handles connection failure', async () => {
      mockConniApiInstance.testConnection = async () => ({
        error: 'Connection refused',
        success: false,
      })

      const result = await conniClient.testConnection(mockConfig)

      expect(result.success).to.be.false
      expect(result.error).to.include('Connection refused')
    })
  })

  describe('clearClients', () => {
    it('exports clearClients function', () => {
      expect(conniClient.clearClients).to.be.a('function')
    })

    it('can be called without error', () => {
      expect(() => conniClient.clearClients()).to.not.throw()
    })
  })
})
