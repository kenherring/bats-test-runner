/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// @ts-nocheck

import { defineConfig } from '@vscode/test-cli'
import { fileURLToPath } from 'url'
import * as glob from 'glob'
import * as path from 'path'
import * as fs from 'fs'
import process from 'process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vsVersionNum = '1.88.0'

function writeConfigToFile (name, config) {
	if (process.env['VERBOSE'] != 'false' && process.env['VERBOSE'] != '0') {
		fs.writeFileSync('.vscode-test.' + name + '.bk.json', JSON.stringify(config, null, 4).replace('    ', '\t'))
	}
}

function getMochaTimeout (projName) {
	switch (projName) {
		case 'proj1': return 30000
	}
	return 30000
}


function getMochaOpts (projName) {
	const reporterDir = path.resolve(__dirname, '..', 'artifacts')
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_json'), {recursive: true})
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_sonar'), {recursive: true})
	fs.mkdirSync(path.resolve(reporterDir, 'mocha_results_xunit'), {recursive: true})
	const jsonFile = path.resolve(reporterDir, 'mocha_results_json', projName + '.json')
	const sonarFile = path.resolve(reporterDir, 'mocha_results_sonar', projName + '.xml')
	const xunitFile = path.resolve(reporterDir, 'mocha_results_xunit', projName + '.xml')

	/** @type {import('mocha').MochaOptions} */
	const mochaOpts = {
		// fullTrace: true
		timeout: getMochaTimeout(projName),
		// ui: 'tdd', // describe, it, etc
		// ui: 'bdd' // default; suite, test, etc
		retries: 0,
		parallel: false,
		bail: false,
		require: [
			'mocha',
			'tsconfig-paths/register',
			'@swc-node/register',
		],
	}

	if (!process.env['VSCODE_PID']) {
		mochaOpts.reporter = 'mocha-multi-reporters'
		mochaOpts.reporterOptions = {
			reporterEnabled: [ 'json-stream', 'spec', 'xunit', 'mocha-reporter-sonarqube' ],
			jsonReporterOptions: { output: jsonFile }, // TODO - not working
			xunitReporterOptions: { output: xunitFile },
			mochaReporterSonarqubeReporterOptions: { filename: sonarFile },
		}
	}

	return mochaOpts
}

function getExtensionVersion () {
	const packageJson = path.resolve(__dirname, '..', 'package.json')
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const packageData = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const version = packageData.version
	if (!version) {
		throw new Error('Version not found in package.json')
	}
	return version
}

function getLaunchArgs (projName) {
	const args = []
	const extVersion = getExtensionVersion()

	// --- start in directory --- //
	// 'test_projects/' + projName, // workspaceFolder is set in the config

	// --- args defined by `code -h` --- //
	// args.push('--add', '<folder>')
	// args.push('--goto', '<file:line[:character]>')
	// args.push('--new-window')
	// args.push('--reuse-window')
	// args.push('--wait')
	// args.push('--locale <locale>')
	// args.push('--user-data-dir', '<dir>')
	// args.push('--profile <profileName>')
	// args.push('--profile-temp') // create a temporary profile for the test run in lieu of cleaning up user data
	// args.push('--help')
	// args.push('--extensions-dir', '../')
	// args.push('--list-extensions')
	// args.push('--show-versions')
	// args.push('--category', '<category>')
	// args.push('--install-extension <ext-id>')

	// if (vsVersion === 'insiders') {
	// args.push('--install-extension', '../bats-test-runner-' + extVersion + '.vsix')
	// } else {
	// 	args.push('--install-extension', './bats-test-runner-insiders-' + extVersion + '.vsix')
	// }
	// args.push('--pre-release')
	// args.push('--uninstall-extension <ext-id>')
	// args.push('--update-extensions')
	// if (vsVersion === 'insiders') {
	// 	args.push('--enable-proposed-api', 'TestCoverage') // '<ext-id>'
	// }
	// if (vsVersion === 'insiders') {
	// 	args.push('--enable-proposed-api', 'kherring.bats-test-runner')
	// }
	// args.push('--version')
	// args.push('--verbose')
	// args.push('--trace')
	// args.push('--log', '<level>')
	if (process.env['VERBOSE'] == 'true') {
		args.push('--log', 'debug')
		// args.push('--log', 'trace')
	}
	// args.push('--log', 'debug') // '<level>'
	// args.push('--log', 'trace') // '<level>'
	// args.push('--log', 'kherring.bats-test-runner:debug') // <extension-id>:<level>
	// args.push('--log', 'kherring.bats-test-runner:trace') // <extension-id>:<level>
	// args.push('--status')
	// args.push('--prof-startup')
	// args.push('--disable-extension <ext-id>')
	args.push('--disable-extensions')
	args.push('--disable-extension', 'vscode.builtin-notebook-renderers')
	args.push('--disable-extension', 'vscode.emmet')
	args.push('--disable-extension', 'vscode.git')
	args.push('--disable-extension', 'vscode.github')
	args.push('--disable-extension', 'vscode.grunt')
	args.push('--disable-extension', 'vscode.gulp')
	args.push('--disable-extension', 'vscode.jake')
	args.push('--disable-extension', 'vscode.ipynb')
	args.push('--disable-extension', 'vscode.tunnel-forwarding')
	args.push('--sync', 'off') // '<on | off>'
	// args.push('--inspect-extensions', '<port>')
	// args.push('--inspect-brk-extensions', '<port>')
	// args.push('--logExtensionHostCommunication')

	// --- disbale functionality not needed for testing - https://github.com/microsoft/vscode/issues/174744 --- //
	// args.push('--disable-chromium-sandbox')
	// args.push('--no-sandbox', '--sandbox=false')
	args.push('--disable-crash-reporter')
	args.push('--disable-gpu-sandbox')
	args.push('--disable-gpu')
	args.push('--disable-telemetry')
	args.push('--disable-updates')
	args.push('--disable-workspace-trust')
	args.push('--disable-dev-shm-usage', '--no-xshm')
	return args
}

function getTestConfig (testDir, projName) {

	let workspaceFolder = '' + projName
	if (projName.startsWith('proj7')) {
		workspaceFolder = 'proj7_load_performance'
	} else if (projName.startsWith('workspace')) {
		workspaceFolder = projName + '.code-workspace'
	}
	workspaceFolder = path.resolve(__dirname, '..', 'test_projects', workspaceFolder)

	if (projName === 'UpdateParser') {
		workspaceFolder = path.resolve(__dirname, '..', 'test_projects', 'proj1')
	}

	if (!fs.existsSync(workspaceFolder)) {
		const g = glob.globSync('test_projects/' + projName + '_*')
		if (g.length > 1) {
			throw new Error('Multiple workspaces found: ' + workspaceFolder)
		}
		if (!g[0]) {
			throw new Error('No workspace found: ' + workspaceFolder)
		}
		workspaceFolder = g[0]
	}

	let useInstallation
	if (fs.existsSync('.vscode-test/vscode-win32-x64-archive-' + vsVersionNum + '/Code.exe')) {
		useInstallation = { fromPath: '.vscode-test/vscode-win32-x64-archive-' + vsVersionNum + '/Code.exe' }
	}

	const absolulteFile = path.resolve(__dirname, '..', 'test', testDir, projName + '.test.ts')

	const env = {
		BATS_TEST_RUNNER_UNIT_TESTING: 1,
		DONT_PROMPT_WSL_INSTALL: true,
		VSCODE_SKIP_PRELAUNCH: true,
	}

	/** @type {import('@vscode/test-cli').IDesktopTestConfiguration} */
	const testConfig = {
		//  -- IDesktopPlatform -- //
		// platform: 'desktop',
		// desktopPlatform: 'win32',
		launchArgs: getLaunchArgs(projName),
		env,
		useInstallation,
		// useInstallation: { fromMachine: true },
		// download: { reporter: ProgressReporter, timeout: ? }

		// --- IBaseTestConfiguration --- //
		files: absolulteFile,
		extensionDevelopmentPath: path.resolve(__dirname, '..'),
		extensionTestsPath: path.resolve(__dirname, '..', 'test'),
		workspaceFolder,
		mocha: getMochaOpts(projName),
		label: 'suite_' + projName,
		srcDir: './',
	}
	return testConfig
}

function getTests () {
	const tests = []
	const envProjectName = process.env['BATS_TEST_RUNNER_PROJECT_NAME'] ?? undefined

	if (envProjectName && envProjectName != '') {
		const projects = envProjectName.split(',')
		for (const p of projects) {
			tests.push(getTestConfig('suites', p))
		}
		return tests
	}

	const g = glob.globSync('test/suites/*.test.ts').reverse()
	for (const f of g) {
		const basename = path.basename(f, '.test.ts')
		tests.push(getTestConfig('suites', basename))
	}

	const p = glob.globSync('test/parse/*.test.ts')
	for (const f of p) {
		const basename = path.basename(f, '.test.ts')
		tests.push(getTestConfig('parse', basename))
	}
	return tests
}

function getCoverageOpts () {
	const coverageDir = path.resolve(__dirname, '..', 'artifacts', 'coverage')
	fs.mkdirSync(coverageDir, { recursive: true })

	/** @type {import('@vscode/test-cli').ICoverageConfiguration} */
	const coverageOpts = {
		// https://istanbul.js.org/docs/advanced/alternative-reporters/
		// * default = ['html'], but somehow also prints the 'text-summary' to the console
		// * 'lcov' includes 'html' output
		// * 'lcovonly' does not include 'html' output
		reporter: [ 'text', 'lcovonly' ],
		output: coverageDir, // https://github.com/microsoft/vscode-test-cli/issues/38
		include: [
			'**'
		],
		exclude: [
			'node_modules',
			'node_modules/**',
			'**/node_modules/**'
		],
	}
	return coverageOpts
}

export function createTestConfig () { // NOSONAR

	const testConfig = {
		tests: getTests(),
		coverage: getCoverageOpts(),
	}

	const definedConfig = defineConfig(testConfig)
	writeConfigToFile('testConfig', testConfig)
	writeConfigToFile('defined', definedConfig)
	return definedConfig
}
