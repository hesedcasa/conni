import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {addLabels, clearClients} from '../../../conni/conni-client.js'

export default class ContentLabel extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- pageId must be the first arg per CLAUDE.md convention */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    labels: Args.string({description: 'Label name, or comma-separated list of label names', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add labels to Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456 release-notes',
    '<%= config.bin %> <%= command.id %> 123456 "release-notes,q3,draft"',
    '<%= config.bin %> <%= command.id %> 123456 favourite --prefix my',
  ]
  static override flags = {
    prefix: Flags.string({default: 'global', description: 'Label prefix (global, my, team)', required: false}),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentLabel)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const labels = (args.labels as string)
      .split(',')
      .map((label: string) => label.trim())
      .filter(Boolean)

    if (labels.length === 0) {
      this.error('No label names provided.')
    }

    const result = await addLabels(auth, args.pageId, labels, flags.prefix)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
