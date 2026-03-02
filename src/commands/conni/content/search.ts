import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, searchContents} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentSearch extends Command {
  static override args = {
    cql: Args.string({description: 'CQL expression', required: true}),
  }
  static override description = 'Search for Confluence contents using CQL'
  static override examples = [
    '<%= config.bin %> <%= command.id %> \'space=DEV AND title ~ "Implement email OTP login" AND creator=currentUser()\'',
    "<%= config.bin %> <%= command.id %> 'created > startOfMonth()' --limit=5 --expand=body,version",
  ]
  static override flags = {
    expand: Flags.string({description: 'Properties of the content to expand', required: false}),
    limit: Flags.integer({description: 'Maximum number of contents per page', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentSearch)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await searchContents(
      config.auth,
      args.cql,
      flags.limit,
      flags.expand ? flags.expand.split(',') : undefined,
    )
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
