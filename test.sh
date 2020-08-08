val=$(docker ps | head -1)

if [ "x$?" = "x0" ]; then
  node pouet.js ok
else
  node pouet.js "$val"
fi
