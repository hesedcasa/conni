import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getFooterComments} from '../../../conni/conni-client.js'

export default class ContentListComments extends BaseCommand {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }

  static override description = 'List footer comments on Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456',
    '<%= config.bin %> <%= command.id %> 123456 --limit 25',
    '<%= config.bin %> <%= command.id %> 123456 --sort created-date --limit 10',
  ]

  static override flags = {
    'body-format': Flags.string({
      description: 'Body format of the returned comments',
      options: ['atlas_doc_format', 'storage', 'view'],
      required: false,
    }),
    cursor: Flags.string({description: 'Cursor from a previous response to fetch the next page', required: false}),
    limit: Flags.integer({description: 'Maximum number of comments to return', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    sort: Flags.string({description: 'Sort order, e.g. created-date or -created-date', required: false}),
    status: Flags.string({
      description: 'Filter by comment status, e.g. current or draft (can be used multiple times)',
      multiple: true,
      required: false,
    }),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentListComments)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getFooterComments(auth, args.pageId, {
      bodyFormat: flags['body-format'],
      cursor: flags.cursor,
      limit: flags.limit,
      sort: flags.sort,
      status: flags.status,
    })
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
