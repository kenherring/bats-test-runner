#!/usr/bin/env bats

@test "addition using bc" {
  result="$(echo 2+2 | bc)"
  [ "$result" -eq 4 ]
}

@test "simple passing test" {
  result="123"
  [ "$result" = "123" ]
}

@test "addition using dc" {
  result="$(echo 2 2+p | dc)"
  [ "$result" -eq 4 ]
}


@test "simple passing test 2" {
  result="123"
  [ "$result" = "123" ]
}

@test "addition using dc fail" {
  result="$(echo 3 3+p | dc)"
  [ "$result" -eq 4 ]
}

@test "one line" { result="$(echo 2+2 | bc)"; [ "$result" -eq 4 ]; }
