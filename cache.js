var sys = require('sys');
var fs = require('fs');

function now() { return (new Date).getTime(); }
var timeout = 3600000; //Miliseconds in a hour

exports.setup = function(cb) {
  fs.stat('cache', function (err, stats) {
    if (err) {
      fs.mkdirSync('cache', 0777);
    }
  });
}

exports.put = function(key, value) {
  fs.writeFile('cache/' + key, value, function (err) {
    if (err) {
      console.log('Error on set:' + err);
    }
  });
}

exports.get = function(key) {
  fs.stat('cache', function (err, stats) {
    if (err) {
      return null;
    } else {
      if (stats.mtime.getTime() + timeout < now()) {
        return null;
      } else {
        fs.readFile('cache/' + key, function (err, filedata) {
          if (err) {
            return null;
          } else {
            return filedata;
          }
        });
      }
    }
  });
}
