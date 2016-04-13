const assert = require('assert');
const exec = require('child_process');

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

function ldap_search(url, login, password, base, scope)
{

}

function test_client(client, login, pass, base, scope)
{
  client.bind(login, pass, function (err)
  {
    assert.ifError(err);

    var options = { scope: scope }

    client.search(base, options, function (err, res) {
      assert.ifError(err);

      res.on('searchEntry', function(entry) {
        console.log('entry: ' + JSON.stringify(entry.object));
      });

      res.on('searchReference', function(referral) {
        console.log('referral: ' + referral.uris.join());
      });

      res.on('error', function(err) {
        console.error('error: ' + err.message);
      });

      res.on('end', function(result) {
        console.log('status: ' + result.status + '\n');
        client.unbind();
      });
    });
  });
}

var client_first = ldap.createClient({
  url: 'ldap://ldap.forumsys.com'
});

var client_second = ldap.createClient({
  url: 'ldap://www.zflexldap.com'
});

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
  req.users = {};

  req.users[0] = {
    dn: 'cn=grzegorz.kowalski,o=users,dc=grzegorzkowalski,dc=pl',
    attributes: {
      cn: 'cn=grzegorz.kowalski',
      uid: '1',
      objectClass: 'person'
    }
  }

  Object.keys(req.users).forEach(function(k) {
    if (req.filter.matches(req.users[k].attributes))
      res.send(req.users[k]);
  });

  res.end();
  return next();
});
