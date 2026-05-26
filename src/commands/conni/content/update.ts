import {Args, Command, Flags} from '@oclif/core'
import fs from 'fs-extra'

import {createProfileManager} from '../../../config.js'
import {clearClients, updateContent} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentUpdate extends Command {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }
  static override description = 'Update an existing Confluence content'
  static override examples = [
    "<%= config.bin %> <%= command.id %> 1076199489 --fields title='New summary' body='New description'",
    "<%= config.bin %> <%= command.id %> 1076199489 --fields body='\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```'",
    '<%= config.bin %> <%= command.id %> 1076199489 --fields body="$(cat content.md)"',
    '<%= config.bin %> <%= command.id %> 1076199489 --fields body=@storage.xml representation=storage --full-width',
  ]
  static override flags = {
    fields: Flags.string({
      description:
        'Content fields to update in key=value format. Use @file to read value from a file (e.g. body=@content.xml)',
      multiple: true,
      required: true,
    }),
    'full-width': Flags.boolean({
      description: 'Set page appearance to full-width',
      required: false,
    }),
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentUpdate)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile)
    const auth = await loadAuthConfig()
    if (!auth) {
      return
    }

    const fields: Record<string, string> = {}
    if (flags.fields) {
      for (const field of flags.fields) {
        const [key, ...valueParts] = field.split('=')
        let value = valueParts.join('=')
        if (value.startsWith('@')) {
          const filePath = value.slice(1)
          value = fs.readFileSync(filePath, 'utf8')
        }

        fields[key] = value
      }
    }

    if (flags['full-width']) {
      fields.fullWidth = 'true'
    }

    const result = await updateContent(auth, args.pageId, fields)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
