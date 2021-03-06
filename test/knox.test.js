
/**
 * Module dependencies.
 */

var knox = require('..')
  , fs = require('fs')
  , assert = require('assert');

try {
  var auth = JSON.parse(fs.readFileSync('auth', 'ascii'));
  var client = knox.createClient(auth);
} catch (err) {
  console.error('`make test` requires ./auth to contain a JSON string with');
  console.error('`key, secret, and bucket in order to run tests.');
  process.exit(1);
}

var jsonFixture = __dirname + '/fixtures/user.json';

module.exports = {
  'test .version': function(done){
    assert.match(knox.version, /^\d+\.\d+\.\d+$/);
    done();
  },

  'test .createClient() invalid': function(done){
    var err;
    try {
      knox.createClient({});
    } catch (e) {
      err = e;
    }
    assert.equal('aws "key" required', err.message);

    var err;
    try {
      knox.createClient({ key: 'foo' });
    } catch (e) {
      err = e;
    }
    assert.equal('aws "secret" required', err.message);

    var err;
    try {
      knox.createClient({ key: 'foo', secret: 'bar' });
    } catch (e) {
      err = e;
    }
    assert.equal('aws "bucket" required', err.message);
    done();
  },

  'test .createClient() valid': function(done){
    var client = knox.createClient({
        key: 'foobar'
      , secret: 'baz'
      , bucket: 'misc'
    });

    assert.equal('foobar', client.key);
    assert.equal('baz', client.secret);
    assert.equal('misc', client.bucket);
    assert.equal('s3.amazonaws.com', client.endpoint);
    done();
  },

  'test .createClient() custom endpoint': function(done){
    var client = knox.createClient({
        key: 'foobar'
      , secret: 'baz'
      , bucket: 'misc'
      , endpoint: 's3-eu-west-1.amazonaws.com'
    });

    assert.equal('s3-eu-west-1.amazonaws.com', client.endpoint);
    done();
  },

  'test .putFile()': function(done){
    var n = 0;
    client.putFile(jsonFixture, '/test/user2.json', function(err, res){
      assert.ok(!err, 'putFile() got an error!');
      assert.equal(200, res.statusCode);
      client.get('/test/user2.json').on('response', function(res){
        assert.equal('application/json', res.headers['content-type']);
        done();
      }).end();
    });
  },

  'test .put()': function(done){
    var n = 0;
    fs.stat(jsonFixture, function(err, stat){
      if (err) throw err;
      fs.readFile(jsonFixture, function(err, buf){
        if (err) throw err;
        var req = client.put('/test/user.json', {
            'Content-Length': stat.size
          , 'Content-Type': 'application/json'
          , 'x-amz-acl': 'private'
        });
        req.on('response', function(res){
          assert.equal(200, res.statusCode);
          assert.equal(
              'http://'+client.endpoint+'/'+client.bucket+'/test/user.json'
            , client.url('/test/user.json'));
          assert.equal(
              'http://'+client.endpoint+'/'+client.bucket+'/test/user.json'
            , req.url);
          done();
        });
        req.end(buf);
      })
    });
  },

  'test .putStream()': function(done){
    var stream = fs.createReadStream(jsonFixture);
    client.putStream(stream, '/test/user.json', function(err, res){
      assert.ok(!err);
      if (100 !== res.statusCode) assert.equal(200, res.statusCode);
      done();
    });
  },

  'test .getFile()': function(done){
    client.getFile('/test/user.json', function(err, res){
      assert.ok(!err);
      assert.equal(200, res.statusCode);
      assert.equal('application/json', res.headers['content-type'])
      assert.equal(13, res.headers['content-length'])
      done();
    });
  },

  'test .get()': function(done){
    client.get('/test/user.json').on('response', function(res){
      assert.equal(200, res.statusCode);
      assert.equal('application/json', res.headers['content-type'])
      assert.equal(13, res.headers['content-length'])
      done();
    }).end();
  },

  'test .head()': function(done){
    client.head('/test/user.json').on('response', function(res){
      assert.equal(200, res.statusCode);
      assert.equal('application/json', res.headers['content-type'])
      assert.equal(13, res.headers['content-length'])
      done();
    }).end();
  },

  'test .headFile()': function(done){
    client.headFile('/test/user.json', function(err, res){
      assert.ok(!err);
      assert.equal(200, res.statusCode);
      assert.equal('application/json', res.headers['content-type'])
      assert.equal(13, res.headers['content-length'])
      done();
    });
  },

  'test .del()': function(done){
    client.del('/test/user.json').on('response', function(res){
      assert.equal(204, res.statusCode);
      done();
    }).end();
  },

  'test .deleteFile()': function(done){
    client.deleteFile('/test/user2.json', function(err, res){
      assert.ok(!err);
      assert.equal(204, res.statusCode);
      done();
    });
  },

  'test .get() 404': function(done){
    client.get('/test/user.json').on('response', function(res){
      assert.equal(404, res.statusCode);
      done();
    }).end();
  },

  'test .head() 404': function(done){
    client.head('/test/user.json').on('response', function(res){
      assert.equal(404, res.statusCode);
      done();
    }).end();
  },

  'test for multipart upload and commit': function(done){
    var resourceName = '/test/blob.bin';
    client.beginUpload(resourceName, function(err, uploadId) {
      if (err) throw err;

      var buffer = new Buffer('Hello, world!', 'utf8');

      client.putPart(resourceName, buffer, 1, uploadId, function(err, part) {
        if (err) throw err;

        client.completeUpload(resourceName, uploadId, [part], function(err, info) {
          if (err) throw err;

          done();
        });
      });
    });
  },

  'test for multipart stream upload and commit': function(done){
    var resourceName = '/test/blob.bin';
    client.beginUpload(resourceName, function(err, uploadId) {
      if (err) throw err;

      var stream = fs.createReadStream(jsonFixture);

      client.putPartStream(resourceName, stream, 13 , 1, uploadId, function(err, part) {
        if (err) throw err;

        client.completeUpload(resourceName, uploadId, [part], function(err, info) {
          if (err) throw err;

          done();
        });
      });
    });
  },

  'test for multipart upload and abort': function(done){
    var resourceName = '/test/blob.bin';
    client.beginUpload(resourceName, function(err, uploadId){
      if (err) throw err;

      var buffer = new Buffer('Hello, world!', 'utf8');

      client.putPart(resourceName, buffer, 1, uploadId, function(err, info){
        if (err) throw err;

        client.abortUpload(resourceName, uploadId, function(err){
          if (err) throw err;
          done();
        });
      });
    });
  }

};
