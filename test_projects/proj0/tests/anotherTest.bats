#!/bin/bash

. src/anotherFile.sh

@test "test_1" {
    result=$(function_1)
    [ "$RESULT" = "1" ]
}

@test "test_2 function exits 2" {
    result=$(function_2 2)
    [ "$RESULT" = 0 ]
}


@test "test_3 addition in other file" {
    result=$(function_3)
    [ "$result" -eq 3 ]
}

# @test "test_4 addition in other file fail" {
#     result=$(function_4)
#     [ "$result -eq 4 ]
# }