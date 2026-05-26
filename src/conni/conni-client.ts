import {type ApiResult, type AuthConfig, createApiClient} from '@hesed/plugin-lib'

import {ConniApi} from './conni-api.js'

const {clearClients, getClient} = createApiClient('Confluence', (config: AuthConfig) => new ConniApi(config))

export {clearClients}

export async function listSpaces(config: AuthConfig): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.listSpaces()
}

export async function getSpace(config: AuthConfig, spaceKey: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.getSpace(spaceKey)
}

export async function searchContents(
  config: AuthConfig,
  cql: string,
  limit?: number,
  expand?: string[],
): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.searchContents(cql, limit, expand)
}

export async function getContent(config: AuthConfig, pageId: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.getContent(pageId)
}

export async function createPage(config: AuthConfig, fields: Record<string, unknown>): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.createPage(fields)
}

export async function createPageWithMedia(
  config: AuthConfig,
  fields: Record<string, unknown>,
  filePaths: string[],
): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.createPageWithMedia(fields, filePaths)
}

export async function updateContent(
  config: AuthConfig,
  pageId: string,
  fields: Record<string, unknown>,
): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.updateContent(pageId, fields)
}

export async function addAttachment(config: AuthConfig, pageId: string, filePath: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.addAttachment(pageId, filePath)
}

export async function addComment(config: AuthConfig, pageId: string, body: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.addComment(pageId, body)
}

export async function deleteComment(config: AuthConfig, id: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.deleteComment(id)
}

export async function updateComment(config: AuthConfig, id: string, body: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.updateComment(id, body)
}

export async function deleteContent(config: AuthConfig, pageId: string): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.deleteContent(pageId)
}

export async function testConnection(config: AuthConfig): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.testConnection()
}

export async function downloadAttachment(
  config: AuthConfig,
  attachmentId: string,
  outputPath?: string,
): Promise<ApiResult> {
  const conni = await getClient(config)
  return conni.downloadAttachment(attachmentId, outputPath)
}
