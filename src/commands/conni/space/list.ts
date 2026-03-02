import {Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, listSpaces} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class SpaceList extends Command {
  static override description = 'List all Confluence spaces'
  static override examples = ['<%= config.bin %> <%= command.id %>']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(SpaceList)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await listSpaces(config.auth)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
