#!/bin/sh

# Dependency:
# $ npm install uglify-js -g

cd "`dirname $0`"

echo Starting...

zip=/tmp/ant-realm.zip
temp_dir=`mktemp -d`
game_dir="$temp_dir/game"
mkdir $game_dir

cp game.json $temp_dir
cp index.html package.json style.css $game_dir

for js in client.js cookies.js server.js; do
  echo ">> minify $js..."
  uglifyjs $js -o $game_dir/$js
done

cd $temp_dir
rm $zip
zip -r $zip *

cd /tmp
rm -r $temp_dir

ls -l $zip
echo Done.

file-roller $zip &
