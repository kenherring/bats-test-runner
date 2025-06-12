#!/bin/bash
set -eou pipefail

if [ ! -f ./scripts/common.sh ]; then
    echo "Error: common.sh not found in scripts directory."
    exit 1
fi

. ./scripts/common.sh

initialize () {
    log_it
    PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")

    log_it "GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-}"
    log_it "GITHUB_HEAD_REF=${GITHUB_HEAD_REF:-}"

    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        GITHUB_REF_TYPE=branch
        GITHUB_HEAD_REF=$(git branch --show-current)
        log_it "defaulting GITHUB_HEAD_REF to current branch: $GITHUB_HEAD_REF"
    fi

    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        GITHUB_HEAD_REF=$PACKAGE_VERSION
    fi
    if [ -z "${GITHUB_HEAD_REF:-}" ]; then
        log_error 'missing GITHUB_HEAD_REF environment var'
        exit 1
    fi

    if [ "$GITHUB_REF_TYPE" == "tag" ]; then
        MINOR=$(cut -d. -f2 <<< "$GITHUB_HEAD_REF")
        echo "MINOR=$MINOR"
        if [ "$(( MINOR % 2 ))" = "1" ]; then
            log_it "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
            PRERELEASE=true
        fi
    elif [ "$GITHUB_REF_TYPE" == "branch" ]; then
        log_it 'branch detected. packaging as pre-release'
        PRERELEASE=true
    else
        log_error "unknown GITHUB_REF_TYPE: $GITHUB_REF_TYPE"
        exit 1
    fi


    if find . -name "*.vsix" -type f; then
        log_it 'removing existing vsix files'
        rm -f ./*.vsix
    fi

}

package_version () {
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

    npm install
    npx vsce package "${ARGS[@]}"
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
