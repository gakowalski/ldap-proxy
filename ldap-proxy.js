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
    filter: '(objectClass=*)',
    //attributes: ['objectClass'],
    attributes: [],
  },
  {
    mount: 'o=users,dc=grzegorzkowalski,dc=pl',
    url: 'ldap://www.zflexldap.com',
    login: 'cn=ro_admin,ou=sysadmins,dc=zflexsoftware,dc=com',
    password: 'zflexpass',
    base: 'ou=sysadmins,dc=zflexsoftware,dc=com',
    scope: 'sub',
    filter: '(objectClass=*)',
    //attributes: ['objectClass'],
    attributes: [],
  }
];

function ldap_search(proxy, base)
{
  var args =
  [
    '-w', proxy.password,
    '-H', proxy.url,
    '-D', proxy.login,
    '-b', base,
    '-s', proxy.scope,
    '-S', 'dn',
    '-LLL',
    proxy.filter,
  ];

  args = args.concat(proxy.attributes);
  console.log(args.toString());

  try {
    var output = execFileSync('ldapsearch', args, { encoding: 'utf-8'});
  }
  catch (err) {
    return new Array(); // empty resultset
  }

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

    if (typeof obj.dn == 'undefined') {
      return;
    }

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
  console.log('base object: ' + req.dn.toString());
  console.log('scope: ' + req.scope);
  console.log('filter: ' + req.filter.toString());
  console.log('attributes: ' + req.attributes);
  console.log('size limit: ' + req.sizeLimit);
  console.log('time limit: ' + req.timeLimit);

  if (req.connection.ldap.bindDN.equals('cn=anonymous')) {
    return next(new ldap.InsufficientAccessRightsError());
  }

  proxy_config.forEach(function (proxy) {
    if (proxy.mount === 'o=users,dc=grzegorzkowalski,dc=pl') {
      var entries = ldap_search(
        proxy,
        req.dn.toString().replace(ldap.parseDN('o=users,dc=grzegorzkowalski,dc=pl').toString(), proxy.base).replace(' ', '')
      );

      console.log('..entries: ' + entries.length);

      Object.keys(entries).forEach(function(k) {
        if (req.filter.matches(entries[k].attributes)) {
          entries[k].dn = entries[k].dn.replace(proxy.base, 'o=users,dc=grzegorzkowalski,dc=pl');
          res.send(entries[k]);
        }
      });
    }
  });

  res.end();
  return next();
});
