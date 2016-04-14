#!/bin/sh
echo ldap-proxy server self test
ldapsearch -w password -h 127.0.0.1 -p 1389 -x -D "uid=tesla,o=users,dc=grzegorzkowalski,dc=pl" -b "uid=tesla,o=users,dc=grzegorzkowalski,dc=pl" -s base
