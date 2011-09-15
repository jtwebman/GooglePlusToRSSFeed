var http = require('sys');
var http = require('http');
var https = require('https');
var RSS = require('rss');
var cache = require('./cache');
var url = require('url');

var reId = new RegExp(/\/(\d+)$/);

PostTypeEnum = {
      Plain : 0,
      Link : 1,
      YouTube : 2,
      Shared : 3
    }

http.createServer(function(req, serverResponse) {
  try {
    var m = reId.exec(req.url); //Get the ID off the url 
    if (m != null) { //Url has the id so send back rss feed
      var googleId = m[1];
      var cacheFeed = cache.get(googleId);
      if (cacheFeed != null) { //cached version found so just return that
        serverResponse.end(cacheFeed);
        console.log("Read from cache: " + googleId);
      } else { //No cached version so make a request to google.
        var googleReq = https.request(getGoogleOptions(googleId), function(googleResponse) {
          handleGooglesResponse(serverResponse, googleResponse, googleId);
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

function getGoogleOptions(googleId) {
  return {
          host: 'plus.google.com',
          port: 443,
          path: '/_/stream/getactivities/?&sp=[1,2,"'+googleId+'",null,null,40,null,"social.google.com",[]]',
          method: 'GET',
          headers: {
            'user-agent':'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:6.0a2) Gecko/20110613 Firefox/6.0a2',
            'Connection':'keep-alive'
         }
};
}

function handleGooglesResponse(serverResponse, googleResponse, googleId) {
  var data = [];
  googleResponse.on('data', function(d) {
    data.push(d);
  });
  googleResponse.on('end', function() {
    console.log();
    if (googleResponse.statusCode != 200) {
      //output directions status code other then 200 came back from google
      sendErrorPage(serverResponse, "Google sent back a status code of: " + googleResponse.statusCode); 
    } else {
      sendRSSfeed(serverResponse, data.join(''), googleId)
    }
  });	
}

// To clean up the results to parse the JSON object from google
function googleJSONFilter(googleResults) {
  googleResults = googleResults.replace(")]}'","");
  googleResults = googleResults.replace(/\[,/g, '["",');
  googleResults = googleResults.replace(/,,/g, ',"",');
  return googleResults.replace(/,,/g, ',"",');
}

function sendRSSfeed(serverResponse, googleResults, googleId) {
  try {
    var p = JSON.parse(googleJSONFilter(googleResults));
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
      var posttitle = ''; 
      var postdescription = ''; 
      var posturl = 'https://plus.google.com/' + post[i][21].toString(); // link to the item
      var postdate = new Date(post[i][5]) // any format that js Date can parse.

      var POST_TYPE = PostTypeEnum.Plain;
      var POST_HTML = post[i][4].toString();
      var POST_PLAIN_TEXT = post[i][20].toString();
      var LINK_NAME = null;
      var LINK_DESCRIPTION = null;
      var LINK_URL = null;
      var IMAGE_URL = null;
      var USER_COMMENT_HTML = post[i][47].toString();
      var USER_COMMENT_PLAIN_TEXT = post[i][48].toString();
      var YOUTUBE_VIDEO_IMAGE_URL = null;
      var SHARED_POST_USER_ID = null;
      var SHARED_POST_NAME = null;

      
      if (post[i][11][0] != null) {
        LINK_NAME = post[i][11][0][3].toString();
        LINK_DESCRIPTION = post[i][11][0][21].toString();
        POST_TYPE = PostTypeEnum.Link;
        if (post[i][11][0][24] != null) {
          LINK_URL = post[i][11][0][24][1].toString();
          if (post[i][11][0][24][1].toString().indexOf("youtube.com") > 0) {
            POST_TYPE = PostTypeEnum.YouTube;
          }
        }
        if (post[i][11][0][41] != null && post[i][11][0][41][1] != null && post[i][11][0][41][1][1] != null) {
          YOUTUBE_VIDEO_IMAGE_URL = post[i][11][0][41][1][1].toString();
        }
      }
      if (post[i][11][1] != null && post[i][11][1][5] != null && post[i][11][1][5][1] != null) {
        IMAGE_URL = post[i][11][1][5][1].toString();
      } else {
        if (post[i][11][0] != null && post[i][11][0][5] != null && post[i][11][0][5][1] != null) {
          IMAGE_URL = post[i][11][0][5][1].toString();
        }
      }
      if (post[i][43] != null && post[i][43][1] != null) {
        POST_TYPE = PostTypeEnum.Shared;
        SHARED_POST_USER_ID = post[i][43][1].toString();
        SHARED_POST_NAME = post[i][43][0].toString();
      }

      switch(POST_TYPE) {
      case PostTypeEnum.Link:
        posttitle = POST_PLAIN_TEXT;
        if (POST_HTML != null && POST_HTML != '') {
          postdescription = postdescription + POST_HTML + "<br /><br />";
        }
        if (LINK_NAME != null && LINK_NAME != '' && LINK_URL != null && LINK_URL  != '') {
          postdescription = postdescription + "<a href='" + LINK_URL + "'>" + LINK_NAME + "</a><br />";
        }
        if (IMAGE_URL != null && IMAGE_URL != '') {
          postdescription = postdescription + '<a href="' + posturl + '"><img src="' 
                          + IMAGE_URL + '" border="0" /></a>';
        }
        postdescription = postdescription + post[i][11][0][21].toString();
        break;
      case PostTypeEnum.YouTube:
        posttitle = POST_PLAIN_TEXT;
        if (POST_HTML != null && POST_HTML != '') {
          postdescription = postdescription + POST_HTML + "<br /><br />";
        }
        postdescription = postdescription + '<a href="' + posturl + '"><img src="' 
                        + YOUTUBE_VIDEO_IMAGE_URL + '" border="0" title="Click to Play" /></a>';
        postdescription = postdescription + "<br />";
        postdescription = postdescription + LINK_DESCRIPTION;
        break;
      case PostTypeEnum.Shared:
        if (USER_COMMENT_PLAIN_TEXT != null && USER_COMMENT_PLAIN_TEXT != '') {
          posttitle = USER_COMMENT_PLAIN_TEXT;
        } else {
          posttitle = POST_PLAIN_TEXT;
        }
        if (USER_COMMENT_HTML != null && USER_COMMENT_HTML != '') {
          postdescription = postdescription + USER_COMMENT_HTML + "<br /><br />";
        }
        postdescription = postdescription + '<a href="http://plus.google.com/' + SHARED_POST_USER_ID + '/posts">' 
                                + SHARED_POST_NAME + '</a> shared this post: <br />';
        if (POST_HTML != null && POST_HTML != '') {
          postdescription = postdescription + POST_HTML + "<br /><br />";
        }
        if (LINK_URL != null && LINK_URL != '') {
          postdescription = postdescription + "<a href='" + LINK_URL + "'>" + LINK_NAME + "</a><br />";
          if (IMAGE_URL != null && IMAGE_URL != '') {
            postdescription = postdescription + '<a href="' + posturl + '"><img src="' 
                            + IMAGE_URL + '" border="0" /></a>';
          }
          postdescription = postdescription + LINK_DESCRIPTION;
        }
        break;
      default:
        posttitle = POST_PLAIN_TEXT;
        postdescription = POST_HTML;
        if (IMAGE_URL != null && IMAGE_URL != '') {
          postdescription = postdescription + '<a href="' + posturl + '"><img src="' 
                          + IMAGE_URL + '" border="0" /></a>';
        }
      }

      if (posttitle.length > 100) {
        posttitle = posttitle.substring(0, 97) + "..."
      }

      feed.item({
          title:  posttitle,
          description: postdescription,
          url: posturl,
          date: postdate
      });
    }
    var feed = feed.xml();

    cache.put(googleId, feed, 300000) //Cache for 5 minutes

    serverResponse.writeHead(200, { 'content-type': 'application/rss+xml' });
    serverResponse.end(feed);
    console.log("Pulled from google: " + googleId);
  } catch (ex) {
    sendErrorPage(serverResponse, ex.toString());
  }
}

function sendErrorPage(serverResponse, errorMsg) {
  serverResponse.writeHead(400, { 'content-type': 'text/html' });
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
