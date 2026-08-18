import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getLabels} from '../../../conni/conni-client.js'

export default class ContentListLabels extends BaseCommand {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }

  static override description = 'List labels on Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456',
    '<%= config.bin %> <%= command.id %> 123456 --prefix global --limit 50',
  ]

  static override flags = {
    limit: Flags.integer({description: 'Maximum number of labels to return', required: false}),
    prefix: Flags.string({
      description: 'Only return labels with this prefix',
      options: ['global', 'my', 'team'],
      required: false,
    }),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentListLabels)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getLabels(auth, args.pageId, flags.prefix, flags.limit)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
