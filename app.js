/*
 * Copyright (c) 2013-2015, ARM Limited, All Rights Reserved
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require('dotenv').load();
var express = require('express');
var exphbs = require('express-handlebars');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var urljoin = require('url-join');

var MbedConnector = require('mbed-connector');
var OutletController = require('./controllers/outlet');


var credentials = {};

if (process.env.MDS_TOKEN) {
  // If env variable NSP_TOKEN defined, use token auth
  credentials.token = process.env.MDS_TOKEN;
} else if (process.env.MDS_USERNAME && process.env.MDS_PASSWORD) {
  // If env variables NSP_USERNAME and NSP_PASSWORD defined, use basic auth
  credentials.username = process.env.MDS_USERNAME;
  credentials.password = process.env.MDS_PASSWORD;
}

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on port', process.env.PORT || 3000);
});


var mbedConnector = new MbedConnector(process.env.MDS_HOST, credentials);
var outletController = new OutletController(mbedConnector, io);

app.set('outletController', outletController);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({defaultLayout: 'layout', extname: '.hbs'}));
app.set('view engine', '.hbs');
// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


function createWebhook() {
  var url = urljoin(process.env.URL, 'webhook');
  mbedConnector.createWebhook(process.env.MDS_DOMAIN, url, function(error, response, body) {
    if (error || (response && response.statusCode >= 400)) {
      console.error('webhook registration failed. retrying in 1 second');
      setTimeout(createWebhook, 1000);
    } else {
      registerPreSubscription();
    }
  });
}

function registerPreSubscription() {
  var preSubscriptionData = [
    {
      "endpoint-type": "connected-outlet",
      "resource-path": [ "/Test/0/E" ]
    }
  ];

  mbedConnector.registerPreSubscription(process.env.MDS_DOMAIN, preSubscriptionData, function(error, response, body) {
    console.log(error + " " + response.statusCode, body);
    if (error || (response && response.statusCode >= 400)) {
      console.error('pre-subscription registration failed. retrying in 1 second');
      setTimeout(function() {
        registerPreSubscription();
      }, 1000);
    } else {
      outletController.fetchOutlets();
    }
  });  
}

createWebhook();

module.exports = {
    app: app,
    io: io
};
