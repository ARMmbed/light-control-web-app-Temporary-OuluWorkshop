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

var express = require("express");
var router = express.Router();

router.get("/", function(req, res, next) {
  var outletController = req.app.get('outletController');
  
  return res.render("index", {
    outlets: outletController.getOutlets()
  });
});

router.put("/webhook", function(req, res, next) {
  console.log('/webhook hit');
  console.log(req.body);

  var outletController = req.app.get('outletController');
  var outlets = [];

  if (req.body.registrations) {
    outlets = outlets.concat(req.body.registrations);
  }
  
  if (req.body['reg-updates']) {
    outlets = outlets.concat(req.body['reg-updates']);
  }

  outlets.forEach(function(outlet) {
    var outletFormatted = {
      name: outlet.ep,
      type: outlet.ept
    };
    
    outletController.addOutlet(outletFormatted);
  });

  if (req.body["async-responses"]) {
    outletController.handleAsyncResponses(req.body['async-responses']);
  }
  
  res.sendStatus(200);
});

module.exports = router;
