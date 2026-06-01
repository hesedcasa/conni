import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, deleteComment} from '../../../conni/conni-client.js'

export default class ContentDeleteComment extends Command {
  static override args = {
    id: Args.string({description: 'Comment ID to delete', required: true}),
  }
  static override description = 'Delete comment from Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 1544224770']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentDeleteComment)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await deleteComment(auth, args.id)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
