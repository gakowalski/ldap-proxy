const assert = require('assert');
const execFileSync = require('child_process').execFileSync;

var ldap = require('ldapjs');
var server = ldap.createServer();

var proxy_config =
[
  {
    mount: 'o=users,dc=grzegorzkowalski,dc=pl',
    url: 'ldap://ldap.forumsys.com',
    login: 'uid=tesla,dc=example,dc=com',
    password: 'password',
    base: 'dc=example,dc=com',
    scope: 'sub',
  },
  {
    mount: 'o=users,dc=grzegorzkowalski,dc=pl',
    url: 'ldap://www.zflexldap.com',
    login: 'cn=ro_admin,ou=sysadmins,dc=zflexsoftware,dc=com',
    password: 'zflexpass',
    base: 'ou=sysadmins,dc=zflexsoftware,dc=com',
    scope: 'sub',
  }
];

function ldap_search(proxy)
{
  var args =
  [
    '-w' + proxy.password,
    '-H' + proxy.url,
    '-D' + proxy.login,
    '-b' + proxy.base,
    '-s' + proxy.scope,
    '-LLL'
  ];

  var output = execFileSync('ldapsearch', args, { encoding: 'utf-8'});

  // text processing
  var entries = output.split('\n\n');
  entries.forEach(function (entry, index) {
    entries[index] = entry.split('\n');
    entries[index].forEach(function (attribute, index2) {
      entries[index][index2] = attribute.split(':\ ');
    });
  });

  // object structuring
  var results = new Array();
  entries.forEach(function (entry, index) {
    var obj = {};

    obj.dn = entry[0][1];
    obj.attributes = {};

    entry.forEach(function (attribute, index) {
      if (entry[index][0] !== 'dn') {
        obj.attributes[entry[index][0]] = entry[index][1];
      }
    });

    results.push(obj);
  });
  return results;
}

server.listen(1389, '127.0.0.1', function() {
  console.log('LDAP server listening at ' + server.url + ' for 5 seconds');

  setTimeout(function () {
    console.log('LDAP server shutdown after timeout started.');
    server.close();
    console.log('LDAP server shutdown after timeout done.');
  }, 5000);
});

server.bind('cn=anonymous', function(req, res, next) {
  console.log('bind login DN: ' + req.dn.toString());
  console.log('bind password: ' + req.credentials);
  res.end();
  return next();
});

server.bind('cn=halt', function(req, res, next) {
  server.close();
});

server.search('o=users,dc=grzegorzkowalski,dc=pl', function(req, res, next) {
  proxy_config.forEach(function (proxy) {
    if (proxy.mount === 'o=users,dc=grzegorzkowalski,dc=pl') {
      var entries = ldap_search(proxy);

      Object.keys(entries).forEach(function(k) {
        if (req.filter.matches(entries[k].attributes))
          res.send(entries[k]);
      });
    }
  });

  res.end();
  return next();
});
