import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, getSpace} from '../../../conni/conni-client.js'

export default class SpaceGet extends Command {
  static override args = {
    spaceKey: Args.string({description: 'Space key', required: true}),
  }
  static override description = 'Get details of a Confluence space'
  static override examples = ['<%= config.bin %> <%= command.id %> DEV']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(SpaceGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getSpace(auth, args.spaceKey)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
