#!/bin/bash
set -eou pipefail

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	PATH=$PATH:$DLC/ant/bin
	CIRCLECI=${CIRCLECI:-false}
	NO_BUILD=${NO_BUILD:-false}
	VERBOSE=${VERBOSE:-false}
	WSL=false
	VERBOSE=${VERBOSE:-false}
	[ -z "${WSL_DISTRO_NAME:-}" ] && WSL=true
	PACKAGE_VERSION=$(node -p "require('./package.json').version")

	while getopts 'hNoVv' OPT; do
		case "$OPT" in
			N)	NO_BUILD=true ;;
			v)	VERBOSE=true ;;
			?)	echo "script usage: $(basename "$0") [-h] [-N]" >&2
				exit 1 ;;
		esac
	done

	if [ -z "$DLC" ]; then
		echo "ERROR: DLC environment variable is not set"
		exit 1
	fi

	if [ -d artifacts ]; then
		rm -rf artifacts/*
	fi

	if [ ! -d node_modules ]; then
		npm install
	fi
}

# load lots of code for a performance test
get_performance_test_code () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"

	if [ "${OS:-}" = "Windows_NT" ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
		mkdir -p .vscode-test
	fi
	if [ ! -f "$TO_FILE" ]; then
		if [ -n "${DOCKER_IMAGE:-}" ]; then
			echo "ERROR: cannot find file '$TO_FILE'"
			echo " - HINT: this should have been fetched during docker build"
		fi
	fi
	tar -xf "$TO_FILE" -C test_projects/proj7_load_performance/src
}

copy_user_settings () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

	if [ -d .vscode-test ]; then
		$VERBOSE && find .vscode-test -type f -name "*.log"
		find .vscode-test -type f -name "*.log" -delete
		if [ -d .vscode-test/user-data ]; then
			$VERBOSE && find .vscode-test/user-data
			find .vscode-test/user-data -delete
		fi
	fi

	mkdir -p .vscode-test/user-data/User
	cp test/resources/.vscode-test/user-data/User/argv.json .vscode-test/user-data/User/argv.json
}

get_pct () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if $WSL && [ ! -f ~/.ant/lib/PCT.jar ]; then
		mkdir -p ~/.ant/lib
		local ARGS=()
		ARGS+=(-L -o ~/.ant/lib/PCT.jar)
		if $VERBOSE; then
			ARGS+=(-v)
		else
			ARGS+=(-s)
		fi
		curl "${ARGS[@]}" https://github.com/Riverside-Software/pct/releases/download/v228/PCT.jar
	fi
}

create_dbs () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if [ -d test_projects/proj0/target/db ]; then
		return 0
	fi

	local COMMAND=ant
	cd test_projects/proj0
	COMMAND=ant
	if ! command -v $COMMAND; then
		COMMAND="$DLC/ant/bin/ant"
	fi
	mkdir -p artifacts
	$COMMAND > artifacts/pretest_ant.log >&1
	cd -
}

package () {
	if $NO_BUILD; then
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] skipping package (NO_BUILD=$NO_BUILD)"
		return 0
	fi
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"

	local PACKAGE_OUT_OF_DATE=false
	local VSIX_COUNT=0
	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	echo "VSIX_COUNT=$VSIX_COUNT"

	if [ -f "bats-test-runner-$PACKAGE_VERSION.vsix" ]; then
		NEWEST_SOURCE=$(find src -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_TEST=$(find test -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_ROOT=$(find . -maxdepth 1 -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

		if $VERBOSE; then
			echo "recent source files:"
			ls -altr "$NEWEST_SOURCE" "$NEWEST_SOURCE_TEST" "$NEWEST_SOURCE_ROOT" "bats-test-runner-$PACKAGE_VERSION.vsix"
		fi

		[ "$NEWEST_SOURCE_TEST" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_TEST
		[ "$NEWEST_SOURCE_ROOT" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_ROOT

		if  [ "$NEWEST_SOURCE" -nt "bats-test-runner-$PACKAGE_VERSION.vsix" ]; then
			echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] newer source file found: $NEWEST_SOURCE"
			PACKAGE_OUT_OF_DATE=true
		fi
	else
		PACKAGE_OUT_OF_DATE=true
	fi
	echo "CIRCLECI=$CIRCLECI PACKAGE_OUT_OF_DATE=$PACKAGE_OUT_OF_DATE VSIX_COUNT=$VSIX_COUNT"
	if $PACKAGE_OUT_OF_DATE || $CIRCLECI || [ "$VSIX_COUNT" = "0" ]; then
		.circleci/package.sh
	fi

	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	if [ "$VSIX_COUNT" = "0" ]; then
		echo "ERROR: no .vsix files found"
		exit 1
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
copy_user_settings
get_performance_test_code
get_pct
create_dbs
package
rm -rf artifacts/*
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully!"
