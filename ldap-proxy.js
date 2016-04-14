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
    '-w', proxy.password,
    '-H', proxy.url,
    '-D', proxy.login,
    '-b', proxy.base,
    '-s', proxy.scope,
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

function ldap_bind(url, login, password)
{
  var args =
  [
    '-w', password,
    '-H', url,
    '-D', login,
    '-b', login,
    '-s', 'base',
    '-LLL',
    '1.1'
  ];

  console.log('bind as ' + login);

  try {
    var output = execFileSync('ldapsearch', args, { encoding: 'utf-8'});
  }
  catch (err) {
    return false;
  }
  return (output.substring(0,3) === 'dn:');
}

server.listen(1389, '127.0.0.1', function() {
  console.log('LDAP server listening at ' + server.url + ' for 10 seconds');

  setTimeout(function () {
    console.log('LDAP server shutdown after timeout started.');
    server.close();
    console.log('LDAP server shutdown after timeout done.');
  }, 10000);
});

server.bind('dc=ldap,dc=grzegorzkowalski,dc=pl', function(req, res, next) {
  console.log('bind login DN: ' + req.dn.toString());
  console.log('bind password: ' + req.credentials);

  if (req.credentials !== 'secret') {
    return next(new ldap.InvalidCredentialsError());
  }

  res.end();
  return next();
});

server.bind('o=users,dc=grzegorzkowalski,dc=pl', function(req, res, next) {
  console.log('bind login DN: ' + req.dn.toString());
  console.log('bind password: ' + req.credentials);

  var result = proxy_config.some(function (proxy) {
    if (proxy.mount === 'o=users,dc=grzegorzkowalski,dc=pl') {
      var result = ldap_bind(
        proxy.url,
        req.dn.toString().replace(ldap.parseDN('o=users,dc=grzegorzkowalski,dc=pl').toString(), proxy.base).replace(' ', ''),
        req.credentials
      );
      if (result === true) {
        return true;
      }
    }
    return false
  });

  if (result === true) {
    res.end();
    return next();
  }

  return next(new ldap.InvalidCredentialsError());
});


server.search('o=users,dc=grzegorzkowalski,dc=pl', function(req, res, next) {

  if (req.connection.ldap.bindDN.equals('cn=anonymous')) {
    return next(new ldap.InsufficientAccessRightsError());
  }

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
