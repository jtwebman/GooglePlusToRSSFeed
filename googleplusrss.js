var http = require('sys');
var http = require('http');
var https = require('https');
var RSS = require('rss');
var cache = require('./cache');
var url = require('url');
var express = require('express');
var analitics = require('./analitics');

var app = require('express').createServer();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.configure(function(){
  //app.use(express.logger());
  app.use(express.static(__dirname + '/static'));
  //app.use(express.errorHandler({ dumbExceptions: true, showStack: true }));
});


app.get(/\/(\d+)$/, function(req, res){
  try {
    analitics.track(req);
    var googleId = req.params[0];
    var cacheFeed = cache.get(googleId);
    if (cacheFeed != null) { //cached version found so just return that
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      res.end(cacheFeed);
    } else { //No cached version so make a request to google.
      var googleReq = https.request(getGooglePlusListOptions(googleId), function(googleListResponse) {
        handleGooglesListResponse(res, googleListResponse, googleId);
      });
      googleReq.end();
    }
  } catch (ex) {
    displayErrorPage(ex, serverResponse);
  }
});

app.get('*', function(req, res){
  res.render('index');
});

app.error(function(ex, req, res, next){
  displayErrorPage(ex, res);
});

//app.listen('/tmp/googleplusrss_node.socket');
app.listen(11908);

function getGooglePlusListOptions(googleId) {
  return {
          host: 'www.googleapis.com',
          port: 443,
          path: '/plus/v1/people/'+googleId+'/activities/public?key=AIzaSyBx1DExRwKKMsyjNyfO-5LVzBnaTSVSmp8&maxResults=15',
          method: 'GET',
          headers: {
            'Connection':'keep-alive'
          }
        };
}

function getGooglePlusGetOptions(activityId) {
  return {
          host: 'www.googleapis.com',
          port: 443,
          path: '/plus/v1/activities/'+activityId+'?key=AIzaSyBx1DExRwKKMsyjNyfO-5LVzBnaTSVSmp8',
          method: 'GET',
          headers: {
            'Connection':'keep-alive'
          }
        };
}

function handleGooglesListResponse(serverResponse, googleListResponse, googleId) {
  try {
    var data = [];
    googleListResponse.on('data', function(d) {
      data.push(d);
    });
    googleListResponse.on('end', function() {
      //output directions status code other then 200 came back from google
      if (googleListResponse.statusCode != 200) { 
        displayErrorPage("Google Activity List sent back a status code of: " + googleListResponse.statusCode, serverResponse);
      } else {
        sendRSSfeed(serverResponse, data.join(''), googleId)
      }
    });	
  } catch (ex) {
    displayErrorPage(ex, serverResponse);
  }
}

function sendRSSfeed(serverResponse, googleListResults, googleId) {
  try {
    var googleFeed = JSON.parse(googleListResults);

    var authorName = 'Unknown';
    if (googleFeed.items.length > 0) {
      authorName = googleFeed.items[0].actor.displayName;
    }

    var rssfeed = new RSS({
      title: googleFeed.title,
      feed_url: 'http://plus.google.com/' + googleId + '/posts',
      site_url: 'http://plus.google.com',
      author: authorName
    });

    if (googleFeed.items.length > 0) {
      for (var i = 0; i < googleFeed.items.length; i++) {
        rssfeed.item({
            title: getTitleText(googleFeed.items[i]),
            description: getDescriptionHTML(googleFeed.items[i], i),
            url: googleFeed.items[i].url,
            date: googleFeed.items[i].updated
        });
      }
    }
    cacheAndReturnFeed(serverResponse, rssfeed, googleId);
  } catch (ex) {
    displayErrorPage(ex.toString(), serverResponse);
  }
}

function cacheAndReturnFeed(serverResponse, rssfeed, googleId) {
  var feedXml = rssfeed.xml();
  cache.put(googleId, feedXml, 3600000); //Cache for 1 hour

  serverResponse.writeHead(200, { 'content-type': 'application/rss+xml' });
  serverResponse.end(feedXml);
}

function getTitleText(activity) {
  if (activity.annotation != undefined) {
    if (activity.annotation.length > 100) {
      return activity.annotation.substr(0, 97) + '...'
    } else {
      return activity.annotation;
    }
  } else {
    if (activity.title.length > 100) {
      return activity.title.substr(0, 97) + '...'
    } else {
      return activity.title;
    }
  }
}

function getDescriptionHTML(activity, index) {
  var html = '';

  if (activity.annotation != undefined && activity.annotation.replace(/\s/g,"") !== "") {
    html += '<div id="annotation">' + activity.annotation + '</div>';
  }

  if (activity.object.objectType == 'note') {
    html += '<div id="content">' + activity.object.content + '</div>';
    if (activity.object.attachments != undefined) {
      for (var i = 0; i < activity.object.attachments.length; i++) {
        html += getAttachmentHTML(activity.object.attachments[i], i);
      }
    }
  }

  if (activity.object.objectType == 'activity') {
    html += '<br />';
    html += '<div id="shared">';
    html += '<div id="sharedBy"><a href="'+activity.object.actor.url+'">'+activity.object.actor.displayName+'</a> originally shared this post:</div>';
    html += '<div id="content">'+activity.object.content+'</div>';

    if (activity.object.attachments != undefined) {
      for (var i = 0; i < activity.object.attachments.length; i++) {
        html += getAttachmentHTML(activity.object.attachments[i], i);
      }
    }

    html += '</div>';
  } 

  return html;
}

function getAttachmentHTML(attachment, index) {
  var html = '';

  html += '<div id="attachment'+index+'">';

  if (attachment.displayName != undefined && attachment.displayName.replace(/\s/g,"") !== "") {
    html += '<div id="displayName"><a href="'+attachment.url+'">'+attachment.displayName+'</a></div>'
  }

  if (attachment.objectType == 'video') {
    html += '<a href="'+attachment.url+'"><img src="'+attachment.image.url+'" width="600" alt="video image" border="0" /></a>';
  }

  if (attachment.objectType == 'photo') {
    var width = attachment.image.width;

    if(width > 600) { width = 600; }

    html += '<a href="'+attachment.image.url+'"><img src="'+attachment.image.url+'" width="'+width+'" alt="photo" border="0" /></a>';
  }

  if (attachment.content != undefined && attachment.content.replace(/\s/g,"") !== "") {
    html += '<div id="content">'+attachment.content+'</div>';
  }

  html += '</div>';
  
  return html;
}

function displayErrorPage(msg, res) {
  res.render('404', { errorMsg: msg});
}

