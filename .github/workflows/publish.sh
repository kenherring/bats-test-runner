#!/bin/bash
set -eou pipefail

. scripts/common.sh

main_block () {
    log_it
    PRERELEASE=false

    if ! $GITHUB_ACTION; then
        if [ -z "${GITHUB_HEAD_REF:-}" ]; then
            GITHUB_REF_TYPE=branch
            GITHUB_HEAD_REF=$(git branch --show-current)
        fi

    fi

    if [ "$GITHUB_REF_TYPE" != "tag" ]; then
        log_error "environment var GITHUB_REF_TYPE is not 'tag', cannot publish"
        exit 1
    fi

    if [ ! -f "bats-test-runner-${GITHUB_HEAD_REF}.vsix" ]; then
        log_error "bats-test-runner-${GITHUB_HEAD_REF}.vsix not found"
        exit 1
    fi

    MINOR=$(cut -d. -f2 <<< "$GITHUB_HEAD_REF")
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        log_it "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    log_it "publishing file 'bats-test-runner-${GITHUB_HEAD_REF}.vsix'"

    local ARGS=()
    ARGS+=("--githubBranch" "main")
    ARGS+=("--packagePath" "bats-test-runner-${GITHUB_HEAD_REF}.vsix")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    npx vsce publish "${ARGS[@]}"
}

upload_to_github_release () {
    log_it
    local GH_TOKEN=$GITHUB_TOKEN
    export GH_TOKEN
    sudo apt update
    sudo apt install --no-install-recommends -y gh
    gh release upload "$GITHUB_HEAD_REF" "bats-test-runner-${GITHUB_HEAD_REF}.vsix" --clobber
}

########## MAIN BLOCK ##########
main_block
upload_to_github_release
log_it 'completed successfully'
