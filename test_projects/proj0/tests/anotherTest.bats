#!/bin/bash

. src/another.sh
load src/someOther.sh

@test "test_1" {
    result=$(function_1)
    [ "$result" = "1" ]
}

@test "test_2 function exits 2" {
    result=$(function_2 2)
    [ "$result" = 2 ]
}


@test "test_3 addition in other file" {
    result=$(function_3)
    [ "$result" -eq 3 ]
}

@test "test_4" {
    result=$(someOtherFunction)
    [ "$result" -eq 4 ]
}
