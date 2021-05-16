#!/bin/bash
export BASE_PATH=`realpath "$(dirname $0)/.."`
. "${BASE_PATH}/helpers/colors.sh"

copy_env() {
    sample_file=$0
    path=`dirname $sample_file`
    relative_path=`echo "${path}/" | sed -E "s|${BASE_PATH}/||"`
    sample_filename=`basename $sample_file`
    filename=`echo $sample_filename | sed -E "s/sample.//"`
    file="${path}/${filename}"

    if [ -f "${path}/${filename}" ]
    then
        neutral "${relative_path}${filename} existe"
    else
        cp -n "${path}/${sample_filename}" "${path}/${filename}"
        check "${relative_path}${filename} créé"
    fi
}
export -f copy_env
find ${BASE_PATH} -type f -name "*.sample.env" -exec /bin/bash -c 'copy_env "$0"' {} \;
