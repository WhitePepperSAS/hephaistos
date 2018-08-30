# python3 profile
quiet
noroot
nogroups

include /etc/firejail/default.profile

tracelog
net none
shell none

private-bin python3
private-dev
nosound
no3d
private-etc passwd,group,localtime
hostname python3
blacklist /tmp/.X11-unix
blacklist /app
noblacklist /usr/lib/python3.5
blacklist ~/.npm
