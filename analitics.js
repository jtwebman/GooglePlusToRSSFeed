/* Replace this with your mobile id */
var googleAccount = 'UA-23159838-3';
/*****************************/

var querystring = require('querystring');
var http = require('http');
var crypto = require('crypto');

exports.track = function(req) {
  http.request(getOptions(req), function(res) {
    //Do nothing just make the response blindly :)
  }).end();
};

exports._options = function(req) {
  return getOptions(req);
};

function getOptions(req) {
  return {
          host: 'www.google-analytics.com',
          port: 80,
          path: googleAnalyticsGetImageUrl(req),
          method: 'GET',
          headers: {
            'user-agent': req.headers['user-agent'],
            'accepts-language': req.headers['accept-language']
          }
        };
}

function googleAnalyticsGetImageUrl(req) {
  var url = [];
  url.push('/__utm.gif?');
  url.push(querystring.stringify({
    utmwv: '4.4sa',
    utmn: getRandomNumber(),
    utmhn: req.headers['host'],
    utmr: req.headers['referer'],
    utmp: req.url,
    utmac: googleAccount,
    utmcc: '__utma=999.999.999.999.999.1;',
    utmvid: getVistorId(req),
    utmip: req.connection.remoteAddress
  }));

  return url.join('');
}

function getVistorId(req) {
  return '0x' + crypto.createHash('md5')
            .update(req.headers['user-agent'] + getRandomNumber().toString())
            .digest('hex').toString()
            .substring(0,16)
}

function getRandomNumber() {
  return Math.floor(Math.random()*0x7fffffff)
} 

