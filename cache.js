var sys = require('sys');
var fs = require('fs');

var cache = {}
function now() { return (new Date).getTime(); }

exports.put = function(key, value, time) {
  fs.writeFile('cache/' + key, value, function (err) {
    if (err) throw err;
    cache[key] = {expire: time + now()}
  });
}

exports.del = function(key) {
  fs.unlink('cache/' + key, function (err) {
    delete cache[key];
  });
}

exports.get = function(key) {
  var data = cache[key];
  if (typeof data != "undefined") {
    if (isNaN(data.expire) || data.expire >= now()) {
      fs.readFile('cache/' + key, function (err, filedata) {
        if (err) throw err;
        return filedata;
      });
    } else {
      exports.del(key);
    }
  }
  return null;
}
