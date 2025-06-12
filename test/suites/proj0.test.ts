import * as vscode from 'vscode'
import * as fs from 'fs'
import assert from 'assert'
import { log } from 'ChannelLogger'
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
	let workspaceUri: vscode.Uri

	suiteSetup('proj0 - before', async () => {
		log.info('suiteSetup')

		workspaceUri = vscode.workspace.workspaceFolders![0].uri
		const deleteFiles = [
			'proj0.2.bats',
			'proj0.2.copy.bats',
			'proj0.3.bats',
			'proj0.4.bats',
			'proj0.5.bats',
		]
		for (const file of deleteFiles) {
			void vscode.workspace.fs.delete(vscode.Uri.joinPath(workspaceUri, file)).then(() => { return }, (_e: unknown) => { return })
		}

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
		log.info('beforeEach')

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
			assert.fail('No tests found')
		}

		await vscode.commands.executeCommand('testing.runAll').then(() => {
			log.info('proj0.1 - run all tests - done')
			return
		}, (e: unknown) => {
			log.error('proj0.1 - run all tests - error: ' + e)
			assert.fail('proj0.1 - run all tests - error: ' + e)
		})

		log.info('exports.getTestCount()=' + exports.getTestCount())
		assert.ok(exports.getTestCount() > 0, 'No tests found')

		const results = exports.getTestSummary()
		log.info('results=' + JSON.stringify(results, null, 2))
		assert.ok(results?.started == 3, 'Expected 3 started, got ' + results?.started)
		assert.ok(results?.errored == 0, 'Expected 0 errors, got ' + results?.errored)
		assert.ok(results?.failed == 2, 'Expected 4 failures, got ' + results?.failed)
		assert.ok(results?.passed == 1, 'Expected 0 passed, got ' + results?.passed)
		assert.ok(results?.skipped == 0, 'Expected 0 skipped, got ' + results?.skipped)
	})

	test('proj0.2 - add test to file', () => {
		log.info('proj0.2 - add test to file')
		const sourceFile = vscode.Uri.joinPath(workspaceUri, 'proj0.2.bats')
		assert.ok(!doesFileExist(sourceFile), `Expected source file ${sourceFile.fsPath} to not exist before the test is added`)

		const prom = vscode.workspace.fs.writeFile(sourceFile, Buffer.from('#!/usr/bin/env bats\n\n@test "new test" {\n  run true\n  assert_success\n}\n'))
			.then(() => {
				assert.ok(doesFileExist(sourceFile), `Failed to create source file ${sourceFile.fsPath}`)
				return sleep(250)
			}).then(() => {
				return exports.resolveTests()
			}).then((count: number) => {
				assert.equal(count, 4, 'Expected 4 tests after adding a new test, but found ' + count)
				return exports.resolveTests(sourceFile)
			}).then((count: number) => {
				assert.equal(count, 1, 'Expected resolveTests to return -1 when called with a specific file that has not been processed yet. Found: ' + count)
				assert.equal(exports.getTestCount(sourceFile), 1, 'Expected 1 tests in the file after adding a new test, but found ' + exports.getTestCount(sourceFile))
				return
			})
		return prom
	})

	test('proj0.3 - verify test summary after adding a test', async () => {
		const sourceFile = vscode.Uri.joinPath(workspaceUri, 'proj0.3.bats')
		await vscode.workspace.fs.writeFile(sourceFile, Buffer.from('#!/usr/bin/env bats\n\n@test "new test" {\n  run true\n  assert_success\n}\n\n@test "new test 2" {\n  run true\n  assert_success\n}\n'))
		assert.ok(doesFileExist(sourceFile), `Failed to create source file ${sourceFile.fsPath}`)
		await exports.resolveTests()
		const firstCount = exports.getTestCount()

		await vscode.workspace.fs.delete(sourceFile).then(() => sleep(259))
		await exports.resolveTests()
		assert.ok(!doesFileExist(sourceFile), `Failed to delete source file ${sourceFile.fsPath} after test`)
		assert.equal(exports.getTestCount(), firstCount - 1, 'Expected ' + (firstCount - 1) + ' tests after deleting the test file, but found ' + exports.getTestCount())
	})

	test('proj0.4 - verify test summary after removing test', async () => {
		const sourceFile = vscode.Uri.joinPath(workspaceUri, 'proj0.4.bats')
		await vscode.workspace.fs.writeFile(sourceFile, Buffer.from('#!/usr/bin/env bats\n\n@test "new test" {\n  run true\n  assert_success\n}\n\n@test "new test 2" {\n  run true\n  assert_success\n}\n'))
		assert.ok(doesFileExist(sourceFile), `Failed to create source file ${sourceFile.fsPath}`)
		await exports.resolveTests()
		await exports.resolveTests(sourceFile)
		const firstCount = exports.getTestCount(sourceFile)
		assert.equal(firstCount, 2, 'Expected 2 tests in the file after adding a new test, but found ' + firstCount)

		await vscode.workspace.fs.writeFile(sourceFile, Buffer.from('#!/usr/bin/env bats\n\n@test "new test" {\n  run true\n  assert_success\n}\n'))
		await exports.resolveTests(sourceFile)
		const newCount = exports.getTestCount(sourceFile)
		log.info('newCount = ' + newCount)
		assert.equal(newCount, firstCount - 1, 'Expected ' + (firstCount - 1) + ' tests after deleting the test file, but found ' + exports.getTestCount())
	})

	test('proj0.5 - create file and open', async () => {
		const sourceFile = vscode.Uri.joinPath(workspaceUri, 'proj0.5.bats')
		await vscode.workspace.fs.writeFile(sourceFile, Buffer.from('#!/usr/bin/env bats\n\n@test "new test" {\n  run true\n  assert_success\n}\n\n@test "new test 2" {\n  run true\n  assert_success\n}\n'))
		await vscode.commands.executeCommand('vscode.open', sourceFile)
		await exports.resolveTests(sourceFile)
		await exports.resolveTests(sourceFile)
		const testCount = exports.getTestCount(sourceFile)
		assert.equal(testCount, 2, 'Expected 2 tests in the file after opening it, but found ' + testCount)
	})

})

function doesFileExist (sourceFile: vscode.Uri | string) {
	const path = typeof sourceFile === 'string' ? sourceFile : sourceFile.fsPath
	try {
		const stat = fs.statSync(path)
		return stat.isFile()
	} catch (_e: unknown) {
		return false
	}
}
