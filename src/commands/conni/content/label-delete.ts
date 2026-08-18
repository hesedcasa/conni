import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, removeLabel} from '../../../conni/conni-client.js'

export default class ContentDeleteLabel extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- pageId must be the first arg per CLAUDE.md convention */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    label: Args.string({description: 'Name of the label to remove, without its prefix', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Remove a label from Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456 release-notes',
    '<%= config.bin %> <%= command.id %> 123456 favourite',
  ]
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentDeleteLabel)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await removeLabel(auth, args.pageId, args.label)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
