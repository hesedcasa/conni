import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getContent} from '../../../conni/conni-client.js'

export default class ContentGet extends Command {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }
  static override description = 'Get details of a Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 1544060948']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getContent(auth, args.pageId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
