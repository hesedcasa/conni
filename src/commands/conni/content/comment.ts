import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {addComment, clearClients} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentAddComment extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    body: Args.string({description: 'Comment in Markdown format', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add comment to Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456 "\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```"',
    '<%= config.bin %> <%= command.id %> 123456 "$(cat content.md)"',
  ]
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentAddComment)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const result = await addComment(config.auth, args.pageId, args.body)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
