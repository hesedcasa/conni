import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, deleteContent} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentDelete extends Command {
  static override args = {
    pageId: Args.string({description: 'Page ID to delete', required: true}),
  }
  static override description = 'Delete a Confluence page'
  static override examples = ['<%= config.bin %> <%= command.id %> 1543634992']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentDelete)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await deleteContent(config.auth, args.pageId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
