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

var OutletController = function(mbedConnector, io) {
  this.mbedConnector = mbedConnector;
  this.outlets = {};
  this.sockets = [];
  this.retryDelay = 10000;
  this.maxRetryAttempts = 5;

  var _this = this;
 
  io.on('connection', function(socket){
    console.log('socket connected');
    _this.sockets.push(socket);

    socket.emit('outlets', {
      outlets: _this.getOutlets()
    });  

    socket.on('toggle-outlet', function(data) {
      var outlet = _this.getOutlet(data.name);
      if (outlet) {
        _this.toggleOutlet(outlet, socket);
      }
    });

    socket.once('disconnect', function() {
      console.log('socket disconnected');
    })
  });
};

OutletController.prototype.sendToOtherClients = function(socket, eventType, data) {
  var otherSockets = this.sockets.filter(function(otherSocket) {
    return otherSocket.id !== socket.id;
  });

  otherSockets.forEach(function(otherSocket) {
    otherSocket.emit(eventType, data);
  });
}

OutletController.prototype.sendToAllClients = function(eventType, data) {
  this.sockets.forEach(function(socket) {
    socket.emit(eventType, data);
  });
}

OutletController.prototype.sendOutletsToClients = function() {
  var allOutlets = this.getOutlets()
  this.sendToAllClients('outlets', { outlets: allOutlets });
};

OutletController.prototype.getOutletName = function(outlet, attemptNumber) {
  if (!attemptNumber) {
    attemptNumber = 0;
  }

  var _this = this;
  this.mbedConnector.getResource(outlet.name, process.env.ENDPOINT_NAME_RESOURCE, function (error, data) {
    if (error) {
      attemptNumber++;
      if (attemptNumber > _this.maxRetryAttempts) {
        console.log('Failed to get outlet name after ' + _this.maxRetryAttempts + ', removing outlet');
        _this.removeOutlet(outlet);
      } else {
        console.error('Failed to get outlet name, retry attempt ' + attemptNumber);
        setTimeout(function() {
          _this.getOutletName(outlet, attemptNumber);
        }, _this.retryDelay);
      }
    } else {
      outlet.printName = data;
      console.log('"' + outlet.name + '" printName: ' + outlet.printName);
      _this.getOutletState(outlet);
    }
  }); 
};

OutletController.prototype.getOutletState = function(outlet, attemptNumber) {
  if (!attemptNumber) {
    attemptNumber = 0;
  }

  var _this = this;
  this.mbedConnector.getResource(outlet.name, process.env.ENDPOINT_RESOURCE, function (error, data) {
    if (error) {
      attemptNumber++;
      if (attemptNumber > _this.maxRetryAttempts) {
        console.log('Failed to get outlet state after ' + _this.maxRetryAttempts + ', removing outlet');
        _this.removeOutlet(outlet);
      } else {
        console.error('Failed to get outlet state, retry attempt ' + attemptNumber);
        setTimeout(function() {
          _this.getOutletState(outlet, attemptNumber);
        }, _this.retryDelay);
      }
    } else {
      outlet.state = parseInt(data);
      console.log('"' + outlet.name + '" state: ' + outlet.state);
      _this.sendOutletsToClients();
    }
  }); 
};

OutletController.prototype.removeOutlet = function(outlet) {
  delete this.outlets[outlet.name];
  this.sendOutletsToClients();
};

OutletController.prototype.addOutlet = function(outlet) {
  // If outlet already exists, exit
  if (this.outlets[outlet.name] && this.outlets[outlet.name].state !== -1) {
    console.log('Tried to add outlet ' + outlet.name + ' that has known state ' + this.outlets[outlet.name].state + '. Ignoring.');
    return;
  } else {
    console.log('Adding outlet ' + outlet.name);
  }

  // Ensure state is unknown
  if (outlet.state === undefined || outlet.state === null) {
    outlet.state = -1;
  }

  this.outlets[outlet.name] = outlet;
  this.getOutletName(outlet);
};

OutletController.prototype.toggleOutlet = function(outlet, socket) {
  if (outlet.state === -1) {
    console.log('Outlet in state -1!!!');
    return;
  } else if (outlet.state === 0) {
    outlet.targetState = 1;
  } else if (outlet.state === 1) {
    outlet.targetState = 0;
  }

  outlet.state = -1;

  console.log('\t' + outlet.name + ': toggleOutlet to ' + outlet.targetState);

  this.sendToAllClients('update-outlet-state', {
    name: outlet.name,
    printName: outlet.printName,
    state: -1
  });

  var _this = this;

  this.mbedConnector.putResource(outlet.name, process.env.ENDPOINT_RESOURCE, outlet.targetState, function (error,  body) {
    if (error) {
      console.log('Put failed');
      console.log(error);
      console.log('\t' + outlet.name + ': failed to update, removing from outlet list');
      _this.removeOutlet(outlet);
    } else {
      outlet.state = outlet.targetState;
      if (socket) {
        _this.sendToAllClients('update-outlet-state', {
          name: outlet.name,
          printName: outlet.printName,
          state: outlet.state
        });
      }
    }
  });
};

OutletController.prototype.fetchOutlets = function() {
  var _this = this;
  console.log('Fetching outlets');
  this.mbedConnector.getEndpoints(function (error, body) {
    if (error) {
      console.error('Get endpoints failed.');
    } else {
      endpoints = JSON.parse(body);
      endpoints.forEach(function(outlet) {
        _this.addOutlet(outlet);
      });
    }
  });
};

OutletController.prototype.getOutlets = function() {
  var _outlets = this.outlets;
  var keys = Object.keys(_outlets);
  var ret = [];
  
  keys.forEach(function(key) {
    if (_outlets[key].state !== -1) {
      ret.push(_outlets[key]);
    }
  });

  return ret;
};

OutletController.prototype.getOutlet = function(name) {
  return this.outlets[name];
};

module.exports = OutletController;
