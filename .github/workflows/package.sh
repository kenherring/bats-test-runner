#!/bin/bash
set -eou pipefail

initialize () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi

    if [ -z "${CIRCLE_TAG:-}" ]; then
        CIRCLE_TAG=$PACKAGE_VERSION
    fi
    if [ -z "${CIRCLE_TAG:-}" ]; then
        echo "ERROR: missing CIRCLE_TAG environment var"
        exit 1
    fi

    MINOR=$(echo "$CIRCLE_TAG" | cut -d. -f2)
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        echo "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    rm -f ./*.vsix
}

package_version () {
    local VSCODE_VERSION=$1
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] PACKAGE_VERSION=$VSCODE_VERSION"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
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
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	if [ -n "${BATS_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] skipping lint for single bats test runner project test"
		return 0
	fi

	mkdir -p artifacts

	if ! npm run lint -- -f json -o "artifacts/eslint_report.json"; then
		echo "eslint json failed"
	fi

	jq '.' < "artifacts/eslint_report.json" > "artifacts/eslint_report_pretty.json"
	echo 'eslint successful'
}

########## MAIN BLOCK ##########
initialize
package_version stable
run_lint
ls -al artifacts/eslint_report.json
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully"
