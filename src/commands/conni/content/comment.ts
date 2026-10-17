import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {addComment, clearClients} from '../../../conni/conni-client.js'
import {readTextValue} from '../../../text-input.js'

export default class ContentAddComment extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- pageId must be the first arg per CLAUDE.md convention */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    body: Args.string({
      description: 'Comment in Markdown format. @<path> reads it from that file (@- for stdin; @@ for a literal @)',
      required: true,
    }),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add comment to Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> 123456 "\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```"',
    '<%= config.bin %> <%= command.id %> 123456 @content.md',
  ]

  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentAddComment)
    const body = await readTextValue(args.body)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await addComment(auth, args.pageId, body)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
