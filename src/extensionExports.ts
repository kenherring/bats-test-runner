import { TestItem } from 'vscode'

export interface IBatsExport {
	getTestCount: () => number
	resolveTests: () => void | Thenable<void>
}
