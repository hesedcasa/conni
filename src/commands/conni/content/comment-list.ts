import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getFooterComments} from '../../../conni/conni-client.js'

export default class ContentListComments extends BaseCommand {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }

  static override description = 'List footer comments on Confluence content, including replies nested under each parent'

  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456',
    '<%= config.bin %> <%= command.id %> 123456 --limit 25',
    '<%= config.bin %> <%= command.id %> 123456 --sort created-date --limit 10',
    '<%= config.bin %> <%= command.id %> 123456 --no-replies',
  ]

  static override flags = {
    'body-format': Flags.string({
      description: 'Body format of the returned comments',
      options: ['atlas_doc_format', 'storage', 'view'],
      required: false,
    }),
    cursor: Flags.string({
      description:
        'Cursor from a previous response to fetch the next page of top-level comments (replies are not paged)',
      required: false,
    }),
    limit: Flags.integer({
      description: 'Maximum number of top-level comments to return (replies are not counted)',
      required: false,
    }),
    'no-replies': Flags.boolean({
      description: 'Return top-level footer comments only, without fetching replies',
      required: false,
    }),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    sort: Flags.string({description: 'Sort order, e.g. created-date or -created-date', required: false}),
    status: Flags.string({description: 'Filter by comment status, e.g. current or draft', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentListComments)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`, {exit: 1})
    }

    const result = await getFooterComments(auth, args.pageId, {
      bodyFormat: flags['body-format'],
      cursor: flags.cursor,
      includeReplies: flags['no-replies'] ? false : undefined,
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
