#!/bin/sh
generate () {
    set -o allexport
    . $PWD/${1:-env.test}
    . $PWD/env.base
    for i in $( \
            (cat env.base && cat env.custom) | \
            grep -v "^#" | grep -v "^$" | sort -u | \
            sed -e "s/^\([A-Z0-9_]*\)=.*/\1/"); do
        echo "$i="$(env | grep "^$i=" | sed -e "s/^[A-Z0-9_]*=\(.*\)/\1/")
    done
}

echo "# AUTO GENERATED, DO NOT MODIFY MANUALLY" > $PWD/.env
(generate $*) >> $PWD/.env
