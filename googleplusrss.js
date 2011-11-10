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
          path: '/plus/v1/people/'+googleId+'/activities/public?key=AIzaSyBx1DExRwKKMsyjNyfO-5LVzBnaTSVSmp8',
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
        displayErrorPage("Google sent back a status code of: " + googleListResponse.statusCode, serverResponse);
      } else {
        sendRSSfeed(serverResponse, data.join(''), googleId)
      }
    });	
  } catch (ex) {
    displayErrorPage(ex, serverResponse);
  }
}

// This is the main function to turn googles JSON into a rss feed
function sendRSSfeed(serverResponse, googleListResults, googleId) {
  try {
    var googleFeed = JSON.parse(googleListResults);
    
    var authorName = googleFeed.items[0].actor.displayName;
    console.log(googleFeed.items.length);

    var feed = new RSS({
      title: googleFeed.title,
      feed_url: 'http://plus.google.com/' + googleId + '/posts',
      site_url: 'http://plus.google.com',
      author: authorName
    });

    for (i=0;i<googleFeed.items.length;i++)
    {
      feed.item({
          title:  googleFeed.items[i].title,
          description: '',
          url: googleFeed.items[i].url,
          date: googleFeed.items[i].updated
      });
    }
    var feed = feed.xml();

    cache.put(googleId, feed, 300000) //Cache for 5 minutes

    serverResponse.writeHead(200, { 'content-type': 'application/rss+xml' });
    serverResponse.end(feed);
  } catch (ex) {
    displayErrorPage(ex.toString(), serverResponse);
  }
}

function displayErrorPage(msg, res) {
  res.render('404', { errorMsg: msg});
}

var PostTypeEnum = {
        Plain : 0,
        Link : 1,
        YouTube : 2,
        Shared : 3
      }

