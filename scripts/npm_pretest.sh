#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
	log_it "pwd=$(pwd)"

	GITHUB_ACTION=${GITHUB_ACTION:-false}
	NO_BUILD=${NO_BUILD:-false}
	VERBOSE=${VERBOSE:-false}
	VERBOSE=${VERBOSE:-false}
	PACKAGE_VERSION=$(node -p "require('./package.json').version")

	GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-}
	GITHUB_REF_NAME=${GITHUB_REF_NAME:-}
	GITHUB_HEAD_REF=${GITHUB_HEAD_REF:-}

	while getopts 'hNoVv' OPT; do
		case "$OPT" in
			N)	NO_BUILD=true ;;
			v)	VERBOSE=true ;;
			?)	echo "usage: $(basename "$0") [-h] [-N]" >&2
				exit 1 ;;
		esac
	done

	if [ -d artifacts ]; then
		rm -rf artifacts/*
	fi

	if [ ! -d node_modules ]; then
		npm install
	fi
}

# load lots of code for a performance test
get_performance_test_code () {
	log_it "pwd=$(pwd)"

	if [ "${OS:-}" = "Windows_NT" ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
		mkdir -p .vscode-test
	fi
	if [ ! -f "$TO_FILE" ]; then
		if [ -n "${DOCKER_IMAGE:-}" ]; then
			log_error "cannot find file '$TO_FILE'\n" \
				" - HINT: this should have been fetched during docker build"
		fi
	fi
	tar -xf "$TO_FILE" -C test_projects/proj7_load_performance/src
}

package () {
	if $NO_BUILD; then
		log_it "skipping package (NO_BUILD=$NO_BUILD)"
		return 0
	fi
	log_it "pwd=$(pwd)"

	local VSIX_COUNT=0
	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	log_it "VSIX_COUNT=$VSIX_COUNT"

	.github/workflows/package.sh

	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	if [ "$VSIX_COUNT" = "0" ]; then
		log_error "no .vsix files found"
		exit 1
	fi
}

########## MAIN BLOCK ##########
START_TIME=$(date +%s)
initialize "$@"
package
rm -rf artifacts/*
END_TIME=$(date +%s)
log_it "completed successfully! (time=$((END_TIME - START_TIME))s)"
