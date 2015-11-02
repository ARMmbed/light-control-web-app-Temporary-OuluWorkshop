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

$(function() {
  var outlets = {};
	var socket = io();

  var createSwitchHtml = function(outlet) {
    var htmlStr = '<div class="switch">';
    htmlStr += '<button id="' + outlet.name + '-switch" class="outlet-switch';
    
    if (outlet.state === 1) {
      htmlStr += ' checked';
    }
    
    htmlStr += '"></button></div>';

    return htmlStr;
  };

  var createSwitch = function(outlet) {
    $('#' + outlet.name + '-row .state-area').append(createSwitchHtml(outlet));
    
    $('#' + outlet.name + '-switch').click(function() {
      var state = this.checked ? 1 : 0;

      socket.emit('toggle-outlet', {
        name: outlet.name,
        state: state
      });
    });
  };

  
  var updateSwitch = function(outlet) {
    $('#' + outlet.name + '-switch').prop('checked', outlet.state);
  };
 
  var createSpinnerHtml = function(outlet) {
    var htmlStr = '<div class="spinner">';
    htmlStr += '<img src="img/ajax-loader.gif" alt="Loading switch state" title="Loading switch state">';
    htmlStr += '</div>';

    return htmlStr;
  };
  
  var createSpinner = function(outlet) {
    $('#' + outlet.name + '-row .state-area').append(createSpinnerHtml(outlet));
  };

  var removeStateArea = function(outlet) {
    var curOutlet = outlets[outlet.name];
    
    if (curOutlet.state === -1) {
      $('#' + outlet.name + '-row .spinner').remove();
    } else {
      $('#' + outlet.name + '-row .switch').remove();
    }
  };

  var updateStateArea = function(data) {
    var curOutlet = outlets[data.name];
    if (data.state === -1) {
      if (curOutlet.state !== -1) {
        removeStateArea(data);
        createSpinner(data);
      }
    } else {
      if (curOutlet.state === -1) {
        removeStateArea(data);
        createSwitch(data);
      } else {
        updateSwitch(data);
      }
    }
  };    

  var addOutlet = function(outlet) {
    var newName = outlet.name.replace(/-/g, " ");
    newName = newName.charAt(0).toUpperCase() + newName.slice(1);

    var htmlStr = '<div id="' + outlet.name + '-row" class="row outlet callout">';
    htmlStr += '<div class="small-8 columns"><h3>' + newName + '</h3></div>';
    htmlStr += '<div class="small-4 columns state-area text-center">';
    
    htmlStr += '</div></div>';

    $('#outlets').append(htmlStr);

    if (outlet.state === -1) {
      createSpinner(outlet);
    } else {
      createSwitch(outlet);
    }

    setTimeout(function() {
      $('#' + outlet.name + '-row').removeClass('callout');
    }, 1000);

    outlets[outlet.name] = outlet;
  }

  var removeOutlet = function(outlet) {
    console.log('delete', outlet);
    $('#' + outlet.name + '-row').remove();
    delete outlets[outlet.name];
  }
  
  var outletsToArray = function(outletsObj) {
    var keys = Object.keys(outletsObj);
    var ret = [];

    keys.forEach(function(key) {
      ret.push(outletsObj[key]);
    });
 
    return ret;
  };
    
  socket.on('outlets', function(data) {
		console.log('outlets:', data);
    
    var remoteOutletNames = data.outlets.map(function(outlet) {
      return outlet.name;
    });

    var outletArray = outletsToArray(outlets);

    var toDeleteOutlets = outletArray.filter(function(outlet) {
      return remoteOutletNames.indexOf(outlet.name) === -1;
    });

    toDeleteOutlets.forEach(function(outlet) {
      removeOutlet(outlet);
    });

    data.outlets.forEach(function(outlet) {
      if (outlets[outlet.name]) {
        updateStateArea(outlet);
        outlets[outlet.name].state = outlet.state;
      } else {
        addOutlet(outlet);
      }
    });
  });
 
	socket.on('add-outlets', function(data) {
		console.log('add-outlets:', data);

    data.outlets.forEach(function(outlet) {
      if (outlets[outlet.name]) {
        outlets[outlet.name].state = outlet.state;
        $('#' + outlet.name + '-switch').checked = outlet.state;
      } else {
        addOutlet(outlet);
      }
    });
	});

  socket.on('remove-outlets', function(data) {
    console.log('remove-outlets', data);
    data.outlets.forEach(function(outlet) {
      if (outlets[outlet.name]) {
        removeOutlet(outlet);
      }
    });
  });
  
  socket.on('update-outlet-state', function(data) {
    console.log('update-outlet-state', data);
    if (outlets[data.name]) {
      var curOutlet = outlets[data.name];
      updateStateArea(data);
      curOutlet.state = data.state;
    }
  });
});
