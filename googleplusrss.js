var http = require('sys');
var http = require('http');
var https = require('https');
var RSS = require('rss');
var cache = require('./cache');

var reId = new RegExp(/\/(\d+)$/);

http.createServer(function(req, serverResponse) {
  try {
    //Get the ID off the url 
    var m = reId.exec(req.url);
    if (m != null) { //Url has the id so send back rss feed
      var googleId = m[1];
      var cacheFeed = cache.get(googleId);
      if (cacheFeed != null) {
        console.log("Read from cache: " + googleId);
        serverResponse.end(cacheFeed);
      } else {

        var options = {
          host: 'plus.google.com',
          port: 443,
          path: '/_/stream/getactivities/?&sp=[1,2,"'+googleId+'",null,null,40,null,"social.google.com",[]]',
          method: 'GET',
          headers: {
            'user-agent':'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:6.0a2) Gecko/20110613 Firefox/6.0a2',
            'Connection':'keep-alive'
          }
        };

        var googleReq = https.request(options, function(googleResponse) {
          var data = [];
          googleResponse.on('data', function(d) {
            data.push(d);
          });
          googleResponse.on('end', function() {
            console.log();
            if (googleResponse.statusCode != 200) {
              sendErrorPage(serverResponse, "Google sent back a status code of: " + googleResponse.statusCode); //output directions no data came back
            } else {
              var results = data.join('');

              results = results.replace(")]}'","");
              results = results.replace(/\[,/g, '["",');
              results = results.replace(/,,/g, ',"",');
              results = results.replace(/,,/g, ',"",');

              var p = JSON.parse(results);
              var post = p[1][0];
              var authorName = post[0][3].toString();

              var feed = new RSS({
                title: authorName + "'s Google+ Public Feed",
                feed_url: 'http://plus.google.com/' + googleId + '/posts',
                site_url: 'http://plus.google.com',
                author: authorName
              });
              
              for (i=0;i<post.length;i++)
              {
                feed.item({
                    title:  post[i][4].toString(),
                    url: 'https://plus.google.com/' + post[i][21].toString(), // link to the item
                    date: new Date(post[i][5]) // any format that js Date can parse.
                });
              }
              var feed = feed.xml();
              cache.put(googleId, feed, 300000) //Cache for 5 minutes
              console.log("Pulled from google: " + googleId);
              serverResponse.writeHead(200, { 'content-type': 'application/rss+xml' });
              serverResponse.end(feed);
            }
          });	
        });
        googleReq.end();
      }
    } else { //Else output directions
      sendRootPage(serverResponse);
    }
  } catch (ex) {
    sendErrorPage(serverResponse, ex.toString());
  }
}).listen(11908);

function sendErrorPage(serverResponse, errorMsg) {
  serverResponse.writeHead(200, { 'content-type': 'text/html' });
  serverResponse.write("<html><head><title>Google+ to RSS Feed</title></head><body>");
  serverResponse.write("<h1>Google+ to RSS Feed Error</h1>");
  serverResponse.write("<p>We got the following error: " + errorMsg + "</p>");
  serverResponse.write("<p>Please make sure you grabed the whole user id. See <a href='/'>Google+ To Rss Home Page</a>.</p>");
  serverResponse.write("<p>This still is a beta site so it might go down from time to time. If you have any issues please submit a issue to <a href='https://github.com/jtwebman/GooglePlusToRSSFeed/issues'>Github Issues</a></p>");
  serverResponse.end("</body></html>");
}

function sendRootPage(serverResponse) {
  serverResponse.writeHead(200, { 'content-type': 'text/html' });
  serverResponse.write("<html><head><title>Google+ to RSS Feed</title></head><body>");
  serverResponse.write("<h1>Google+ to RSS Feed</h1>");
  serverResponse.write("<p>Just add your google user id to this url like this <a href='http://googleplusrss.nodester.com/118004117219257714873'>http://googleplusrss.nodester.com/118004117219257714873</a> and it will give you your raw rss feed. You can get your user id by logging into your Google+ account and clicking on your name. The url in the browse will have a long number which is your user id.</p>");
  serverResponse.write("<p>This still is a beta site so it might go down from time to time. If you have any issues please submit a issue to <a href='https://github.com/jtwebman/GooglePlusToRSSFeed/issues'>Github Issues</a></p>");
  serverResponse.write("<p><b>Current Working On:</b></p>");
  serverResponse.write("<ul>");
  serverResponse.write("<li>Fixing links and videos with no text with them.</li>");
  serverResponse.write("<li>Adding a full express site with more detailed help.</li>");
  serverResponse.write("<li>Limits so we don't get kicked from nodester.com, it's free thanks guys!</li>");
  serverResponse.write("<li>A job doing Node.js so I can stop wasting my time with M$ programming. :)</li>");
  serverResponse.write("</ul>");
  serverResponse.write("<p>Thanks for taking a look! JTWebMan</p>");
  serverResponse.end("</body></html>");
}
