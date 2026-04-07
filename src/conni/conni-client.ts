import type {ApiResult, Config} from './conni-api.js'

import {ConniApi} from './conni-api.js'

let conniApi: ConniApi | null

/**
 * Initialize Confluence API
 */
async function initConni(config: Config): Promise<ConniApi> {
  if (conniApi) return conniApi

  try {
    conniApi = new ConniApi(config)
    return conniApi
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to initialize Confluence client: ${errorMessage}`)
  }
}

/**
 * List all spaces
 * @param config - Confluence configuration
 */
export async function listSpaces(config: Config): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.listSpaces()
}

/**
 * Get space details
 * @param config - Confluence configuration
 * @param spaceKey - Space key
 */
export async function getSpace(config: Config, spaceKey: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.getSpace(spaceKey)
}

/**
 * Search pages using CQL
 * @param config - Confluence configuration
 * @param cql - CQL query string
 * @param limit - Maximum number of contents per page
 * @param expand - Properties of the content to expand
 */
export async function searchContents(
  config: Config,
  cql: string,
  limit?: number,
  expand?: string[],
): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.searchContents(cql, limit, expand)
}

/**
 * Get page details
 * @param config - Confluence configuration
 * @param pageId - Page ID
 */
export async function getContent(config: Config, pageId: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.getContent(pageId)
}

/**
 * Create a new page
 * @param config - Confluence configuration
 * @param fields - Page fields (spaceKey, title, body, parentId)
 */
export async function createPage(config: Config, fields: Record<string, unknown>): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.createPage(fields)
}

/**
 * Create a new page with inline media attachments
 * @param config - Confluence configuration
 * @param fields - Page fields (spaceKey, title, body, parentId)
 * @param filePaths - Local file paths to upload and embed inline
 */
export async function createPageWithMedia(
  config: Config,
  fields: Record<string, unknown>,
  filePaths: string[],
): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.createPageWithMedia(fields, filePaths)
}

/**
 * Update an existing page
 * @param config - Confluence configuration
 * @param pageId - Page ID
 * @param fields - Page fields to update (title, body)
 */
export async function updateContent(
  config: Config,
  pageId: string,
  fields: Record<string, unknown>,
): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.updateContent(pageId, fields)
}

/**
 * Add an attachment to a page
 * @param config - Confluence configuration
 * @param pageId - Page ID
 * @param filePath - Path to the file to upload
 */
export async function addAttachment(config: Config, pageId: string, filePath: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.addAttachment(pageId, filePath)
}

/**
 * Add a comment to a page
 * @param config - Confluence configuration
 * @param pageId - Page ID
 * @param body - Comment body
 */
export async function addComment(config: Config, pageId: string, body: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.addComment(pageId, body)
}

/**
 * Delete a comment from a page
 * @param config - Confluence configuration
 * @param id - Comment ID
 */
export async function deleteComment(config: Config, id: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.deleteComment(id)
}

/**
 * Update a comment on a page
 * @param config - Confluence configuration
 * @param id - Comment ID
 * @param body - Comment body
 */
export async function updateComment(config: Config, id: string, body: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.updateComment(id, body)
}

/**
 * Delete a page
 * @param config - Confluence configuration
 * @param pageId - Page ID
 */
export async function deleteContent(config: Config, pageId: string): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.deleteContent(pageId)
}

/**
 * Test Confluence API connection
 * @param config - Confluence configuration
 */
export async function testConnection(config: Config): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.testConnection()
}

/**
 * Clear clients (for cleanup)
 */
export function clearClients(): void {
  if (conniApi) {
    conniApi.clearClients()
    conniApi = null
  }
}

/**
 * Download attachment from a page
 * @param config - Confluence configuration
 * @param attachmentId - Attachment ID
 * @param outputPath - Output file path (optional)
 */
export async function downloadAttachment(
  config: Config,
  attachmentId: string,
  outputPath?: string,
): Promise<ApiResult> {
  const conni = await initConni(config)
  return conni.downloadAttachment(attachmentId, outputPath)
}
