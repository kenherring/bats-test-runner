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
	Location,
	Position,
} from 'vscode'
import { log } from './ChannelLogger'
import { spawn, SpawnOptions } from 'child_process'
import { IBatsExport, ITestSummary } from 'extensionExports'
import path from 'path'

export function activate (context: ExtensionContext) {

	let testSummary: ITestSummary | undefined = undefined
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

		return runTests(run, context.extensionUri, testsToRun).then((sum: ITestSummary) => {
			testSummary = sum
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
		getTestSummary: () => testSummary
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

function runTests (run: TestRun, extensionUri: Uri, tests: TestItem[]) {

	const testSummary: ITestSummary = {
		started: 0,
		errored: 0,
		failed: 0,
		passed: 0,
		skipped: 0,
	}

	const proms = []

	for (const item of tests) {
		log.info('running test ' + item.id)
		run.started(item)

		const prom = executeTest(run, extensionUri, item).then((testSummary: ITestSummary) => {
			run.passed(item, 0)
			return testSummary
		}, (e: unknown) => {
			log.error('executeTest error: ' + e)
			let message: TestMessage = new TestMessage('unknown error')
			if (e instanceof Error) {
				message = new TestMessage(e.message)
			} else {
				message = new TestMessage(e as string)
			}
			if (item.parent) {
				run.failed(item.parent, message, 0)
			} else {
				run.failed(item, message, 0)
			}
			const sum: ITestSummary = {
				started: 0,
				errored: 1,
				failed: 0,
				passed: 0,
				skipped: 0,
			}
			return sum
		})

		proms.push(prom.then((sum: ITestSummary) => {
			testSummary.started += sum.started
			testSummary.errored += sum.errored
			testSummary.failed += sum.failed
			testSummary.passed += sum.passed
			testSummary.skipped += sum.skipped
			return
		}, (e: unknown) => {
			throw e
		}))
	}
	return Promise.all(proms).then(() => {
		log.info('all tests done')
		run.end()
		return testSummary
	})
}

async function executeTest (run: TestRun, extensionUri: Uri, item: TestItem) {
	log.info('executeTest item.id=' + item.id)
	if (!item.uri) {
		throw new Error('item.uri is undefined')
	}

	log.info('extensionUri=' + extensionUri.fsPath)
	// const dir = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin', 'bats').fsPath.replace(/\\/g, '/')
	const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin').fsPath
	const batsRelativePath = path.relative(__dirname, batsPath)
	// log.info('batsPath=' + batsPath)
	// log.info('batsRelativePath=' + batsRelativePath)
	// const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'libexec', 'bats-core', 'bats').fsPath
	// const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin').fsPath.replace(/\\/g, '/')
	const shell = 'bash'
	const cmd = 'bats'
	// const args = [
	// 	'PATH=$PATH',
	// ]
	const args = [
		workspace.asRelativePath(item.uri),
		'--formatter',
		'tap',
		'--timing',
		// '--line-reference-format',
		// 'colon',
	]


	if (item.parent) {
		args.push('--filter', '\'' + item.label + '\'')
	}

	const envs = process.env
	// log.info('PATH=' + JSON.stringify(process.env['PATH'], null, 2), run)
	let separator = ':'
	if (process.platform === 'win32') {
		separator = ';'
	}
	log.info('envs[PATH].1=' + envs['PATH'])
	for (const k in envs) {
		if (k.toLowerCase() === 'path') {
			log.info('envs[' + k + ']=' + envs[k])
			envs[k] = envs[k] + separator + batsPath
		}
	}
	log.info('envs[PATH].2=' + envs['PATH'])

	const spawnOptions: SpawnOptions = {
		cwd: workspace.getWorkspaceFolder(item.uri)?.uri.fsPath,
		shell: shell,
		// argv0: '',
		// argv0: cmd,
		timeout: 10000,
		env: envs,

		// signal: abort.signal,
	}

	const testSummary: ITestSummary = {
		started: 0,
		errored: 0,
		failed: 0,
		passed: 0,
		skipped: 0,
	}

	let currentTest: TestItem = item

	const prom = new Promise<void>((resolve, reject) => {
		log.info('cmd: ' + cmd + ' ' + args.join(' '), run, item)
		const proc = spawn(cmd, args, spawnOptions)
		let msgs: string[] = []

		proc.stdout?.on('data', (data: Buffer) => {
			const lines = data.toString().trim().replace(/\r/g, '').split('\n')

			let status = ''
			let testNum = -1
			let testName = ''
			let duration = -1

			// Example: not ok 1 addition using bc in 0sec
			const countRegex = /^(\d+)..(\d+)$/
			const okRegex = /^(ok|not ok) (\d+) (.*) in (\d+)sec$/
			const locationRegex = /^# \(in test file (.*.bats), line (\d+)\)$/
			const errorRegex = /^# (.*): line (\d+): (.*)$/

			for (const line of lines) {
				const okMatch = okRegex.exec(line)
				if (okMatch) {
					status = okMatch[1]
					testNum = Number(okMatch[2])
					testName = okMatch[3]
					duration = Number(okMatch[4])

					for (const [, child] of item.children) {
						if (child.label === testName) {
							processOutput(run, currentTest, msgs)
							msgs = []
							currentTest = child
						}
					}

					if (status == 'ok') {
						run.passed(currentTest, duration)
					} else {
						run.failed(currentTest, [], duration)
					}
				}

				msgs.push(line)
			}
		})
		proc.stderr?.on('data', (data: Buffer) => {
			const output = data.toString().replace(/\r/g, '').replace(/\n/g, '\r\n[stderr]: ')
			// TODO make this red?
			log.info('[stderr]: ' + output, run, currentTest)
		})
		proc.once('spawn', () => {
			log.info('spawn')
			testSummary.started++
			run.started(item)
		}).on('message', (message: string) => {
			log.info('[message]: ' + message, run, currentTest)
		}).on('error', (e: Error) => {
			log.error('[error]: ' + e, run, currentTest)
			testSummary.errored++
			run.errored(item, new TestMessage(e.message))
			reject(e)
		}).on('close', (code: number) => {
			log.info('spawn close: ' + code)
			processOutput(run, currentTest, msgs)
			if (code !== 0) {
				testSummary.failed++
				reject(new Error('failed with code ' + code))
			} else {
				testSummary.passed++
				run.passed(item, 0)
				resolve()
			}
		})
	})

	await prom
	log.info('executeTest done')
	return testSummary
}

function processOutput (run: TestRun, currentTest: TestItem, msgs: string[]) {
	run.appendOutput('----- processOutput msgs.length=' + msgs.length + ' -----\r\n')

	const locationRegex1 = /file (.*\.bats), line (\d+)/
	const locationRegex2 = /^(# )(.*)(: line )(\d+)(: )(.*)$/
	const commandRegex = /# *`(.*)' (failed.*)/

	const errs: string[] = []
	let loc: Location | undefined = undefined
	for (const msg of msgs) {
		if (msg.startsWith('# ')) {
			errs.push(msg)
		}
		const commandMatch = commandRegex.exec(msg)
		const locationMatch1 = locationRegex1.exec(msg)
		const locationMatch2 = locationRegex2.exec(msg)


		if (commandMatch) {
			const testMessage = new TestMessage(commandMatch[2])
			run.failed(currentTest, [testMessage])
		}
		if (locationMatch1) {
			loc = new Location(currentTest.uri!, new Position(Number(locationMatch1[2]) - 1, 0))
		}
		if (locationMatch2) {
			run.appendOutput('---- location match=' + JSON.stringify(locationMatch2) + ' -----\r\n')
			run.appendOutput('     locationMatch[2]=' + locationMatch2[2] + '\r\n')
			const workspaceUri = workspace.getWorkspaceFolder(currentTest.uri!)?.uri
			// run.appendOutput('      uri=' + uri?.fsPath + '\r\n')
			// run.appendOutput('      uri=' + JSON.stringify(uri) + '\r\n')
			// if (uri) {
			// 	uri = Uri.joinPath(currentTest.uri!, '..', '..', locationMatch2[2].replace(/\\/g, '/'))
			// 	// run.appendOutput('      uri=' + uri.fsPath + '\r\n')
			// 	run.appendOutput('      uri=' + JSON.stringify(uri) + '\r\n')
			// } else {
			// 	uri = currentTest.uri!
			// }

			const uriA = Uri.joinPath(currentTest.uri!, '..', '..', 'test0.bats') // WORKS
			const uriB = Uri.joinPath(workspaceUri!, 'src\\test0.sh')
			// const uriC = Uri.joinPath(workspaceUri!, 'test0.sh')
			const uriC = Uri.joinPath(workspaceUri!, 'src\\anotherFile.sh')
			// const uriC = Uri.joinPath(workspaceUri!, locationMatch2[2])

			// eslint-disable-next-line promise/catch-or-return
			workspace.fs.stat(uriB).then((stat) => {
				run.appendOutput('----- uriB stat=' + JSON.stringify(stat) + ' ------ \r\n')
				return
			}, (e: unknown) => {
				run.appendOutput('----- uriB error=' + e + ' ------ \r\n')
				return
			})

			const loc2A = new Location(uriA, new Position(Number(locationMatch2[4]) - 1, 0))
			const loc2B = new Location(uriC, new Position(Number(locationMatch2[4]), 0))
			const loc2C = new Location(uriB, new Position(Number(locationMatch2[4]), 0))
			const loc2D = new Location(currentTest.uri!, new Position(Number(locationMatch2[4]) - 1, 0))
			run.appendOutput('----- loc2A - ' + loc2A.uri.fsPath + ' ------ \r\n')
			run.appendOutput('----- loc2A - ' + loc2B.uri.fsPath + ' ------ \r\n')
			run.appendOutput('----- loc2A - ' + loc2C.uri.fsPath + ' ------ \r\n')
			run.appendOutput('----- loc2A - ' + loc2D.uri.fsPath + ' ------ \r\n')
			run.appendOutput('----- loc2A - ' + JSON.stringify(loc2A) + ' ------ \r\n')
			run.appendOutput('----- loc2B - ' + JSON.stringify(loc2B) + ' ------ \r\n')
			run.appendOutput('----- loc2C - ' + JSON.stringify(loc2C) + ' ------ \r\n')
			run.appendOutput('----- loc2D - ' + JSON.stringify(loc2D) + ' ------ \r\n')
			run.appendOutput(locationMatch2[0] + '\r\n')
			run.appendOutput(locationMatch2[1] + '\n')
			run.appendOutput(locationMatch2[2] + '\n')
			run.appendOutput(locationMatch2[3] + '\n')
			run.appendOutput(locationMatch2[4] + '\n')
			run.appendOutput(locationMatch2[5] + '\n')
			run.appendOutput('A: ' + locationMatch2[6] + '\r\n', loc2A, currentTest)
			run.appendOutput('B: ' + locationMatch2[6] + '\r\n', loc2B, currentTest)
			run.appendOutput('C: ' + locationMatch2[6] + '\r\n', loc2C, currentTest)
			run.appendOutput('D: ' + locationMatch2[6] + '\r\n', loc2D, currentTest)
			// run.appendOutput(locationMatch2[6] + '\r\n', loc2B, currentTest)
			continue
		}


		run.appendOutput(msg + '\r\n')

	}


	// if (errs.length > 0) {
	// 	run.errored(currentTest, new TestMessage(errs.join('\n')))
	// }

	// run.appendOutput(msgs.join('\r\n'), loc, currentTest)
}

// [stdout] 1..6
// [stdout] not ok 1 addition using bc in 0sec
// [stdout] # (in test file test0.bats, line 4)
// [stdout] #   `result="$(echo 2+2 | bc)"' failed with status 127
// [stdout] # /tmp/bats-run-384/bats.437.src: line 4: bc: command not found
// [stdout] ok 2 simple passing test in 1sec
// [stdout] not ok 3 addition using dc in 0sec
// [stdout] # (in test file test0.bats, line 14)
// [stdout] #   `result="$(echo 2 2+p | dc)"' failed with status 127
// [stdout] # /tmp/bats-run-384/bats.454.src: line 14: dc: command not found
// [stdout] ok 4 simple passing test 2 in 0sec
// [stdout] not ok 5 addition using dc fail in 0sec
// [stdout] # (in test file test0.bats, line 25)
// [stdout] #   `result="$(echo 3 3+p | dc)"' failed with status 127
// [stdout] # /tmp/bats-run-384/bats.471.src: line 25: dc: command not found
// [stdout] not ok 6 one line in 0sec
// [stdout] # (in test file test0.bats, line 29)
// [stdout] #   `@test "one line" { result="$(echo 2+2 | bc)"; [ "$result" -eq 4 ]; }' failed with status 127
// [stdout] # /tmp/bats-run-384/bats.479.src: line 29: bc: command not found
