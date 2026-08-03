#!/bin/bash
set -eou pipefail

## global variables
COVERAGE=()
COVERAGE_KEYS=()
COVERAGE_KEY=''

function get_coverage_key() {
    local SOURCE_NAME=$1
    local INDEX=0

    while [ $INDEX -lt ${#COVERAGE_KEYS[@]} ]; do
        # echo "--+ INDEX=$INDEX KEY_VALUE=${COVERAGE_KEYS[$INDEX]}" >&2
        if [ "$SOURCE_NAME" = "${COVERAGE_KEYS[$INDEX]}" ]; then
            # echo "-- INDEX=$INDEX (found)" >&2
            COVERAGE_KEY="$INDEX"
            return
        fi
        INDEX=$((INDEX + 1))
    done

    COVERAGE_KEYS+=("$SOURCE_NAME")
    COVERAGE_KEY="$INDEX"
    return
}

function process_trace_lines () {
    local LINE

    while IFS= read -r LINE; do
        if [ "$LINE" = "+ COVERAGE FINISHED +" ]; then
            write_coverage_summary
            echo "done writing coverage summary" >&2
            return
        fi

        if [[ ! "$LINE" =~ ^\++\ \[(.*):([0-9]+):([0-9]*):(.*)\]\  ]]; then
            echo "$LINE" >&2
            continue
        fi
        # echo "$LINE" >&2

        # ## trace line values
        T_SOURCE_NAME=${BASH_REMATCH[1]}
        T_LINENO=${BASH_REMATCH[2]}
        # T_LINE=${BASH_REMATCH[3]}
        # T_FUNCNAME=${BASH_REMATCH[4]}
        # echo "-+ --> trace line values"
        # echo "-+    source=$T_SOURCE_NAME"
        # echo "-+    lineno=$T_LINENO"
        # echo "-+      line=$T_LINE"
        # echo "-+  funcname=$T_FUNCNAME"

        ## get current line execution counts
        get_coverage_key "$T_SOURCE_NAME:$T_LINENO" ## assigns COVERAGE_KEY
        # echo "-+ COVERAGE_KEY=$COVERAGE_KEY"
        # echo "-+ --> COVERAGE_KEYS=(${COVERAGE_KEYS[*]})"
        COVERAGE_VALUE=${COVERAGE[COVERAGE_KEY]:-0}
        # echo "-+ --> COVERAGE_VALUE=$COVERAGE_VALUE"
        COVERAGE_VALUE=$((COVERAGE_VALUE+1))
        # echo "-+ --> COVERAGE_VALUE=$COVERAGE_VALUE"

        ## set new line execution counts
        COVERAGE[COVERAGE_KEY]=$COVERAGE_VALUE
        # echo "-+ --> COVERAGE[$COVERAGE_KEY]=${COVERAGE[$COVERAGE_KEY]}"
        # echo "-+     COVERAGE=(${COVERAGE[*]})"
    done
}


write_coverage_summary () {
    echo "write_coverage_summary COVERAGE.length=${#COVERAGE[@]}"

    local INDEX=0
    while [ $INDEX -lt ${#COVERAGE[@]} ]; do
        echo "${COVERAGE_KEYS[$INDEX]} ${COVERAGE[$INDEX]}"
        INDEX=$((INDEX + 1))
    done
}

run_subprocess () {
    echo "COMMAND: $*"
    PS4='+ [${BASH_SOURCE[0]}:$LINENO:${COMP_LINE:-}:${FUNCNAME[0]:-}] '
    export PS4 SHELLOPTS
    set -x
    "$@"
    echo "+ COVERAGE FINISHED +" >&2
}


function test_func () {
    process_trace_line "$0"
    ## assert coverage.length=0
    process_trace_line "+ [./someFile.sh:123:456:someFunc] some line"
    ## assert coverage.length=1
    process_trace_line "+ [./someFile.sh:123:456:someFunc] some line"
    ## assert coverage.length=2
    process_trace_line "+ [./someFile.sh:122:456:someFunc] some line"
    ## assert coverage.length=1
    process_trace_line "+ [./someFile.sh:123:456:someFunc] some line"
    ## assert coverage.length=3
    process_trace_line "+ [./otherFile.sh:123:456:someFunc] some line"
    ## assert coverage.length=1
}

########## TEST BLOCK ##########
# test_func
# exit '0'

########## MAIN BLOCK ##########
exec 3>&1
run_subprocess "$@" 2>&1 1>&3 | process_trace_lines
echo "------ COVERAGE.length=${#COVERAGE[@]}"
echo 999 "DONE"
