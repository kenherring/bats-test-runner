import { Uri } from 'vscode'

export interface ITestSummary {
	started: number
	errored: number
	failed: number
	passed: number
	skipped: number
}

export interface IBatsExport {
	getTestCount: (testUri?: Uri) => number
	resolveTests: (testUri?: Uri) => Promise<number>
	getTestSummary: () => ITestSummary | undefined
}
