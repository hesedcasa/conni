import {Args, Command, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'

import {readConfig} from '../../../config.js'
import {clearClients, downloadAttachment} from '../../../conni/conni-client.js'
import {formatAsToon} from '../../../format.js'

export default class ContentDownloadAttachment extends Command {
  static override args = {
    attachmentId: Args.string({description: 'Attachment ID', required: true}),
    outputPath: Args.string({description: 'Output file path', required: false}),
  }
  static override description = 'Download attachment from Confluence content'
  static override examples = [
    '<%= config.bin %> <%= command.id %> att12345',
    '<%= config.bin %> <%= command.id %> att12345 ./document.pdf',
  ]
  static override flags = {
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ContentDownloadAttachment)
    const config = await readConfig(this.config.configDir, this.log.bind(this))
    if (!config) {
      return
    }

    if (!args.outputPath) {
      args.outputPath = process.cwd()
    }

    action.start(`Downloading attachment "${args.attachmentId}" to ""`)

    const result = await downloadAttachment(config.auth, args.attachmentId, args.outputPath)
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
