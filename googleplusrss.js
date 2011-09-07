var http = require('sys');
var http = require('http');
var https = require('https');
var RSS = require('./rss');

var reId = new RegExp(/\/(\d+)$/);

http.createServer(function(req, serverResponse) {
  try {
    //Get the ID off the url 
    var m = reId.exec(req.url);
    if (m != null) { //Url has the id so send back rss feed
      serverResponse.writeHead(200, { 'content-type': 'application/rss+xml' });
      var googleId = m[1];
      var data = [];

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
        googleResponse.on('data', function(d) {
          data.push(d);
        });
        googleResponse.on('end', function() {
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
          serverResponse.end(feed.xml());
        });	
      });
      googleReq.end();
    } else { //Else output directions
      serverResponse.writeHead(200, { 'content-type': 'text/html' });
      serverResponse.write("<html><head><title>Google+ to RSS Feed</title></head><body>");
      serverResponse.write("<h1>Google+ to RSS Feed</h1>");
      serverResponse.write("<p>Just add your google user id to this url like this http://googleplus2rss.nodester.com/12345678901234567890 and it will give you your feed.</p>");
      serverResponse.end("</body></html>");
    }
  } catch (ex) {
    serverResponse.writeHead(200, { 'content-type': 'text/html' });
      serverResponse.write("<html><head><title>Google+ to RSS Feed</title></head><body>");
      serverResponse.write("<h1>Google+ to RSS Feed Error</h1>");
      serverResponse.write("<p>We got the following error getting the feed: " + ex.toString() + "</p>");
      serverResponse.end("</body></html>");
  }
}).listen(11825);
