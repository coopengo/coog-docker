#!/bin/bash
export RESET="\e[0m"
export GREY="\e[2;37m"
export GREEN="\e[1;32m"
export RED="\e[1;31m"

color() {
    text=$1
    color=$2
    suffix=$3
    echo -e "${color}${text}${RESET}$suffix"
}

light() {
    color "$1" "$GREY" "$2"
}

write() {
    echo -e "$1 \c"
}

neutral() {
    write "-"
    light "$1" "$2"
}

check() {
    write "${GREEN}✓${RESET}"
    light "$1" "$2"
}

fail() {
    write "${RED}✗${RESET}"
    light "$1" "$2"
}

export -f color
export -f light
export -f write
export -f neutral
export -f check
export -f fail
