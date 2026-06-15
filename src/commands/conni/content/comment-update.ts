import {createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Command, Flags} from '@oclif/core'

import {clearClients, updateComment} from '../../../conni/conni-client.js'

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
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentUpdateComment)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await updateComment(auth, args.id, args.body)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
