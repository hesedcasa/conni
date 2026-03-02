import {Args, Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, updateContent} from '../../../conni/conni-client.js'

export default class ContentUpdate extends Command {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }
  static override description = 'Update an existing Confluence content'
  static override examples = [
    "<%= config.bin %> <%= command.id %> 1076199489 --fields title='New summary' body='New description'",
    "<%= config.bin %> <%= command.id %> 1076199489 --fields body='\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```'",
    '<%= config.bin %> <%= command.id %> 1076199489 --fields body="$(cat content.md)"',
  ]
  static override flags = {
    fields: Flags.string({description: 'Content fields to update in key=value format', multiple: true, required: true}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentUpdate)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    const fields: Record<string, string> = {}
    if (flags.fields) {
      for (const field of flags.fields) {
        const [key, ...valueParts] = field.split('=')
        const value = valueParts.join('=')
        fields[key] = value
      }
    }

    const result = await updateContent(config.auth, args.pageId, fields)
    clearClients()

    this.logJson(result)
  }
}
