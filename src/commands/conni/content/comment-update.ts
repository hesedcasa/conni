import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, updateComment} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentUpdateComment extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    id: Args.string({description: 'Comment ID to update', required: true}),
    body: Args.string({description: 'Comment in Markdown format', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Update a comment in Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 1544224770 "\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```"',
    '<%= config.bin %> <%= command.id %> 1544224770 "$(cat content.md)"',
  ]
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentUpdateComment)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await updateComment(config.auth, args.id, args.body)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
