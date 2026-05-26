import {Args, Command, Flags} from '@oclif/core'

import {createProfileManager} from '../../../config.js'
import {clearClients, getSpace} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

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
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
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
