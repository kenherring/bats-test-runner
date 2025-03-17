import * as vscode from 'vscode'
import { log } from 'ChannelLogger'
import assert from 'assert'

suite('proj0  - Extension Test Suite', () => {

	suiteSetup('proj0 - before', () => {
		log.info('suiteSetup')
	})

	teardown('proj0 - afterEach', () => {
		log.info('teardown')
	})

	test('proj0.1 - run all tests', () => {
		log.info('proj0.1 - run all tests')
		const ext = vscode.extensions.getExtension('bats-test-runner')
		if (!ext) {
			log.error('Extension not found')
			assert.fail('Extension not found')
			return
		}
		return vscode.commands.executeCommand('testing.runAll').then(() => {
			log.info('proj0.1 - run all tests - done')
			return
		}, (e: unknown) => {
			if (e instanceof Error) {
				log.error(e)
				assert.fail(e)
			} else {
				throw new Error('Unknown error e=' + e)
			}
		})
	})

})
