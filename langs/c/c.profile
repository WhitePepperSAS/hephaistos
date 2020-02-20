# c profile
quiet
noroot
nogroups

include /etc/firejail/default.profile

tracelog
net none
shell none

private-bin none
private-dev
nosound
no3d
private-etc passwd,group,localtime
hostname c
blacklist /tmp/.X11-unix
blacklist /app
blacklist ~/.npm
