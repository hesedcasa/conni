import {Args, Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'

import {readConfig} from '../../../config.js'
import {addAttachment, clearClients} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentAttachment extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    file: Args.string({description: 'Path to the file to upload', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add attachment to Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 123456 ./document.pdf']
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentAttachment)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    action.start(`Uploading attachment "${args.file}" to page ${args.pageId}`)

    const result = await addAttachment(config.auth, args.pageId, args.file)
    clearClients()

    if (result.success) {
      action.stop('✓ Successfully uploaded')
    } else {
      action.stop('✗ Upload failed')
    }

    if (flags.toon) {
      this.log(formatAsToon(result))
    } else {
      this.logJson(result)
    }
  }
}
