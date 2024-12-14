#!/bin/bash
set -eou pipefail

usage () {
	echo "
usage: $0 [ -o (12.2.12 | 12.7.0 | 12.8.1 | 12.8.3 | 12.8.4 | all) ] [ -V (stable | proposedapi | insiders | X.Y.Z] )] [ -p <project_name> ] [-bBimPv]
options:
  -V <version>  VSCode version (default: stable)
                alternative: set the BATS_TEST_RUNNER_VSCODE_VERSION environment variable
  -b            drop to bash shell inside container on failure
  -B            same as -b, but only on error
  -C | -d       delete volume 'test-runner-cache' before running tests
  -i            run install and run test
  -m            copy modified files and staged files
  -n            run tests without coverage
  -P            package extension
  -p <project>  run tests for a specific test project
                alternative: set the  BATS_TEST_RUNNER_PROJECT_NAME environment variable
  -g <pattern>  test grep pattern
  -v            verbose
  -h            show this help message and exit
" >&2
}

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	OPTS=
	SCRIPT=entrypoint
	DELETE_CACHE_VOLUME=false
	TEST_PROJECT=base
	STAGED_ONLY=true
	BATS_TEST_RUNNER_PROJECT_NAME=${BATS_TEST_RUNNER_PROJECT_NAME:-${PROJECT_NAME:-}}

	while getopts "bBCdimnsxo:p:PvV:h" OPT; do
		case $OPT in
			b)	OPTS='-b' ;;
			B)  OPTS='-B' ;;
			C)	DELETE_CACHE_VOLUME=true ;;
			d)  DELETE_CACHE_VOLUME=true ;;
			i)	TEST_PROJECT=dummy-ext ;;
			m)	STAGED_ONLY=false ;;
			h)	usage && exit 0 ;;
			P)	CREATE_PACKAGE=true ;;
			p)	BATS_TEST_RUNNER_PROJECT_NAME=$OPTARG ;;
			x)	OPTS='-x'
				set -x ;;
			v)	VERBOSE=true ;;
			?)	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done
	shift $((OPTIND - 1))
	if [ -n "${1:-}" ]; then
		echo "Error: extra parameter(s) found: $*" >&2
		usage && exit 1
	fi

	if [ -z "$DLC" ]; then
		echo "ERROR: DLC environment variable is not set"
		exit 1
	fi

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	PWD=${PWD//\//\\}
	BATS_TEST_RUNNER_PROJECT_NAME=${BATS_TEST_RUNNER_PROJECT_NAME//\\/\/}
	BATS_TEST_RUNNER_PROJECT_NAME=${BATS_TEST_RUNNER_PROJECT_NAME//*\/}
	BATS_TEST_RUNNER_PROJECT_NAME=${BATS_TEST_RUNNER_PROJECT_NAME//.test.ts}

	if  [ "$BATS_TEST_RUNNER_VSCODE_VERSION" != 'stable' ] &&
		[ "$BATS_TEST_RUNNER_VSCODE_VERSION" != 'proposedapi' ] &&
		[ "$BATS_TEST_RUNNER_VSCODE_VERSION" != 'insiders' ]; then
		echo "ERROR: Invalid VSCode version: $BATS_TEST_RUNNER_VSCODE_VERSION" >&2
		usage && exit 1
	fi

	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY TEST_PROJECT CREATE_PACKAGE VERBOSE
	export BATS_TEST_RUNNER_PROJECT_NAME


	if $DELETE_CACHE_VOLUME; then
		local VOLS=()
		docker volume ls | grep -q test-runner-cache && VOLS+=(test-runner-cache)
		docker volume ls | grep -q vscode-cli-cache && VOLS+=(vscode-cli-cache)
		if [ ${#VOLS[@]} -eq 0 ]; then
			echo "no volumes to delete"
		else
			echo "deleting volume(s): ${VOLS[*]}"
			docker volume rm "${VOLS[@]}"
		fi
	fi

	## create volume for .vscode-test directory to persist vscode application downloads
	if ! docker volume ls | grep -q test-runner-cache; then
		echo "creating test-runner-cache volume"
		docker volume create --name test-runner-cache
	fi
	if ! docker volume ls | grep -q vscode-cli-cache; then
		echo "creating vscode-cli-cache"
		docker volume create --name vscode-cli-cache
	fi

	mkdir -p docker/artifacts
}

run_tests_in_docker () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"

	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] docker run"
	export BATS_TEST_RUNNER_PROJECT_PROJECT_NAME
	local ARGS=(
		--cpus=4 ## large resource class in CircleCI
		--memory=4g ## large resource class in CircleCI
		--gpus=0
		--rm
		-it
		-e PROGRESS_CFG_BASE64
		-e GIT_BRANCH
		-e STAGED_ONLY
		-e TEST_PROJECT
		-e CREATE_PACKAGE
		-e VERBOSE
		-e SET_X
		-v "${PWD}/artifacts":/home/circleci/project/artifacts
		-v "${PWD}/coverage":/home/circleci/project/coverage
	)
	[ -n "${BATS_TEST_RUNNER_PROJECT_NAME:-}" ] && ARGS+=(-e BATS_TEST_RUNNER_PROJECT_NAME)
	ARGS+=(
		-v "${PWD}":/home/circleci/bats-test-runner:ro
		-v vscode-cli-cache:/home/circleci/project/.vscode-test
		bash -c "/home/circleci/bats-test-runner/docker/$SCRIPT.sh $OPTS;"
	)
	## run tests inside the container
	docker run "${ARGS[@]}"
	echo "tests completed successfully with"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully! (script=docker/$SCRIPT.sh)"
