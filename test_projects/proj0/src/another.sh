#!/bin/bash

function_1 () {
    echo "1"
}

function_2 () {
    local INPUT=$1
    exit $INPUT
}

function_3 () {
    local PARAM1=$1
    local PARAM2=$1
    echo $(($PARAM1 + $PARAM2))
}
