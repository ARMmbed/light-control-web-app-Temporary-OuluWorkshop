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
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');

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
  credentials.domain = process.env.MDS_DOMAIN;
}

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on port', process.env.PORT || 3000);
  createWebhook();
});

var mbedConnector = new MbedConnector(process.env.MDS_HOST, credentials);
var outletController = new OutletController(mbedConnector, io);

app.set('outletController', outletController);
app.set('mbedConnector', mbedConnector);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({defaultLayout: 'layout', extname: '.hbs'}));
app.set('view engine', '.hbs');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers


// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    console.log(err.stack);
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

function handleNewAndUpdatedRegistrations(registrations) {
  console.log('handling new/updated registrations');
  registrations.forEach(function(outlet) {
    if (outlet.ept === process.env.ENDPOINT_TYPE) {
      var outletFormatted = {
        name: outlet.ep,
        type: outlet.ept
      };
      
      outletController.addOutlet(outletFormatted);
    } else {
      console.log('Ignoring endpoint of type ', outlet.ept);
    }
  });
}

mbedConnector.on('registrations', handleNewAndUpdatedRegistrations);
mbedConnector.on('reg-updates', handleNewAndUpdatedRegistrations);
mbedConnector.on('de-registrations', function(deregistrations) {
  deregistrations.forEach(function(outletName) {
    var outlet = outletController.getOutlet(outletName);
    outletController.removeOutlet(outlet);
  });
});

function createWebhook() {
  var url = urljoin(process.env.URL, 'webhook');
  console.log('Creating webhook');
  mbedConnector.createWebhook(url, function(error) {
    console.log('Create webhook cb');
    if (error) {
      console.log(error);
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
      "endpoint-type": process.env.ENDPOINT_TYPE,
      "resource-path": [ process.env.ENDPOINT_RESOURCE ]
    }
  ];

  mbedConnector.registerPreSubscription(preSubscriptionData, function(error, body) {
    console.log(error, body);
    if (error) {
      console.error('pre-subscription registration failed. retrying in 1 second');
      setTimeout(function() {
        registerPreSubscription();
      }, 1000);
    } else {
      console.log('in app.js, fetching outlets');
      outletController.fetchOutlets();
    }
  });  
}

module.exports = {
    app: app,
    io: io
};
