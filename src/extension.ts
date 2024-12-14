import { NotImplementedError } from 'errors'
import {
	extensions,
	CancellationToken, ExtensionContext,
	ExtensionMode,
	LogLevel,
	TestRunProfileKind,
	TestTag,
	tests, workspace,
	TestRunRequest
} from 'vscode'
import { log } from './ChannelLogger'

export function activate (context: ExtensionContext) {
	const ctrl = tests.createTestController('batsTestController', 'BATS')
	context.subscriptions.push(ctrl)

	if (context.extensionMode == ExtensionMode.Development || context.extensionMode == ExtensionMode.Test) {
		log.setLogLevel(LogLevel.Debug)
	}
	log.info('activating extension! (version=' + getExtensionVersion() + ', logLevel=' + log.getLogLevel() + ', context.extensionMode=' + context.extensionMode + ')')

	context.subscriptions.push(
		// workspace.onDidChangeConfiguration(e => { return updateConfiguration(e) }),
		workspace.onDidCreateFiles(e => { log.info('workspace.onDidCreate ' + e.files[0].fsPath) }),
		// workspace.onDidCreateFiles(e => { log.info('workspace.onDidCreate ' + e.files[0].fsPath); return createOrUpdateFile(ctrl, e, true) }),
		// workspace.onDidDeleteFiles(e => { log.info('workspace.onDidDelete ' + e.files[0].fsPath); return deleteFiles(ctrl, e.files) }),
	)

	const runHandler = (request: TestRunRequest, token: CancellationToken) => {
		throw new NotImplementedError('runHandler')
	}

	ctrl.refreshHandler = (token: CancellationToken) => {
		throw new NotImplementedError('refreshHandler')
	}

	ctrl.resolveHandler = (item) => {
		throw new NotImplementedError('resolveHandler')
	}

	const testProfileRun = ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler, true, new TestTag('runnable'), false)
	// const testProfileDebug = ctrl.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler, false, new TestTag('runnable'), false)
	// const testProfileCoverage = ctrl.createRunProfile('Run Tests w/ Coverage', TestRunProfileKind.Coverage, runHandler, true, new TestTag('runnable'), false)
	testProfileRun.configureHandler = () => { throw new NotImplementedError('configureHandler') }
	testProfileRun.loadDetailedCoverage = () => { throw new NotImplementedError('loadDetailedCoverage') }
	testProfileRun.loadDetailedCoverageForTest = () => { throw new NotImplementedError('loadDetailedCoverageForTest') }
	testProfileRun.runHandler = () => { throw new NotImplementedError('runHandler') }
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
