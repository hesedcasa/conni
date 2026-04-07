import {Command, Flags} from '@oclif/core'

import {readConfig} from '../../../config.js'
import {clearClients, createPage, createPageWithMedia} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentCreate extends Command {
  static override args = {}
  static override description = 'Create a new Confluence page'
  static override examples = [
    '<%= config.bin %> <%= command.id %> --fields spaceKey="DEV" title="New title" body="New description" status="draft"',
    '<%= config.bin %> <%= command.id %> --fields spaceKey="DEV" title="New title" body=\'\n# Header\n## Sub-header\n- Item 1\n- Item 2\n```bash\nls -a\n```\'',
    '<%= config.bin %> <%= command.id %> --fields spaceKey="DEV" title="Child page" body="Content" parentId="123456"',
    '<%= config.bin %> <%= command.id %> --fields spaceKey="DEV" title="Page with image" body="See the diagram:\n![diagram](./diagram.png)" --attach ./diagram.png',
    '<%= config.bin %> <%= command.id %> --fields spaceKey="DEV" title="Page with files" body="Content" --attach ./image.png --attach ./report.pdf',
  ]
  static override flags = {
    attach: Flags.string({
      description: 'Path to a file to upload and embed inline (can be used multiple times)',
      multiple: true,
      required: false,
    }),
    fields: Flags.string({
      description: 'Minimum fields required: spaceKey, title & body',
      multiple: true,
      required: true,
      summary: 'Content fields in key=value format',
    }),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ContentCreate)
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

    const requiredFields = ['spaceKey', 'title', 'body']
    for (const required of requiredFields) {
      if (!fields[required]) {
        this.error(`Required field "${required}" is missing`)
      }
    }

    const result =
      flags.attach && flags.attach.length > 0
        ? await createPageWithMedia(config.auth, fields, flags.attach)
        : await createPage(config.auth, fields)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
