export interface IBatsExport {
	getTestCount: () => number
	resolveTests: () => Promise<number>
}
