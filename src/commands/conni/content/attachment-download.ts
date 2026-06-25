import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, downloadAttachment} from '../../../conni/conni-client.js'

export default class ContentDownloadAttachment extends BaseCommand {
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
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentDownloadAttachment)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    if (!args.outputPath) {
      args.outputPath = process.cwd()
    }

    action.start(`Downloading attachment "${args.attachmentId}" to ""`)

    const result = await downloadAttachment(auth, args.attachmentId, args.outputPath)
    clearClients()

    if (result.success) {
      action.stop('✓ Successfully uploaded')
    } else {
      action.stop('✗ Upload failed')
    }

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
