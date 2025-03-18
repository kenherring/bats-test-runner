import * as vscode from 'vscode'
import { log } from 'ChannelLogger'
import assert from 'assert'
import { IBatsExport } from 'extensionExports'

export function sleep (time = 10, msg?: string | null) {
	if (msg !== null) {
		let status = 'sleeping for ' + time + 'ms'
		if (msg) {
			status = status + ' [' + msg + ']'
		}
		log.info(status)
	}
	return new Promise(resolve => setTimeout(resolve, time))
}

suite('proj0  - Extension Test Suite', () => {

	let ext: vscode.Extension<unknown>
	let exports: IBatsExport

	suiteSetup('proj0 - before', () => {
		log.info('suiteSetup')
		const localExt = vscode.extensions.getExtension('kherring.bats-test-runner')
		if (!localExt) {
			log.error('Extension not found')
			assert.fail('Extension not found')
		}
		ext = localExt
		if (!ext.isActive) {
			return sleep(250)
		}
	})

	setup('proj0 - beforeEach', async () => {
		log.info('beforeEach1')
		if (!ext.isActive) {
			log.error('Extension not active')
			assert.fail('Extension not active')
		}
		exports = ext.exports as IBatsExport
		if (exports.getTestCount() === 0) {
			const testCount = await exports.resolveTests()
			if (testCount === 0) {
				throw new Error('No tests found')
			}
		}

	})

	teardown('proj0 - afterEach', () => {
		log.info('teardown')
	})

	test('proj0.1 - run all tests', async () => {
		log.info('proj0.1 - run all tests')
		if (exports.getTestCount() === 0) {
			const prom = sleep(250)
			await prom
		}
		if (exports.getTestCount() === 0) {
			log.error('No tests found')
			assert.fail('No tests found')
		}

		log.info('ext.exports=' + JSON.stringify(exports))

		await vscode.commands.executeCommand('testing.runAll')
		log.info('proj0.1 - run all tests - done')
	})

})
