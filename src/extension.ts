import { NotImplementedError } from 'errors'
import {
	extensions,
	CancellationToken, ExtensionContext,
	ExtensionMode,
	LogLevel,
	TestRunProfileKind,
	TestTag,
	tests, workspace,
	TestRunRequest,
	TestController,
	TestItem,
	TestRun,
	TestMessage,
	Uri,
	Range,
} from 'vscode'
import { log } from './ChannelLogger'
import { spawn, SpawnOptions } from 'child_process'
import { IBatsExport } from 'extensionExports'

export function activate (context: ExtensionContext) {
	const ctrl = tests.createTestController('batsTestController', 'BATS')

	context.subscriptions.push(ctrl)

	if (context.extensionMode == ExtensionMode.Development || context.extensionMode == ExtensionMode.Test) {
		log.setLogLevel(LogLevel.Debug)
	}
	log.info('activating extension! (version=' + getExtensionVersion() + ', logLevel=' + log.getLogLevel() + ', context.extensionMode=' + context.extensionMode + ')')

	// context.subscriptions.push(
	// 	// workspace.onDidChangeConfiguration(e => { return updateConfiguration(e) }),
	// 	workspace.onDidCreateFiles(e => { log.info('workspace.onDidCreate ' + e.files[0].fsPath) }),
	// 	// workspace.onDidCreateFiles(e => { log.info('workspace.onDidCreate ' + e.files[0].fsPath); return createOrUpdateFile(ctrl, e, true) }),
	// 	// workspace.onDidDeleteFiles(e => { log.info('workspace.onDidDelete ' + e.files[0].fsPath); return deleteFiles(ctrl, e.files) }),
	// )

	const runHandler = (request: TestRunRequest, token: CancellationToken) => {
		log.info('runHandler')

		const run = ctrl.createTestRun(request)
		const testsToRun = []
		if (!request.include) {
			log.info('request.include is undefined')
			for (const [, item] of ctrl.items) {
				log.info('adding item.id=' + item.id)
				testsToRun.push(item)
			}
		} else {
			log.info('request.include.length=' + request.include.length)
			for (const item of request.include) {
				log.info('adding item.id=' + item.id)
				testsToRun.push(item)
				run.enqueued(item)
				for (const [, child] of item.children) {
					run.enqueued(child)
				}
			}
		}

		return runTests(run, context.extensionUri, testsToRun).then(() => {
			log.info('runHandler done')
			return
		})
	}

	ctrl.refreshHandler = (token: CancellationToken) => {
		log.info('refreshHandler')
		for (const [id, ] of ctrl.items) {
			ctrl.items.delete(id)
		}
		return workspace.findFiles('**/*.bats').then((files) => {
			log.info('found ' + files.length + ' files')
			for (const file of files) {
				const item = ctrl.createTestItem(file.fsPath, workspace.asRelativePath(file), file)
				item.canResolveChildren = true
				log.info('canResolveChildren=' + item.canResolveChildren)
				item.tags = [new TestTag('runnable')]
				ctrl.items.add(item)
			}
			return
		})
	}

	ctrl.resolveHandler = (item): Thenable<void> => {
		log.info('resolveHandler item.id=' + item?.id)
		if (!item) {
			return workspace.findFiles('**/*.bats').then((files) => {
				log.info('found ' + files.length + ' files')
				for (const file of files) {
					const item = ctrl.createTestItem(file.fsPath, workspace.asRelativePath(file), file)
					item.canResolveChildren = true
					log.info('canResolveChildren=' + item.canResolveChildren)
					item.tags = [new TestTag('runnable')]
					ctrl.items.add(item)
				}
				return
			})
		}

		item.busy = true
		return parseFileForTestCases(ctrl, item).then(() => {
			item.busy = false
			return
		})
	}

	ctrl.invalidateTestResults = (items) => {
		log.info('invalidateTestResults')
		throw new NotImplementedError('invalidateTestResults')
	}

	const testProfileRun = ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler, true, new TestTag('runnable'), false)
	// const testProfileDebug = ctrl.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler, false, new TestTag('runnable'), false)
	// const testProfileCoverage = ctrl.createRunProfile('Run Tests w/ Coverage', TestRunProfileKind.Coverage, runHandler, true, new TestTag('runnable'), false)
	testProfileRun.configureHandler = () => { throw new NotImplementedError('configureHandler') }
	testProfileRun.loadDetailedCoverage = () => { throw new NotImplementedError('loadDetailedCoverage') }
	testProfileRun.loadDetailedCoverageForTest = () => { throw new NotImplementedError('loadDetailedCoverageForTest') }

	// await ctrl.refreshHandler(new CancellationTokenSource().token)

	log.info('extension activated!')


	const exports: IBatsExport = {
		getTestCount: () => ctrl.items.size,
		resolveTests: async () => {
			log.info('100')
			await ctrl.resolveHandler!(undefined)
			log.info('101')
			return ctrl.items.size
		},
	}
	return exports
}

function parseFileForTestCases (ctrl: TestController, item: TestItem) {
	log.info('parseFileForTestCases item.id=' + item.id)

	if (!item.uri) {
		throw new Error('item.uri is undefined')
	}

	return workspace.fs.readFile(item.uri).then((data) => {
		const content = data.toString()
		const regex = /@test\s+["'](.*)["']\s+{/g
		let match = regex.exec(content)
		while (match) {
			const testName = match[1]
			const testUri = item.uri!.with({ fragment: testName })
			// const testDescription = match[2]
			const testItem = ctrl.createTestItem(testUri.toString(), testName, item.uri)
			testItem.tags = [new TestTag('runnable')]
			item.children.add(testItem)

			const line = content.substring(0, match.index).split('\n').length
			testItem.range = new Range(line - 1, 0, line, 0)
			testItem.description = 'line ' + line

			match = regex.exec(content)
		}
		return
	})
}

function getExtensionVersion () {
	const ext = extensions.getExtension('kherring.bats-test-runner')
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (ext?.packageJSON && typeof ext.packageJSON.version === 'string') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return ext.packageJSON.version as string
	}
	throw new Error('unable to get extension version')
}

async function runTests (run: TestRun, extensionUri: Uri, tests: TestItem[]) {
	for (const item of tests) {
		log.info('running test ' + item.id)
		run.started(item)

		await executeTest(run, extensionUri, item).then(() => {
			run.passed(item, 0)
			return
		}, (e: unknown) => {
			log.error('executeTest error: ' + e)
			let message: TestMessage = new TestMessage('unknown error')
			if (e instanceof Error) {
				message = new TestMessage(e.message)
			} else {
				message = new TestMessage(e as string)
			}
			run.failed(item, message, 0)
			return
		})
	}
	run.end()
}

async function executeTest (run: TestRun, extensionUri: Uri, item: TestItem) {
	log.info('executeTest item.id=' + item.id)
	if (!item.uri) {
		throw new Error('item.uri is undefined')
	}

	log.info('extensionUri=' + extensionUri.fsPath)
	// const dir = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin', 'bats').fsPath.replace(/\\/g, '/')
	const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'libexec', 'bats-core', 'bats').fsPath
	// const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin').fsPath.replace(/\\/g, '/')
	const args = [
		// cmd,
		workspace.asRelativePath(item.uri),
		'--formatter',
		'tap13',
		'--timing',
		'--line-reference-format',
		'colon',
	]

	if (item.parent) {
		args.push('--filter', '\'' + item.label + '\'')
	}

	const envs = { ...process.env}
	log.info('envs=' + JSON.stringify(envs, null, 2))
	// envs['PATH'] = envs['PATH'] + ':' + batsPath
	// log.info('PATH=' + envs['PATH'])

	const spawnOptions: SpawnOptions = {
		cwd: workspace.getWorkspaceFolder(item.uri)?.uri.fsPath,
		// shell: true,
		// argv0: cmd,
		timeout: 10000,
		env: envs,
		// signal: abort.signal,
	}

	const prom = new Promise<void>((resolve, reject) => {
		log.info('cmd: ' + args.join(' '))
		run.appendOutput('cmd: ' + batsPath + ' ' + args.join(' ') + '\r\n', undefined, item)
		const proc = spawn(batsPath, args, spawnOptions)
		run.appendOutput('proc=' + JSON.stringify(proc, null, 2))
		// const proc = spawn('\'' + batsPath + '\'', args, spawnOptions)

		const lines: string[] = []
		proc.stdout?.on('data', (data: Buffer) => {

			lines.push(...data.toString().replace(/\r/g, '').split('\n'))
			const startIndex = lines.findIndex(l => l.startsWith('not ok ') || l.startsWith('ok '))
			const endIndex = lines.findIndex(l => l.trim() == '...')
			log.info('startIndex=' + startIndex + ', endIndex=' + endIndex)
			if (startIndex < 0 || endIndex < 0) {
				return
			}

			const result = lines.slice(startIndex, endIndex + 1)
			let status = ''
			let testName = ''
			let message = ''
			let duration = -1
			let failedMessage = ''
			// let command = ''
			// let statusCode = -1

			const okRegex = /^(ok|not ok) (\d+) (.*)$/
			const durationRegex = /\s+duration_ms:\s+(\d+)/
			const locationRegex = /\(in test file (.*):(\d+)\)/
			const failedRegex = /`(.*)' failed with status (\d+)/

			for (const r of result) {
				const okMatch = okRegex.exec(r)
				if (okMatch) {
					status = okMatch[1]
					testName = okMatch[2]
					message += 'status: ' + status + ', testName: ' + testName + '\n'
					continue
				}

				const durationMatch = durationRegex.exec(r)
				if (durationMatch) {
					duration = parseInt(durationMatch[1])
					continue
				}

				const locationMatch = locationRegex.exec(r)
				if (locationMatch) {
					const file = locationMatch[1]
					const line = parseInt(locationMatch[2])
					message += 'file: ' + file + ', line: ' + line + '\n'
					continue
				}

				const failedMatch = failedRegex.exec(r)
				if (failedMatch) {
					// command = failedMatch[1]
					// statusCode = parseInt(failedMatch[2])
					// failedMessage += 'command: ' + command + ', status: ' + status + '\r\n'
					failedMessage += failedMatch[0] + '\n'
					continue
				}
			}

			if (status === 'ok') {
				run.passed(item, duration)
			} else {
				run.failed(
					item,
					[ new TestMessage(message), new TestMessage(failedMessage) ],
					duration
				)
			}
			const nextItem = item.children.get(item.uri!.with({ fragment: testName })?.fsPath)
			if (nextItem) {
				run.started(nextItem)
			}

			for (let i=0; i <= endIndex; i++) {
				const l = lines.shift()
				if (l) {
					log.info('spawn stdout output: ' + l)
					run.appendOutput(l + '\r\n', undefined, item)
				}
			}


			// not ok 3 addition using dc fail
			// 	---
			// 	duration_ms: 183
			//  message: |
			// 	  (in test file test0.bats:14)
			//    `result="$(echo 3 3+p | dc)"' failed with status 127
			//    /d/bats-test-runner/test_projects/proj0/test0.bats: line 14: dc: command not found
			//  ...
		})
		proc.stderr?.on('data', (data: Buffer) => {
			const output = data.toString().replace(/\r/g, '').replace(/\n/g, '\r\n[stderr]: ')
			// TODO make this red
			// log.error('spawn stderr: ' + data)
			run.appendOutput('[stderr]: ' + output, undefined, item)
		})
		proc.once('spawn', () => {
			log.info('spawn')
			run.started(item)
		}).on('message', (message: string) => {
			run.appendOutput('[message]: ' + message, undefined, item)
		}).on('error', (e: Error) => {
			log.error('spawn error: ' + e)
			// run.appendOutput(e.message, undefined, item)
			run.errored(item, new TestMessage(e.message))
			reject(e)
		}).on('close', (code: number) => {
			log.info('spawn close: ' + code)
			if (code !== 0) {
				run.failed(item, new TestMessage('test failed'), 0)
				reject(new Error('test failed'))
			} else {
				run.passed(item, 0)
				resolve()
			}
		})
	})

	await prom
	log.info('executeTest done')
}
