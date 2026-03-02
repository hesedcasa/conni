import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, getContent} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentGet extends Command {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }
  static override description = 'Get details of a Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 1544060948']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentGet)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await getContent(config.auth, args.pageId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
