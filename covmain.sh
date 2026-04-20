#!/bin/bash
set -eou pipefail
# set -x

# PS4='+ [${BASH_SOURCE[0]}:$LINENO:${COMP_LINE:-} ${FUNCNAME[0]:-}] '

function exec_main() {
    # This function is a placeholder for the main execution logic.
    # Replace this with the actual commands you want to run.
    var="Executing main logic..."
    echo "cat=$(cat <<< "$var")"

    echo "cov_source1.sh -- start"
    ./cov_source_1.sh
    ./cov_source_1.sh
    echo "cov_source1.sh -- end"
}

########## MAIN BLOCK ##########
echo '100'
exec_main
echo '199'
