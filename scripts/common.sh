#!/bin/bash
set -eou pipefail

log_it () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[1]}]" "$@"
}

log_error () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[1]}] ERROR:" "$@" >&2
}

jq () {
	if command -v jq >/dev/null 2>&1; then
		command jq "$@"
	elif command -v jq.exe >/dev/null 2>&1; then
		jq.exe "$@"
	elif command -v jq-windows-amd64.exe >/dev/null 2>&1; then
		jq-windows-amd64.exe "$@"
	else
		log_error "jq not found" >&2
	fi
}

validate_version_updated() {
	log_it 'validating version matches throughout the project...' >&2
	local PACKAGE_VERSION SONAR_PROJECT_VERSION CHANGELOG_VERSION
	PACKAGE_VERSION=$(jq -r '.version' package.json)
	PACKAGE_LOCK_VERSION=$(jq -r '.version' package-lock.json)
	SONAR_PROJECT_VERSION=$(grep -E '^sonar.projectVersion=' sonar-project.properties | cut -d'=' -f2)

	if [ "$PACKAGE_VERSION" != "$PACKAGE_LOCK_VERSION" ]; then
		log_error "package.json version ($PACKAGE_VERSION) does not match package-lock.json version ($PACKAGE_LOCK_VERSION)"
		exit 1
	fi

	if [ "$PACKAGE_VERSION" != "$SONAR_PROJECT_VERSION" ]; then
		log_error "package.json version ($PACKAGE_VERSION) does not match 'sonar.projectVersion' ($SONAR_PROJECT_VERSION) in 'sonar-project.properties'"
		exit 1
	fi

	CHANGELOG_VERSION=$(head CHANGELOG.md -n 1 | cut -d'[' -f2 | cut -d']' -f1)
	if [ "$PACKAGE_VERSION" != "$CHANGELOG_VERSION" ]; then
		log_error "package.json version ($PACKAGE_VERSION) does not match most recent entry in ($CHANGELOG_VERSION) in 'CHANGELOG.md'"
		exit 1
	fi
}
