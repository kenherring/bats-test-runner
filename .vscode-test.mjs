import { createTestConfig } from './test/createTestConfig.mjs'
import { defineConfig } from '@vscode/test-cli'
import * as fs from 'fs'

// https://github.com/microsoft/vscode-test-cli/issues/48
import { env } from 'process'
delete env['VSCODE_IPC_HOOK_CLI']
env['DONT_PROMPT_WSL_INSTALL'] = true

// console.log('sourceMapsEnabled:', sourceMapsEnabled)
// if (process.sourceMapsEnabled == false) {
//     process.setSourceMapsEnabled(true)
// }
// console.log('sourceMapsEnabled:', sourceMapsEnabled)

function getConfig() {
    const config = createTestConfig()
    return config
}

export default getConfig()
