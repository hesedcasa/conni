import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, getSpace} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class SpaceGet extends Command {
  static override args = {
    spaceKey: Args.string({description: 'Space key', required: true}),
  }
  static override description = 'Get details of a Confluence space'
  static override examples = ['<%= config.bin %> <%= command.id %> DEV']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(SpaceGet)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await getSpace(config.auth, args.spaceKey)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
