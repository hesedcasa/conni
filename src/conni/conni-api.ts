import {type ApiResult, type AuthConfig} from '@hesed/plugin-lib'
import {createV1Client, createV2Client, isApiError, type V1Client, type V2Client} from 'confluence.js'
import {createClient} from 'confluence.js/core'
import fs from 'fs-extra'
import path from 'node:path'
import {inspect} from 'node:util'

import {type AdfDocument, markdownToAdfDocument, unescapeNewlines} from '../markdown.js'
import {installProxyDispatcher} from '../proxy.js'

/**
 * Leading java/spring exception class name in a Confluence error message, e.g.
 * `com.atlassian.confluence.api.service.exceptions.api.NotFoundException: `. The
 * package qualifier is optional, so a bare `NotFoundException: ` strips too. The
 * class name still has to end in Exception or Error, which keeps an ordinary
 * message like `Note: something happened` intact.
 */
const JAVA_EXCEPTION_PREFIX = /^(?:[\w$]+\.)*[\w$]*(?:Exception|Error):\s*/

/**
 * confluence.js's v2 parameter types declare numeric ids, but the library never
 * validates request parameters at runtime — the id only flows into the URL
 * template. Confluence ids reach 19 digits, beyond Number.MAX_SAFE_INTEGER, so
 * converting to a number would silently corrupt them; passing the string through
 * keeps them exact. (The library's own response models type ids as strings.)
 */
function asV2Id(id: string): number {
  return id as unknown as number
}

/** Human-readable messages Confluence puts in an error body, preferring its own translations. */
function errorBodyMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []

  const {errors} = body as {errors?: unknown}
  if (!Array.isArray(errors)) return []

  const messages: string[] = []
  for (const entry of errors) {
    if (typeof entry !== 'object' || entry === null) continue

    const translation = (entry as {message?: {translation?: unknown}}).message?.translation
    if (typeof translation === 'string' && translation !== '') {
      messages.push(translation)
      continue
    }

    // v2 endpoints report `{code, title}` instead of a translated message.
    const {title} = entry as {title?: unknown}
    if (typeof title === 'string' && title !== '') messages.push(title)
  }

  return messages
}

/**
 * Reduce a thrown value to a human-readable message.
 *
 * confluence.js 3.x throws typed `ApiError` subclasses (of `Error`) whose
 * `message` embeds the raw response body, so prefer the parsed `body`'s
 * Confluence-translated messages and fall back to a status summary. Non-Error
 * values (defensive, and the shape older confluence.js versions rejected with)
 * still reduce to their message rather than '[object Object]'.
 */
function toErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    const messages = errorBodyMessages(error.body)
    if (messages.length > 0) {
      return messages.join('; ')
    }

    return `Confluence request failed with status ${error.status}`
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const {data, message, statusCode} = error as {
      data?: {errors?: Array<{message?: {translation?: string}}>}
      message?: unknown
      statusCode?: unknown
    }

    const translations = (data?.errors ?? [])
      .map((entry) => entry?.message?.translation)
      .filter((translation): translation is string => Boolean(translation))

    if (translations.length > 0) {
      return translations.join('; ')
    }

    if (typeof message === 'string') {
      const stripped = message.replace(JAVA_EXCEPTION_PREFIX, '').trim()

      // Confluence sometimes reports nothing useful, e.g. a bad attachment id comes
      // back as 'NotFoundException: null'. The status code beats echoing 'null'.
      if (stripped !== '' && stripped !== 'null') {
        return stripped
      }

      if (statusCode !== undefined) {
        return `Confluence request failed with status ${String(statusCode)}`
      }
    }

    try {
      const serialized = JSON.stringify(error)
      if (serialized !== undefined) {
        return serialized
      }
    } catch {
      // Fall through to the circular-safe formatter below.
    }

    return inspect(error)
  }

  return String(error)
}

/**
 * Confluence API Utility
 * Provides core Confluence API operations
 */
export class ConniApi {
  private clients?: {v1: V1Client; v2: V2Client}
  private readonly config: AuthConfig

  constructor(config: AuthConfig) {
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

      const {v1} = this.getClient()
      const fileContent = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)

      const response = await v1.contentAttachments.createAttachment({
        attachments: [
          {
            content: fileContent,
            filename: fileName,
          },
        ],
        id: pageId,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Add a comment to a page
   */
  async addComment(pageId: string, body: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()

      // Convert Markdown body to Confluence ADF
      const bodyContent = markdownToAdfDocument(body)

      const response = await v2.comment.createFooterComment({
        body: {
          representation: 'atlas_doc_format',
          value: JSON.stringify(bodyContent),
        },
        pageId,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Add labels to a page. Existing labels are left untouched.
   */
  async addLabels(pageId: string, labels: string[], prefix = 'global'): Promise<ApiResult> {
    try {
      const {v1} = this.getClient()

      const response = await v1.contentLabels.addLabelsToContent({
        body: labels.map((name) => ({name, prefix})),
        id: pageId,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Clear client (for cleanup)
   */
  clearClients(): void {
    this.clients = undefined
  }

  /**
   * Create a new page
   */
  async createPage(fields: Record<string, unknown>): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      const {contentPayload} = this.buildPageBody(fields)
      const spaceId = await this.resolveSpaceId(fields.spaceKey as string)
      const response = await v2.page.createPage({body: {...contentPayload, spaceId}})

      if (fields.fullWidth && response.id) {
        await this.setPageAppearance(response.id, 'full-width')
      }

      return {data: response, success: true}
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Create a new page with inline media attachments.
   * Creates the page first to obtain a page ID, then uploads attachments and
   * patches the ADF body to embed them by file ID before updating the page.
   */
  async createPageWithMedia(fields: Record<string, unknown>, filePaths: string[]): Promise<ApiResult> {
    try {
      const {bodyContent, contentPayload} = this.buildPageBody(fields)
      const {
        body: {representation},
        title,
      } = contentPayload

      const externalMediaByBasename = new Map<string, Array<Record<string, unknown>>>()
      this.collectExternalMedia(bodyContent.content, externalMediaByBasename)

      const inlinePaths: string[] = []
      const trailingPaths: string[] = []
      for (const f of filePaths) {
        if (externalMediaByBasename.has(path.basename(f))) {
          inlinePaths.push(f)
        } else {
          trailingPaths.push(f)
        }
      }

      // Create the page first to get a page ID for attachment uploads.
      const {v2} = this.getClient()
      const spaceId = await this.resolveSpaceId(fields.spaceKey as string)
      const page = await v2.page.createPage({body: {...contentPayload, spaceId}})
      const pageId = (page as {id?: string}).id
      if (!pageId) {
        return {error: 'Failed to get page ID from creation response', success: false}
      }

      const uploadResults = await Promise.all(filePaths.map(async (filePath) => this.addAttachment(pageId, filePath)))
      const firstFailure = uploadResults.find((r) => !r.success)
      if (firstFailure) return firstFailure

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

      this.patchMediaNodes(bodyContent.content, inlinePaths, trailingPaths, fileInfoByPath, externalMediaByBasename)

      const updatedPage = await v2.page.updatePage({
        body: {
          // The v2 update endpoint requires id and status in the body itself.
          body: {representation, value: JSON.stringify(bodyContent)},
          id: pageId,
          status: (page as {status?: string}).status ?? 'current',
          title,
          version: {number: 2},
        },
        id: asV2Id(pageId),
      })

      return {data: updatedPage, success: true}
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Delete a comment from a page
   */
  async deleteComment(id: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      await v2.comment.deleteFooterComment({commentId: asV2Id(id)})

      return {
        data: true,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Delete a page
   */
  async deleteContent(pageId: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      await v2.page.deletePage({id: asV2Id(pageId)})

      return {
        data: true,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Download attachment from a page
   */
  async downloadAttachment(attachmentId: string, outputPath?: string): Promise<ApiResult> {
    try {
      const {v1, v2} = this.getClient()

      // Get attachment metadata
      const attachment = await v2.attachment.getAttachmentById({id: attachmentId})

      const fileName = (attachment as {title?: string}).title || 'download'
      const mediaType = (attachment as {mediaType?: string}).mediaType || 'application/octet-stream'
      const {pageId} = attachment as {pageId?: string}

      if (!pageId) {
        return {
          error: `Attachment ${attachmentId} has no parent content`,
          success: false,
        }
      }

      const buffer = await v1.contentAttachments.downloadAttatchment({
        attachmentId,
        id: pageId,
      })

      // The library types its Buffer as `ArrayBuffer | ArrayBufferView`, but its
      // download path always produces a Uint8Array (core/createClient.js wraps
      // response.arrayBuffer()), so the cast is what the runtime value is.
      const bytes = buffer as Uint8Array

      const finalPath = outputPath || path.join(process.cwd(), fileName)
      fs.writeFileSync(finalPath, bytes)

      return {
        data: {
          attachmentId,
          filename: fileName,
          mimeType: mediaType,
          savedTo: finalPath,
          size: bytes.length,
        },
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Get or create Confluence clients
   *
   * One core transport serves both API versions: v1 keeps the operations
   * Atlassian has not moved (CQL search, label writes, attachment upload and
   * download, current user), while pages, spaces, comments and reads live in v2.
   */
  getClient(): {v1: V1Client; v2: V2Client} {
    if (this.clients) {
      return this.clients
    }

    installProxyDispatcher(this.config.host!)

    const core = createClient({
      auth: this.config.email
        ? {
            apiToken: this.config.apiToken,
            email: this.config.email,
            type: 'basic',
          }
        : {
            token: this.config.apiToken,
            // A bare bearer token against the configured host — the 2.x `oauth2`
            // behavior. 3.x's `oauth2` auth routes through the api.atlassian.com
            // gateway instead, which is not what conni profiles describe.
            type: 'bearer',
          },
      host: this.config.host!,
    })

    this.clients = {v1: createV1Client(core), v2: createV2Client(core)}

    return this.clients
  }

  /**
   * Get page details
   */
  async getContent(pageId: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      const page = await v2.page.getPageById({
        bodyFormat: 'storage',
        id: asV2Id(pageId),
        includeVersion: true,
      })

      return {
        data: page,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Get the labels on a page
   */
  async getLabels(pageId: string, prefix?: string, limit?: number): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      const response = await v2.label.getPageLabels({
        id: asV2Id(pageId),
        limit,
        prefix,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Get space details
   */
  async getSpace(spaceKey: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      const response = await v2.space.getSpaces({keys: [spaceKey]})

      const space = (response as {results?: unknown[]}).results?.[0]
      if (!space) {
        return {
          error: `Space not found: ${spaceKey}`,
          success: false,
        }
      }

      return {
        data: space,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * List all spaces
   */
  async listSpaces(): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      const response = await v2.space.getSpaces()

      const spaces = response.results || []
      const simplifiedSpaces = spaces.map((s: {id?: string; key?: string; name?: string; type?: string}) => ({
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
      return this.toErrorResult(error)
    }
  }

  /**
   * Remove a single label from a page
   */
  async removeLabel(pageId: string, label: string): Promise<ApiResult> {
    try {
      const {v1} = this.getClient()
      // The query-parameter variant is used because the path-parameter one
      // rejects label names containing "/".
      await v1.contentLabels.removeLabelFromContentUsingQueryParameter({
        id: pageId,
        name: label,
      })

      return {
        data: true,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Search pages using CQL
   */
  async searchContents(cql: string, limit = 10, expand?: string[]): Promise<ApiResult> {
    try {
      const {v1} = this.getClient()

      const response = await v1.content.searchContentByCQL({
        cql,
        expand,
        limit,
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Set page appearance (full-width or fixed-width)
   */
  async setPageAppearance(pageId: string, appearance: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()
      await Promise.all(
        ['content-appearance-published', 'content-appearance-draft'].map(async (key) =>
          v2.contentProperties.createPageProperty({
            key,
            pageId: asV2Id(pageId),
            value: appearance,
          }),
        ),
      )

      return {success: true}
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Test Confluence API connection
   */
  async testConnection(): Promise<ApiResult> {
    try {
      const {v1} = this.getClient()
      const currentUser = await v1.users.getCurrentUser()

      return {
        data: {currentUser, serverInfo: {}},
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Update a comment on a page
   */
  async updateComment(commentId: string, body: string): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()

      // Convert Markdown body to Confluence ADF
      const bodyContent = markdownToAdfDocument(body)

      // Get current comment to find its version
      const comment = await v2.comment.getFooterCommentById({
        commentId: asV2Id(commentId),
        includeVersion: true,
      })

      const currentVersion = ((comment as {version?: {number?: number}}).version?.number ?? 0) + 1

      const response = await v2.comment.updateFooterComment({
        body: {
          body: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(bodyContent),
          },
          version: {
            number: currentVersion,
          },
        },
        commentId: asV2Id(commentId),
      })

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  /**
   * Update an existing page
   */
  async updateContent(pageId: string, fields: Record<string, unknown>): Promise<ApiResult> {
    try {
      const {v2} = this.getClient()

      // Get current page to find its version
      const page = await v2.page.getPageById({
        id: asV2Id(pageId),
        includeVersion: true,
      })

      const currentVersion = ((page as {version?: {number?: number}}).version?.number ?? 0) + 1
      const title = (fields.title as string) ?? (page as {title?: string}).title ?? ''
      const body = fields.body as string | undefined
      const representation = (fields.representation as string | undefined) ?? 'atlas_doc_format'
      const isStorage = representation === 'storage'

      const response = await v2.page.updatePage({
        body: {
          // Storage bodies are sent verbatim, so unescape here; the ADF path
          // gets the same treatment inside markdownToAdfDocument.
          ...(body !== undefined && {
            body: {
              representation,
              value: isStorage ? unescapeNewlines(body) : JSON.stringify(markdownToAdfDocument(body)),
            },
          }),
          // The v2 update endpoint requires id and status in the body itself.
          id: pageId,
          status: (page as {status?: string}).status ?? 'current',
          title,
          version: {
            number: currentVersion,
          },
        },
        id: asV2Id(pageId),
      })

      if (fields.fullWidth) {
        await this.setPageAppearance(pageId, 'full-width')
      }

      return {
        data: response,
        success: true,
      }
    } catch (error: unknown) {
      return this.toErrorResult(error)
    }
  }

  private toErrorResult(error: unknown): ApiResult {
    return {
      error: toErrorMessage(error),
      success: false,
    }
  }

  private buildPageBody(fields: Record<string, unknown>) {
    const representation = (fields.representation as string | undefined) ?? 'atlas_doc_format'
    const isStorage = representation === 'storage'
    const rawBody = unescapeNewlines(fields.body as string)
    const bodyContent = isStorage ? (rawBody as unknown as AdfDocument) : markdownToAdfDocument(rawBody)
    const spaceKey = fields.spaceKey as string
    const title = fields.title as string
    const parentId = fields.parentId as string | undefined
    const status = fields.status as string | undefined
    return {
      bodyContent,
      contentPayload: {
        body: {representation, value: isStorage ? rawBody : JSON.stringify(bodyContent)},
        ...(parentId && {parentId}),
        ...(status && {status}),
        title,
      },
      spaceKey,
    }
  }

  /** v2 creation endpoints take a numeric space id, so a profile's key resolves through getSpaces first. */
  private async resolveSpaceId(spaceKey: string): Promise<string> {
    const {v2} = this.getClient()
    const response = await v2.space.getSpaces({keys: [spaceKey]})
    const spaceId = (response as {results?: Array<{id?: string}>}).results?.[0]?.id
    if (!spaceId) {
      throw new Error(`Space not found: ${spaceKey}`)
    }

    return spaceId
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
        if (!map.has(base)) map.set(base, [])
        map.get(base)!.push(attrs)
        continue
      }

      if (content) this.collectExternalMedia(content, map)
    }
  }

  /* eslint-disable-next-line max-params -- media patching needs all five collaborating structures */
  private patchMediaNodes(
    bodyNodes: Array<Record<string, unknown>>,
    inlinePaths: string[],
    trailingPaths: string[],
    fileInfoByPath: Map<string, {collection: string; id: string}>,
    externalMediaByBasename: Map<string, Array<Record<string, unknown>>>,
  ): void {
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

    for (const filePath of trailingPaths) {
      const info = fileInfoByPath.get(filePath)
      if (!info) continue
      bodyNodes.push({
        attrs: {layout: 'center'},
        content: [{attrs: {collection: info.collection, id: info.id, type: 'file'}, type: 'media'}],
        type: 'mediaSingle',
      })
    }
  }
}
