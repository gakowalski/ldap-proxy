#!/bin/sh
# http://www.forumsys.com/en/tutorials/integration-how-to/ldap/online-ldap-test-server/
echo ldap-proxy server self test
ldapsearch -W -h 127.0.0.1 -p 1389 -x -D "cn=anonymous" -b "o=users,dc=grzegorzkowalski,dc=pl"
