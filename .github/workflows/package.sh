#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
    log_it
    PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")

    log_it "GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-}"
    log_it "GITHUB_HEAD_REF=${GITHUB_HEAD_REF:-}"

    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        GITHUB_REF_TYPE=branch
        GITHUB_HEAD_REF=$(git branch --show-current)
    fi

    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        GITHUB_HEAD_REF=$PACKAGE_VERSION
    fi
    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        log_error 'missing GITHUB_HEAD_REF environment var'
        exit 1
    fi

    MINOR=$(cut -d. -f2 <<< "$GITHUB_HEAD_REF")
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        log_it "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    rm -f ./*.vsix
}

package_version () {
    local VSCODE_VERSION=$1
    log_it "PACKAGE_VERSION=$VSCODE_VERSION"

    local ARGS=()
    if [ "${GITHUB_REF_TYPE:-}" = "branch" ]; then
        ARGS+=("--githubBranch" "$GITHUB_HEAD_REF")
    else
        ARGS+=("--githubBranch" "main")
        log_it "defaulting branch to 'main' for GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-} and GITHUB_HEAD_REF=${GITHUB_HEAD_REF:-}"
    fi
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    if [ "$VSCODE_VERSION" != stable ]; then
        ARGS+=(-o "bats-test-runner-${VSCODE_VERSION}-${PACKAGE_VERSION}.vsix")
    fi

    if [ "$VSCODE_VERSION" != "stable" ]; then
        mv package.json package.bkup.json
        cp "package.$VSCODE_VERSION.json" package.json
    fi
    npm install
    npx vsce package "${ARGS[@]}"
    if [ "$VSCODE_VERSION" != "stable" ]; then
        mv package.bkup.json package.json
    fi
}

run_lint () {
	log_it
	if [ -n "${BATS_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		log_it 'skipping lint for single bats test runner project test'
		return 0
	fi

	mkdir -p artifacts

	if ! npm run lint -- -f json -o "artifacts/eslint_report.json"; then
		log_error 'eslint json failed'
	fi

	jq '.' < "artifacts/eslint_report.json" > "artifacts/eslint_report_pretty.json"
	log_it 'eslint successful'
}

########## MAIN BLOCK ##########
initialize
package_version stable
run_lint
ls -al artifacts/eslint_report.json
log_it 'completed successfully'
