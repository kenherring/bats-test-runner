export interface ITestSummary {
	started: number
	errored: number
	failed: number
	passed: number
	skipped: number
}

export interface IBatsExport {
	getTestCount: () => number
	resolveTests: () => Promise<number>
	getTestSummary: () => ITestSummary | undefined
}
