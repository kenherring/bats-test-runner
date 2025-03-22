#!/bin/bash

someOtherFunction () {
    echo "BEFORE" >&2
    result="$(echo 3 3+p | dc)"
    echo "AFTER" >&2
}
