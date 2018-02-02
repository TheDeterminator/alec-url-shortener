// server.js

'use strict';

const fs = require('fs')
const express = require('express');
const app = express()
const mongodb = require('mongodb');
const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$&')
const validUrl = require('valid-url');
const MongoClient = mongodb.MongoClient;


if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });

app.route('/new/:url(*)').get( (req, res, next) => {
  //connect to database
  MongoClient.connect(process.env.MONGO_URL, (err, database) => {
    const shortUrl = database.db('short-url');
    if (err) {
      console.log('Unable to connect to server', err)
    } else {
      let collection = shortUrl.collection('links');
      let url = req.params.url;
      let host = req.get('host') + '/';
      
      //Generates a....new URL?
      let generateLink = function(db, callback) {
        if (validUrl.isUri(url)) {
          //returns a document in the links collection whre url field contains a passed url parameter and returns one entry from the short field and no entries from the _id field in other words uses the given url to return a shortened one
          
         collection.findOne({url: url}, {short: 1, _id: 0}, (err, doc) => {
           //if document contains the shortened url it is set to the short_url propoerty
           if (doc != null) {
             res.json({
             originalUrl: url,
               short_url: host + doc.short
             });
           } else {
             //generate a short code if a short URL not present in the database
             let shortCode = shortid.generate();
             let newUrl = {url: url, short:shortCode};
             collection.insert(newUrl);
             res.json({
               original_url: url,
               short_url: host + shortCode
             });
           }
         }); 
        } else {
          console.log('Not a URI');
          res.json({
            error: 'Invalid url'
          });
        }
          
      };
      
      //Run the generateLink function we created
      generateLink(database, function() {
        database.close();
      });             
    } 
  })
});

//given short url redirect to original URL
app.route('/:short').get( (req, res, next) => {
  MongoClient.connect(process.env.MONGO_URL, (err, database) => {
    const shortUrl = database.db('short-url');
    if (err) {
      console.log('Unable to connect to server', err);
    } else {
        let collection = shortUrl.collection('links');
        let short = req.params.short;
      
      //for a given shortened url returns the original url and redirects the browser to that location
      collection.findOne({short:short}, {url: 1, _id: 0}, (err, doc) => {
        if (doc != null) {
          res.redirect(doc.url);
        } else {
          res.json({error: 'Shortlink not found in the database'});
        }
      });
    }
    
    database.close();
  });
});

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})            

app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + process.env.PORT);
})
