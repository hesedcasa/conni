import {type Config} from '@oclif/core'
import {expect} from 'chai'

import {BaseCommand} from '../src/base-command.js'

describe('BaseCommand', () => {
  let originalExitCode: NodeJS.Process['exitCode']

  beforeEach(() => {
    originalExitCode = process.exitCode
  })

  afterEach(() => {
    process.exitCode = originalExitCode
  })

  // Runs the command through the real, lockfile-pinned @oclif/core 5.1.0
  // superclass, so the override is exercised against the catch() the
  // standalone leg actually resolves. No esmock: replacing @oclif/core here
  // breaks esmock's loader for every test file that runs after this one. The
  // config only needs what _run's init touches; the JSON-mode error print
  // goes through console.log.
  async function runPinnedOclif(command_: (command: BaseCommand) => void): Promise<void> {
    class TestCommand extends BaseCommand {
      public execute(): Promise<unknown> {
        return this._run()
      }

      public async run(): Promise<unknown> {
        this.parsed = true
        command_(this)
        return undefined
      }
    }

    const config = {
      bin: 'conni',
      scopedEnvVarKeys: () => [],
    } as unknown as Config

    const originalLog = console.log
    console.log = () => {}
    try {
      await new TestCommand([], config).execute()
    } finally {
      console.log = originalLog
    }
  }

  it('pins exitCode to 1 when the resolved oclif catch promotes a different exit', async () => {
    process.exitCode = undefined

    // 5.1.0's catch copies err.exitCode into process.exitCode, which stands in
    // for 5.1.8+ promoting err.oclif.exit: either way the superclass leaves 2.
    await runPinnedOclif(() => {
      throw Object.assign(new Error('Missing authentication config.'), {exitCode: 2, oclif: {exit: 2}})
    })

    expect(process.exitCode).to.equal(1)
  })

  it('pins exitCode to 1 for a real CLIError under the pinned @oclif/core superclass', async () => {
    process.exitCode = undefined

    await runPinnedOclif((command: BaseCommand) => {
      command.error('Missing authentication config.', {exit: 2})
    })

    expect(process.exitCode).to.equal(1)
  })

  it('keeps the exit code of a real this.exit() under the pinned @oclif/core superclass', async () => {
    process.exitCode = undefined

    await runPinnedOclif((command: BaseCommand) => {
      command.exit(7)
    })

    expect(process.exitCode).to.equal(7)
  })
})
