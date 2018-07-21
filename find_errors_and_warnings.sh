#!/bin/bash

mkdir -p bin reports

ls -1 | while read line; do
  file=$(ls -1 "$line")
  if [ "$line" == "bin" ] || [ "$line" == "reports" ]; then
    continue
  fi
  if [[ $file =~ ^.*\.(c|C)$ ]]; then
    if [ -f "$line/$file" ]; then
      gcc -Wall -o "bin/$line.bin" "$line/$file" > "reports/$line.report" 2>&1
      echo -ne "$line\t"
      warncount=$(grep warning "reports/$line.report" | wc -l)
      errcount=$(grep error "reports/$line.report" | wc -l)
      linecount=$(cat "$line/$file" | wc -l)
      pbms=$(cppcheck --enable=all --xml "$line/$file" 2>&1 | grep error | \
        sed 's/file="[^"]*"//' | \
        sed 's/&nbsp;/ /g; s/&amp;/\&/g; s/&lt;/\</g; s/&gt;/\>/g; s/&quot;/\"/g; s/#&#39;/\'"'"'/g; s/&ldquo;/\"/g; s/&rdquo;/\"/g;' | \
        sed 's/<error //' | \
        sed 's/\/>//')
      style=$(cat "$line/$file" | vera++ -p louis -c- - | grep error | \
        sed -r 's/        <error source="([A-Z][0-9]{3})" severity="([a-z]+)" line="([0-9]+)" message="([^"]+)" \/>/\1 (\2): L\3 > \4/g')
      stylecount=$(echo "$style" | wc -l)
      
      cnt=0

      IFS='' 
      filecontent=$(cat "$line/$file" | while read fline; do
        cnt=$((cnt+1))
        err=$(echo "$pbms" | grep "line=\"$cnt\"")
        if [ ! -z "$err" ]; then
          echo "$err" | while read error; do
            # spaces=$(echo "$fline" | sed 's/\([ ]*\)[^ ].*/\1/')
            echo "// $error" | sed 's/\/\/      /\/\/ /'
          done
        fi
        # sty=$(echo "$style" | grep "L$cnt >")
        # if [ ! -z "$sty" ]; then
        #   echo "$sty" | while read st; do
        #     echo "// $st"
        #   done
        # fi

        echo
        printf "%03i: %s" "$cnt" "$fline"
      done)

      filecontent=$(echo "$filecontent" | sed ':a;N;$!ba;s/[\r\n]\+/,__/g' | tr '\t' ' ')
      pbms=$(echo  -ne "$pbms" | tr '\n' ',__' | tr '\r' ',__' | tr '\t' ' ')
      style=$(echo  -ne "$style" | sed ':a;N;$!ba;s/[\r\n]\+/,__/g' | tr '\t' ' ')

      echo -e "$warncount\t$errcount\t$linecount\t$stylecount\t$pbms\t$filecontent\t$style"
    fi
  else
    echo -e "$line\t0\t0\t0\t0\t_\tfilename=$file"
  fi
done
