import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'
import {action} from '@oclif/core/ux'

import {BaseCommand} from '../../../base-command.js'
import {addAttachment, clearClients} from '../../../conni/conni-client.js'

export default class ContentAttachment extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects */
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
    file: Args.string({description: 'Path to the file to upload', required: true}),
  }
  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Add attachment to Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 123456 ./document.pdf']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentAttachment)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    action.start(`Uploading attachment "${args.file}" to page ${args.pageId}`)

    const result = await addAttachment(auth, args.pageId, args.file)
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
