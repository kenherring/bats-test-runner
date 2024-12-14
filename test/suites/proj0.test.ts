import { log } from 'ChannelLogger'

suite('proj0  - Extension Test Suite', () => {

	suiteSetup('proj0 - before', () => {
		log.info('suiteSetup')
	})

	teardown('proj0 - afterEach', () => {
		log.info('teardown')
	})

	test('proj0.1 - TBD', () => {
		log.info('proj0.1')
	})

})
