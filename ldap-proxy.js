const assert = require('assert');

var ldap = require('ldapjs');
var server = ldap.createServer();

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
        //process.exit();
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

function test_prime(prime) {
  var complex = 1;
  complex *= 2; // client_first
  complex *= 3; // client_second
  complex *= 5; // server timeout
  console.log('Prime test succeded: ' + prime);
  return complex % prime == 0;
}

if (test_prime(2)) test_client(
  client_first,
  'uid=tesla,dc=example,dc=com',
  'password',
  'dc=example,dc=com',
  'sub'
);

if (test_prime(3)) test_client(
  client_second,
  'cn=ro_admin,ou=sysadmins,dc=zflexsoftware,dc=com',
  'zflexpass',
  'ou=sysadmins,dc=zflexsoftware,dc=com',
  'sub'
);

server.listen(1389, '127.0.0.1', function() {
  console.log('LDAP server listening at: ' + server.url);

  if (test_prime(5))
  {
    setTimeout(function () {
      console.log('LDAP server shutdown after timeout started.');
      server.close();
      console.log('LDAP server shutdown after timeout done.');
    }, 5000);
  }
});

server.bind('cn=anonymous', function(req, res, next) {
  console.log('bind DN: ' + req.dn.toString());
  console.log('bind PW: ' + req.credentials);
  res.end();
  return next();
});

server.bind('cn=halt', function(req, res, next) {
  console.log('LDAP server shutdown after timeout started.');
  server.close();
  console.log('LDAP server shutdown after timeout done.');
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
