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
	FileType,
} from 'vscode'
import { log } from './ChannelLogger'
import { spawn, SpawnOptions } from 'child_process'
import { IBatsExport, ITestSummary } from 'extensionExports'

export function activate (context: ExtensionContext) {

	let testSummary: ITestSummary | undefined = undefined
	const ctrl = tests.createTestController('batsTestController', 'BATS')

	context.subscriptions.push(ctrl)

	if (context.extensionMode == ExtensionMode.Development || context.extensionMode == ExtensionMode.Test) {
		log.setLogLevel(LogLevel.Debug)
	}
	log.info('activating extension! (version=' + getExtensionVersion() + ', logLevel=' + log.getLogLevel() + ', context.extensionMode=' + context.extensionMode + ')')


	log.info('subscription-1')
	context.subscriptions.push(
		workspace.onDidSaveTextDocument((doc) => parseFileForTestCases(ctrl, findTestItem(ctrl, doc.uri))),
		workspace.onDidCreateFiles((event) => {
			log.info('onDidCreateFiles files.length=' + event.files.length)
			return parseFilesForTestCases(ctrl, event.files as Uri[])
		}),
		workspace.onDidDeleteFiles((event) => { deleteTests(ctrl, event.files as Uri[]) }),
	)
	log.info('subscription-2')

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
				item.tags = [new TestTag('runnable')]
				ctrl.items.add(item)
			}
			return
		})
	}

	ctrl.resolveHandler = (item): Thenable<void> => {
		log.info('resolveHandler item.id=' + item?.id)
		if (!item) {
			deleteMissingTests(ctrl).catch((_e: unknown) => { return })
			return workspace.findFiles('**/*.bats').then((files) => {
				log.info('found ' + files.length + ' files')
				for (const file of files) {
					createTest(ctrl, file)
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
		getTestCount: (testUri?: Uri) => getTestCount(ctrl, testUri),
		resolveTests: async (uri?: Uri) => {
			let testItem: TestItem | undefined = undefined
			if (uri) {
				testItem = findTestItem(ctrl, uri)
			}
			await ctrl.resolveHandler!(testItem)
			return getTestCount(ctrl, uri)
		},
		getTestSummary: () => testSummary
	}
	return exports
}

function createTest (ctrl: TestController, file: Uri) {
	const item = ctrl.createTestItem(file.fsPath, workspace.asRelativePath(file), file)
	item.canResolveChildren = true
	item.tags = [new TestTag('runnable')]
	ctrl.items.add(item)
}

function parseFilesForTestCases (ctrl: TestController, files: Uri[]) {
	const proms = []
	log.info('parsing ' + files.length + ' files for test cases')
	for (const f of files) {
		const item = findTestItem(ctrl, f)
		if (!item) {
			createTest(ctrl, f)
		}
		proms.push(parseFileForTestCases(ctrl, item))
	}
	return Promise.all(proms)
}

function parseFileForTestCases (ctrl: TestController, item: TestItem | undefined) {
	if (!item) {
		return Promise.resolve()
	}
	if (!item.uri) {
		throw new Error('item.uri is undefined')
	}

	return workspace.fs.readFile(item.uri).then((data) => {
		const content = data.toString()
		const regex = /@test\s+["'](.*)["']\s+{/g
		let match = regex.exec(content)

		const childrenNames: string[] = []
		for (const [, child] of item.children) {
			childrenNames.push(child.label.toString())
		}

		while (match) {
			const testName = match[1]
			const testUri = item.uri!.with({ fragment: testName })

			const idx = childrenNames.indexOf(testName)
			if (idx > -1) {
				// already have this test, skip it
				childrenNames.splice(idx, 1)
				continue
			}

			const testItem = ctrl.createTestItem(testUri.toString(), testName, item.uri)
			testItem.tags = [new TestTag('runnable')]
			item.children.add(testItem)

			const line = content.substring(0, match.index).split('\n').length
			testItem.range = new Range(line - 1, 0, line, 0)
			testItem.description = 'line ' + line

			match = regex.exec(content)
		}

		// remove any children that are no longer in the file
		for (const name of childrenNames) {
			for (const [, child] of item.children) {
				if (child.label.toString() === name) {
					item.children.delete(child.id)
					break
				}
			}
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

function getTestCount (ctrl: TestController, testUri?: Uri) {
	if (!testUri) {
		return ctrl.items.size
	}

	const item = findTestItem(ctrl, testUri)
	return item?.children.size ?? 0
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
	const batsPath = Uri.joinPath(extensionUri, 'node_modules', 'bats', 'bin').fsPath
	// const batsRelativePath = path.relative(__dirname, batsPath)
	const shell = 'bash'
	const cmd = 'bats'
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
	let separator = ':'
	if (process.platform === 'win32') {
		separator = ';'
	}
	for (const k in envs) {
		if (k.toLowerCase() === 'path') {
			envs[k] = envs[k] + separator + batsPath
		}
	}

	const spawnOptions: SpawnOptions = {
		cwd: workspace.getWorkspaceFolder(item.uri)?.uri.fsPath,
		shell: shell,
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
			// let testNum = -1
			let testName = ''
			let duration = -1

			// Example: not ok 1 addition using bc in 0sec
			const okRegex = /^(ok|not ok) (\d+) (.*) in (\d+)(sec|ms)$/

			for (const line of lines) {
				const okMatch = okRegex.exec(line)
				if (!okMatch) {
					continue
				}
				status = okMatch[1]
				// testNum = Number(okMatch[2])
				testName = okMatch[3]
				duration = Number(okMatch[4])
				if (okMatch[5] == 'sec') {
					duration = duration * 1000
				}

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
			testSummary.failed++
			run.failed(item, new TestMessage(e.message))
			reject(e)
		}).on('close', (code: number) => {
			log.info('spawn close: ' + code)
			processOutput(run, currentTest, msgs)
			if (code !== 0) {
				testSummary.failed++
				if (code === 1) {
					resolve()
				} else {
					reject(new Error('failed with code ' + code))
				}
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

	// const locationRegex1 = /file (.*\.bats), line (\d+)/
	const locationRegex2 = /^(# )(.*)(: line )(\d+)(: )(.*)$/
	const commandRegex = /# *`(.*)' (failed.*)/

	// let loc: Location | undefined = undefined
	for (const msg of msgs) {
		const commandMatch = commandRegex.exec(msg)
		// const locationMatch1 = locationRegex1.exec(msg)
		const locationMatch2 = locationRegex2.exec(msg)


		if (commandMatch) {
			const testMessage = new TestMessage(commandMatch[2])
			run.failed(currentTest, [testMessage])
		}
		// if (locationMatch1) {
		// 	loc = new Location(currentTest.uri!, new Position(Number(locationMatch1[2]) - 1, 0))
		// }
		if (locationMatch2) {
			const workspaceUri = workspace.getWorkspaceFolder(currentTest.uri!)?.uri
			const uriC = Uri.joinPath(workspaceUri!, locationMatch2[2])
			const loc2C = new Location(uriC, new Position(Number(locationMatch2[4]) - 1, 0))
			run.appendOutput(locationMatch2[0].replace(locationMatch2[6], ''))
			run.appendOutput(locationMatch2[6] + '\r\n', loc2C, currentTest)
			continue
		}

		run.appendOutput(msg + '\r\n')
	}
}

function findTestItem (ctrl: TestController, uri: Uri): TestItem | undefined {
	// find the test item by uri in the test controller
	for (const [, item] of ctrl.items) {
		if (item.uri && item.uri.fsPath === uri.fsPath) {
			return item
		}
		for (const [, child] of item.children) {
			if (child.uri && child.uri.fsPath === uri.fsPath) {
				return child
			}
		}
	}
	return undefined
}

function deleteTests (ctrl: TestController, uris: Uri[]) {
	for (const uri of uris) {
		log.info('deleteTests uri=' + uri.toString())
		const item = findTestItem(ctrl, uri)
		if (item) {
			log.info('deleting test item id=' + item.id)
			ctrl.items.delete(item.id) // remove from the test controller
		} else {
			log.info('no test item found for uri=' + uri.toString())
		}
	}
}

function deleteMissingTests (ctrl: TestController) {
	const proms = []
	for (const [, item] of ctrl.items) {
		proms.push(workspace.fs.stat(item.uri!)
			.then((stat) => {
				if (stat.type !== FileType.File) {
					ctrl.items.delete(item.id)
				}
				return
			}, (_e: unknown) => {
				ctrl.items.delete(item.id)
			}))
	}
	return Promise.all(proms)
}
