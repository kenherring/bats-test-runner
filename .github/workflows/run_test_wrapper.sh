#!/bin/bash
set -eou pipefail

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	DONT_PROMPT_WSL_INSTALL=No_Prompt_please
	BATS_TEST_RUNNER_REPO_DIR=$(pwd)

	if [ ! -f /root/.rssw/oedoc.bin ]; then
		echo "ERROR: /root/.rssw/oedoc.bin not found"
		exit 1
	fi

	export BATS_TEST_RUNNER_REPO_DIR
	export DONT_PROMPT_WSL_INSTALL VERBOSE

	echo "BATS_TEST_RUNNER_REPO_DIR=$BATS_TEST_RUNNER_REPO_DIR"

	npm install
}

run_tests () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	EXIT_CODE=0

	local RUN_SCRIPT=test
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] starting 'npm $RUN_SCRIPT'"
	# time xvfb-run -a npm run "$RUN_SCRIPT" || EXIT_CODE=$?
	xvfb-run -a npm run "$RUN_SCRIPT" || EXIT_CODE=$?
	echo "xvfb-run end (EXIT_CODE=$EXIT_CODE)"

	mv coverage/lcov.info artifacts/coverage/lcov.info || true ## https://github.com/microsoft/vscode-test-cli/issues/38

	if [ "$EXIT_CODE" = "0" ]; then
		echo "xvfb-run success"
	else
		echo "ERROR: xvfb-run failed (EXIT_CODE=$EXIT_CODE)"
		save_and_print_debug_output
	fi
}

save_and_print_debug_output () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

	mkdir -p artifacts
	find . > artifacts/filelist.txt

	find .vscode-test -name 'settings.json'
	find .vscode-test -name 'settings.json' -exec cp {} artifacts \;
	local FROM_DIR TO_DIR
	FROM_DIR=$(find .vscode-test  -maxdepth 1 -type d -name 'vscode-*' | tail -1)
	TO_DIR=/home/circleci/.vscode-test/$(basename "$FROM_DIR")
	if [ ! -d "$TO_DIR" ] && [ -n "$FROM_DIR" ]; then
		mkdir -p /home/circleci/.vscode-test/
		cp -r "$FROM_DIR" "$TO_DIR"
	fi

	$VERBOSE || return 0
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] rcode"
	find . -name '*.r'
}

process_exit_code () {
	if [ "${EXIT_CODE:-0}" = 0 ]; then
		echo "$0 all tests completed successfully!"
		exit 0
	fi
	echo "$0 failed with exit code $EXIT_CODE"
	exit ${EXIT_CODE:-255}
}

########## MAIN BLOCK ##########
initialize "$@"
dbus_config
run_tests
scripts/sonar_test_results_merge.sh
process_exit_code
