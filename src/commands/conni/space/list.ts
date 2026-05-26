import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Command, Flags} from '@oclif/core'

import {clearClients, listSpaces} from '../../../conni/conni-client.js'

export default class SpaceList extends Command {
  static override description = 'List all Confluence spaces'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SpaceList)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const result = await listSpaces(auth)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
