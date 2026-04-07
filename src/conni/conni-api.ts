import {ConfluenceClient} from 'confluence.js'
import fs from 'fs-extra'
import {markdownToAdf} from 'marklassian'
import path from 'node:path'

/**
 * Generic API result
 */
export interface ApiResult {
  data?: unknown
  error?: unknown
  success: boolean
}

export interface Config {
  apiToken: string
  email: string
  host: string
}

/**
 * Confluence API Utility
 * Provides core Confluence API operations
 */
export class ConniApi {
  private client?: ConfluenceClient
  private config: Config

  constructor(config: Config) {
    this.config = config
  }

  /**
   * Add an attachment to a page
   */
  async addAttachment(pageId: string, filePath: string): Promise<ApiResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          error: `File not found: ${filePath}`,
          success: false,
        }
      }

      const stats = fs.statSync(filePath)
      const maxFileSizeBytes = 10 * 1024 * 1024 // 10MB
      if (stats.size > maxFileSizeBytes) {
        return {
          error: `File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit`,
          success: false,
        }
      }

      const client = this.getClient()
      const fileContent = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)

      const response = await client.contentAttachments.createAttachments({
        attachments: [
          {
            file: fileContent,
            filename: fileName,
            minorEdit: false,
          },
        ],
        id: pageId,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Add a comment to a page
   */
  async addComment(pageId: string, body: string): Promise<ApiResult> {
    try {
      const client = this.getClient()

      // Convert Markdown body to Confluence ADF
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      const bodyContent = markdownToAdf(body.replace(/\\n/g, '\n'))

      const response = await client.content.createContent({
        body: {
          storage: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
        },
        container: {
          id: pageId,
          type: 'page',
        },
        space: {key: ''},
        title: '',
        type: 'comment',
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Clear client (for cleanup)
   */
  clearClients(): void {
    this.client = undefined
  }

  /**
   * Create a new page
   */
  async createPage(fields: Record<string, unknown>): Promise<ApiResult> {
    try {
      const client = this.getClient()

      // Convert Markdown body to Confluence ADF
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      const bodyContent = markdownToAdf((fields.body as string).replace(/\\n/g, '\n'))
      const spaceKey = fields.spaceKey as string
      const title = fields.title as string
      const parentId = fields.parentId as string | undefined
      const status = fields.status as string | undefined

      const contentBody = {
        ancestors: parentId ? [{id: parentId}] : undefined,
        body: {
          storage: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
        },
        space: {key: spaceKey},
        status,
        title,
        type: 'page',
      }

      const response = await client.content.createContent(contentBody)

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Create a new page with inline media attachments
   * Uploads files first, then patches the ADF body to embed them by file ID.
   */
  async createPageWithMedia(fields: Record<string, unknown>, filePaths: string[]): Promise<ApiResult> {
    try {
      const client = this.getClient()
      const spaceKey = fields.spaceKey as string
      const title = fields.title as string
      const parentId = fields.parentId as string | undefined
      const status = fields.status as string | undefined

      // Convert Markdown body to ADF first so we can locate inline image references.
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      const bodyContent = markdownToAdf((fields.body as string).replace(/\\n/g, '\n'))

      // Collect external mediaSingle nodes keyed by basename (produced by ![alt](path) in markdown).
      const externalMediaByBasename = new Map<string, Array<Record<string, unknown>>>()
      this.collectExternalMedia(
        bodyContent.content as unknown as Array<Record<string, unknown>>,
        externalMediaByBasename,
      )

      const inlinePaths = filePaths.filter((f) => externalMediaByBasename.has(path.basename(f)))
      const trailingPaths = filePaths.filter((f) => !externalMediaByBasename.has(path.basename(f)))

      // Create the page first to get a page ID for attachment uploads.
      const page = await client.content.createContent({
        ancestors: parentId ? [{id: parentId}] : undefined,
        body: {
          storage: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
        },
        space: {key: spaceKey},
        status,
        title,
        type: 'page',
      })

      const pageId = (page as {id?: string}).id
      if (!pageId) {
        return {error: 'Failed to get page ID from creation response', success: false}
      }

      // Upload all files in parallel.
      const uploadResults = await Promise.all(filePaths.map((filePath) => this.addAttachment(pageId, filePath)))
      const firstFailure = uploadResults.find((r) => !r.success)
      if (firstFailure) return firstFailure

      // Extract fileId and collectionName directly from the attachment extension metadata.
      type UploadData = {results?: Array<{extensions?: {collectionName?: string; fileId?: string}}>}
      const fileInfoByPath = new Map<string, {collection: string; id: string}>()
      for (const [i, filePath] of filePaths.entries()) {
        const uploadData = uploadResults[i].data as UploadData
        const att = uploadData?.results?.[0]
        const fileId = att?.extensions?.fileId
        const collectionName = att?.extensions?.collectionName ?? ''
        if (fileId) {
          fileInfoByPath.set(filePath, {collection: collectionName, id: fileId})
        }
      }

      // Replace inline external media nodes with resolved file media nodes.
      for (const filePath of inlinePaths) {
        const info = fileInfoByPath.get(filePath)
        if (!info) continue
        for (const attrs of externalMediaByBasename.get(path.basename(filePath)) ?? []) {
          delete attrs.url
          delete attrs.alt
          attrs.collection = info.collection
          attrs.id = info.id
          attrs.type = 'file'
        }
      }

      // Append trailing files (not referenced inline) as mediaSingle blocks at the end.
      const bodyNodes = bodyContent.content as unknown as Array<Record<string, unknown>>
      for (const filePath of trailingPaths) {
        const info = fileInfoByPath.get(filePath)
        if (!info) continue
        bodyNodes.push({
          attrs: {layout: 'center'},
          content: [{attrs: {collection: info.collection, id: info.id, type: 'file'}, type: 'media'}],
          type: 'mediaSingle',
        })
      }

      // Update the page with the patched ADF body (version 2).
      const updatedPage = await client.content.updateContent({
        body: {
          storage: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
        },
        id: pageId,
        title,
        type: 'page',
        version: {number: 2},
      })

      return {data: updatedPage, success: true}
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {error: errorMessage, success: false}
    }
  }

  /**
   * Delete a comment from a page
   */
  async deleteComment(id: string): Promise<ApiResult> {
    try {
      const client = this.getClient()
      await client.content.deleteContent({id})

      return {
        data: true,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Delete a page
   */
  async deleteContent(pageId: string): Promise<ApiResult> {
    try {
      const client = this.getClient()
      await client.content.deleteContent({id: pageId})

      return {
        data: true,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Download attachment from a page
   */
  async downloadAttachment(attachmentId: string, outputPath?: string): Promise<ApiResult> {
    try {
      const client = this.getClient()

      // Get attachment metadata
      const attachment = await client.content.getContentById({
        expand: ['container', 'metadata.mediaType', 'version'],
        id: attachmentId,
      })

      const fileName = (attachment as {title?: string}).title || 'download'
      const mediaType =
        (attachment as {metadata?: {mediaType?: string}}).metadata?.mediaType || 'application/octet-stream'
      const containerId = (attachment as {container?: {id?: string}}).container?.id

      if (!containerId) {
        return {
          error: `Attachment ${attachmentId} has no parent content`,
          success: false,
        }
      }

      const buffer = await client.contentAttachments.downloadAttachment({
        attachmentId,
        id: containerId,
      })

      const finalPath = outputPath || path.join(process.cwd(), fileName)
      fs.writeFileSync(finalPath, buffer)

      return {
        data: {
          attachmentId,
          filename: fileName,
          mimeType: mediaType,
          savedTo: finalPath,
          size: buffer.length,
        },
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Get or create Confluence client
   */
  getClient(): ConfluenceClient {
    if (this.client) {
      return this.client
    }

    this.client = new ConfluenceClient({
      authentication: {
        basic: {
          apiToken: this.config.apiToken,
          email: this.config.email,
        },
      },
      host: this.config.host,
    })

    return this.client
  }

  /**
   * Get page details
   */
  async getContent(pageId: string): Promise<ApiResult> {
    try {
      const client = this.getClient()
      const page = await client.content.getContentById({
        expand: ['body.storage', 'children.attachment', 'children.comment', 'space', 'version'],
        id: pageId,
      })

      return {
        data: page,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Get space details
   */
  async getSpace(spaceKey: string): Promise<ApiResult> {
    try {
      const client = this.getClient()
      const space = await client.space.getSpace({spaceKey})

      return {
        data: space,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * List all spaces
   */
  async listSpaces(): Promise<ApiResult> {
    try {
      const client = this.getClient()
      const response = await client.space.getSpaces()

      const spaces = response.results || []
      const simplifiedSpaces = spaces.map((s: {id?: number; key?: string; name?: string; type?: string}) => ({
        id: String(s.id),
        key: s.key,
        name: s.name,
        type: s.type,
      }))

      return {
        data: simplifiedSpaces,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Search pages using CQL
   */
  async searchContents(cql: string, limit = 10, expand?: string[]): Promise<ApiResult> {
    try {
      const client = this.getClient()

      const response = await client.content.searchContentByCQL({
        cql,
        expand,
        limit,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Test Confluence API connection
   */
  async testConnection(): Promise<ApiResult> {
    try {
      const client = this.getClient()
      const currentUser = await client.users.getCurrentUser()

      return {
        data: {currentUser, serverInfo: {}},
        success: true,
      }
    } catch (error: unknown) {
      return {
        error: typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error),
        success: false,
      }
    }
  }

  /**
   * Update a comment on a page
   */
  async updateComment(commentId: string, body: string): Promise<ApiResult> {
    try {
      const client = this.getClient()

      // Convert Markdown body to Confluence ADF
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      const bodyContent = markdownToAdf(body.replace(/\\n/g, '\n'))

      // Get current comment to find its version
      const comment = await client.content.getContentById({
        expand: ['version'],
        id: commentId,
      })

      const currentVersion = ((comment as {version?: {number?: number}}).version?.number ?? 0) + 1

      const response = await client.content.updateContent({
        body: {
          storage: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
        },
        id: commentId,
        title: '',
        type: 'comment',
        version: {
          number: currentVersion,
        },
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  /**
   * Update an existing page
   */
  async updateContent(pageId: string, fields: Record<string, unknown>): Promise<ApiResult> {
    try {
      const client = this.getClient()

      // Get current page to find its version
      const page = await client.content.getContentById({
        expand: ['version'],
        id: pageId,
      })

      const currentVersion = ((page as {version?: {number?: number}}).version?.number ?? 0) + 1
      const title = (fields.title as string) ?? (page as {title?: string}).title ?? ''
      const body = fields.body as string | undefined

      const response = await client.content.updateContent({
        id: pageId,
        type: 'page',
        ...(body === undefined
          ? {}
          : {
              body: {
                storage: {
                  representation: 'atlas_doc_format',
                  // eslint-disable-next-line unicorn/prefer-string-replace-all
                  value: JSON.stringify(markdownToAdf(body.replace(/\\n/g, '\n'))),
                },
              },
            }),
        title,
        version: {
          number: currentVersion,
        },
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object' ? String((error as {message?: unknown}).message) : String(error)
      return {
        error: errorMessage,
        success: false,
      }
    }
  }

  private collectExternalMedia(
    nodes: Array<Record<string, unknown>>,
    map: Map<string, Array<Record<string, unknown>>>,
  ): void {
    for (const node of nodes) {
      const content = node.content as Array<Record<string, unknown>> | undefined
      const media = node.type === 'mediaSingle' ? content?.[0] : undefined
      const attrs = media?.type === 'media' ? (media.attrs as Record<string, unknown> | undefined) : undefined

      if (attrs?.type === 'external' && typeof attrs.url === 'string') {
        const base = path.basename(attrs.url)
        const list = map.get(base) ?? []
        list.push(attrs)
        if (!map.has(base)) map.set(base, list)
        continue
      }

      if (content) this.collectExternalMedia(content, map)
    }
  }
}
