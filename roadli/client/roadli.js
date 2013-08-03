var G_API_KEY = 'AIzaSyBFp14Fv8ZVBJe7nrdRXcnGnTA-4WpcjX8';
var ADSENSE_PUBLISHER_ID = 'pub-1528594420112252';
var GMAPS_VISUAL_REFRESH = true;
var DISTANCE_FROM_RT = 4; // km
var boxes = null;
var placemarkers = {};
var selectedplaceinfo;
var ginfowindow;

calcRoute = function(viaplace,vianame) {
  console.log('calcing route');
  if (!document.getElementById('from-place')) return;
  var start = document.getElementById('from-place').value;
  var end = document.getElementById('to-place').value;
  var waypts = [];

  if (viaplace) {
    waypts.push({location:viaplace,stopover:true});
  };

  var dest = end;
  if (viaplace) {
    dest = vianame + ', '+viaplace + ' to:' + dest;
  }
  var link = 'https://maps.google.com/maps?saddr=' + encodeURIComponent(start) + '&daddr=' + encodeURIComponent(dest);
  
  var request = {
    origin: start,
    destination: end,
    waypoints: waypts,
    optimizeWaypoints: false, // allow reordering
    travelMode: google.maps.TravelMode.DRIVING
  };
  directionsService.route(request, function(response, status) {
    // console.log(response,status);
    if (status == google.maps.DirectionsStatus.OK) {
      Session.set('mapslink',link);
      directionsDisplay.setDirections(response);
      var route = response.routes[0];
      // var summaryPanel = document.getElementById('directions_panel');
      // summaryPanel.innerHTML = '';

      if (!viaplace) {
        console.log('new main route');
        Session.set('mainRoute',route);
        // Box the overview path of the first route
        var rboxer = new RouteBoxer();
        var path = route.overview_path;
        boxes = rboxer.box(path, DISTANCE_FROM_RT);
        // drawBoxes(boxes); // draw boxes for debug purposes
      }
      Session.set('currentRoute',route);

      // For each route leg, display summary information.
      console.log('newbounds');
    //   for (var i = 0; i < route.legs.length; i++) {
    //     var routeSegment = i + 1;
    //     summaryPanel.innerHTML += '<b>Route Segment: ' + routeSegment + '</b><br>';
    //     summaryPanel.innerHTML += route.legs[i].start_address + ' to ';
    //     summaryPanel.innerHTML += route.legs[i].end_address + '<br>';
    //     summaryPanel.innerHTML += route.legs[i].distance.text + '<br><br>';
    //   }
  } else {
    console.error("DirectionsService failed with status: " + status);
  };
});
};

getTimeForVia = function(place,timeTable) {
  var start = document.getElementById('from-place').value;
  var end = document.getElementById('to-place').value;

  var request = {
    origin: start,
    destination: end,
    optimizeWaypoints: false, // allow reordering
    travelMode: google.maps.TravelMode.DRIVING
  };
  if (place) {
    request.waypoints = [{location:place,stopover:true}]
  }

  var totalTime = 0;
  directionsService.route(request, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      var route = response.routes[0];
      // For each leg, display summary information.
      for (var i = 0; i < route.legs.length; i++) {
        totalTime = totalTime + route.legs[i].duration.value;        
      }
      timeTable[place] = totalTime;
    } else {
      console.error("Time for via directions service fail with status: " + status);
    }
  });
};

Template.route_table.events({
  'click .route-table tr' : function() {
    Session.set('selected-place',this.id);
  },
  'mouseenter .route-table tr' : function() {
    Session.set('hover-place',this.id);

  },
  'mouseleave .route-table tr' : function() {
    Session.set('hover-place',null);
  }
});

Deps.autorun(function() {
  var hid = Session.get('hover-place');
  if (!hid || !placemarkers[hid]) return;
  var icon = placemarkers[hid].icon;
  icon.scaledSize = new google.maps.Size(45, 45);
  icon.anchor = new google.maps.Point(26, 44);
  placemarkers[hid].setIcon(icon);
  Deps.currentComputation.hid = hid;
  Deps.currentComputation.onInvalidate(function(c) {
    var icon = placemarkers[c.hid].icon;
    icon.scaledSize = new google.maps.Size(25,25);
    icon.anchor = new google.maps.Point(17,34);
    placemarkers[c.hid].setIcon(icon);
  });
});

Deps.autorun(function() {
  var spid = Session.get('selected-place');
  if (!spid || !google) {
    // direct route selected
    setTimeout(calcRoute,100);
    return;
  }
  var sp = Session.get('placeOptions')[spid];

  if (selectedplaceinfo) selectedplaceinfo.close();
  selectedplaceinfo = new google.maps.InfoWindow();
  selectedplaceinfo.setContent('<div><strong>' + sp.name + '</strong><br>' + sp.vicinity);
  selectedplaceinfo.open(map, placemarkers[sp.id]);

  calcRoute(sp.vicinity,sp.name);
})

Template.route_table.maybe_selected = function() {
  if (Session.equals('selected-place',this.id)) {
    return 'selected';
  } else if (Session.equals('hover-place',this.id)) {
    return 'hover';
  }
  return '';
}

Handlebars.registerHelper('human_time', function(secs) {
  return secsToStr(secs);
});


Template.main.link = function() {
  return Session.get('mapslink');
};

Template.route_table.placeOptions = function() {
  var mr = Session.get('mainRoute');

  var result = [];
  var pdict = Session.get('placeOptions');

  if (!pdict) return;

  for (var key in pdict) {
    var l = pdict[key];
    if (l.durationTo && l.durationFrom) {
      l.totalTime = l.durationTo.value + l.durationFrom.value;
      l.timeAdded = l.totalTime - mr.legs[0].duration.value;
      result.push(pdict[key]); 
    };
  }
  result = result.sort(function(a,b) {return a.totalTime - b.totalTime});

  if (result.length == 0) return;

  var max_time = result[result.length-1].totalTime;

  mr.pctTrip = mr.legs[0].duration.value / max_time * 100;
  Session.set('mainRoute',mr);

  var rres = [];
  for (var i=0,p;p=result[i]; i++) {
    p.pctTrip = p.totalTime/max_time * 100;
    p.pctFirst = p.durationTo.value/p.totalTime * 100;
    p.pctSecond = p.durationFrom.value/p.totalTime * 100;
    rres.push(p);
  }

  return rres;
}

Template.route_table.mainRoute = function() {
  var mr = Session.get('mainRoute');
  if (!mr) return;
  mr.totalTimeText = mr.legs[0].duration.text;
  return mr;
}

Meteor.startup( function() {
  console.log('starting up!');
  function loadScript() {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = 'http://maps.googleapis.com/maps/api/js?key='+G_API_KEY+'&sensor=false&callback=goog&libraries=places,adsense';
    console.log(script.src);
    document.body.appendChild(script);
  }
  window.onload = loadScript;
  Session.set('mapslink',null);
  Session.set('viaplace',null);
  $('#from-place').focus();

  $('h1').fitText();
  $('.instruct').fitText(4);
  $('.form input').fitText(2.5);
  $('.form a').fitText();

  if (!Session.get('udat')) {
    $.getJSON('http://ip-api.com/json/?callback=?', // NEED NEW SOLUTION for ssl httbin?
      function(data){
        Session.set('udat',data);
      });
  }

});

directionsDisplay = null;
directionsService = null;
map = null;
acs = [];

goog = function() {
  initRB();
  google.maps.visualRefresh = GMAPS_VISUAL_REFRESH;
  directionsService = new google.maps.DirectionsService();
  directionsDisplay = new google.maps.DirectionsRenderer();
  directionsDisplay.setOptions({suppressMarkers:false});

  var chicago = new google.maps.LatLng(41.850033, -87.6500523);
  var mapOptions = {
    zoom: 10,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    center: chicago
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

  // ads
  var adUnitDiv = document.createElement('div');
  var adUnitOptions = {
    format: google.maps.adsense.AdFormat.WIDE_SKYSCRAPER,
    position: google.maps.ControlPosition.RIGHT_TOP,
    backgroundColor: '#f5f5f5',
    borderColor: '#cccccc',
    titleColor: '#1155cc',
    textColor: '#333333',
    urlColor: '#009900',
    map: map,
    visible: true,
    publisherId: ADSENSE_PUBLISHER_ID
  }
  adUnit = new google.maps.adsense.AdUnit(adUnitDiv, adUnitOptions);
  // / ads

  Deps.autorun(function() {
    var data = Session.get('udat');
    map.setCenter(new google.maps.LatLng(parseFloat(data.lat), parseFloat(data.lon)));
  });

  directionsDisplay.setMap(map);
  ginfowindow = new google.maps.InfoWindow();

  var addAutocompleteToInput = function(input) {
    autoSelectOnTab(input);
    var ac = new google.maps.places.Autocomplete(input);
    acs.push(ac);

    ac.bindTo('bounds', map);
    // ac.infowindow = new google.maps.InfoWindow();
    // ac.marker = new google.maps.Marker({
    //   map: map,
    //   anchorPoint: new google.maps.Point(0,-33)
    // });

    google.maps.event.addListener(ac, 'place_changed', function() {
      // ac.infowindow.close();
      // ac.marker.setVisible(false);
      input.className = '';
      ac.place = ac.getPlace();
      if (!ac.place.geometry) {
        // Inform the user that the place was not found and return.
        input.className = 'notfound';
        return;
      }

      // If the place has a geometry, then present it on a map.
      if (ac.place.geometry.viewport) {
        map.fitBounds(ac.place.geometry.viewport);
      } else {
        map.setCenter(ac.place.geometry.location);
        map.setZoom(17);  // Why 17? Because it looks good.
      }
      // ac.marker.setIcon(/** @type {google.maps.Icon} */({
      //   url: 'http://maps.gstatic.com/mapfiles/place_api/icons/geocode-71.png', //ac.place.icon,
      //   size: new google.maps.Size(71, 71),
      //   origin: new google.maps.Point(0, 0),
      //   anchor: new google.maps.Point(17, 34),
      //   // anchor: new google.maps.Point(34, 34),
      //   scaledSize: new google.maps.Size(35, 35)
      // }));

      // ac.marker.setPosition(ac.place.geometry.location);
      // ac.marker.setVisible(true);

      // var address = '';
      // if (ac.place.address_components) {
      //   address = [
      //   (ac.place.address_components[0] && ac.place.address_components[0].short_name || ''),
      //   (ac.place.address_components[1] && ac.place.address_components[1].short_name || ''),
      //   (ac.place.address_components[2] && ac.place.address_components[2].short_name || '')
      //   ].join(' ');
      // }

      // ginfowindow.setContent('<div><strong>' + ac.place.name + '</strong><br>' + address);
      // ginfowindow.open(map, ac.place);
      calcRoute(null);
      if (document.getElementById('via-place').value != '') setTimeout(findPlaces,1000);
    });
};

addAutocompleteToInput(document.getElementById('from-place'));
addAutocompleteToInput(document.getElementById('to-place'));


  // setup VIA autocomplete
  var input = (document.getElementById('via-place'));
  autoSelectOnTab(input);
  var searchBox = new google.maps.places.SearchBox(input);

  // called whenever user SELECTS a VIA place
  google.maps.event.addListener(searchBox, 'places_changed', function() {
    console.log('places_changed');
    findPlaces();
  });

  google.maps.event.addListener(map, 'bounds_changed', function() {
    var bounds = map.getBounds();
    searchBox.setBounds(bounds);
  });

};


var findPlaces = function() {
  /*  Clear old places from map. For the current from-place, to-place, via-place, find places along route.  */

  // clear all old markers
  for (var m in placemarkers) {
    placemarkers[m].setMap(null);
  }
  placemarkers = {};

  Session.set('placeOptions',{});

  for (var i = 0; i < boxes.length; i++) {
    var request = {
      bounds: boxes[i],
      keyword: document.getElementById('via-place').value
        // types: ['store']
    };

    service = new google.maps.places.PlacesService(map);
    service.nearbySearch(request, function(results, status) {
      if (status == google.maps.places.PlacesServiceStatus.OK) {

      results = results.splice(0,25); // truncate at 25 results per box

      var places = Session.get('placeOptions');
      for (var i=0,result;result=results[i];i++) {
        if (places[result.id] == null) {
          places[result.id] = result;

          // draw marker
          var image = {
            // url: result.icon,
            url: 'http://maps.gstatic.com/mapfiles/place_api/icons/generic_business-71.png',
            size: new google.maps.Size(71, 71),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(17, 34),
            scaledSize: new google.maps.Size(25, 25)
          };

          var marker = new google.maps.Marker({
            map: map,
            icon: image,
            title: result.name,
            position: result.geometry.location,
            anchorPoint: new google.maps.Point(0,-25)
          });

          var clickForId = function(pid) {
            return function() {
              Session.set('selected-place',pid);
              setTimeout(function(){$('.route-table').scrollTo('.selected')},250);
            };
          };

          var hoverForId = function(pid) {
            return function() {
              Session.set('hover-place',pid);
            };
          };

          google.maps.event.addListener(marker, 'click', clickForId(result.id));
          google.maps.event.addListener(marker, 'mouseover', hoverForId(result.id));
          google.maps.event.addListener(marker, 'mouseout', function() {Session.set('hover-place',null)});

          marker.pid = result.id;
          placemarkers[result.id] = marker;
          // result.mmarker = marker;
        }
      }
      Session.set('placeOptions',places);

      var ids = [];
      var placeLocs = [];
      for (var i=0,place; place=results[i];i++) {
        placeLocs.push(new google.maps.LatLng(place.geometry.location.jb, place.geometry.location.kb));
        ids.push(place.id);
      };
      var service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
      {
        origins: [document.getElementById('from-place').value],
        destinations: placeLocs,
        travelMode: google.maps.TravelMode.DRIVING,
          // unitSystem: google.maps.UnitSystem.IMPERIAL,
          // durationInTraffic: Boolean, // available to maps for business only
          // avoidHighways: false,
          // avoidTolls: false
        }, callbackToC(ids));
      service.getDistanceMatrix(
      {
        destinations: [document.getElementById('to-place').value],
        origins: placeLocs,
        travelMode: google.maps.TravelMode.DRIVING,
          // unitSystem: google.maps.UnitSystem.IMPERIAL,
          // durationInTraffic: Boolean, // available to maps for business only
          // avoidHighways: false,
          // avoidTolls: false
        },callbackFromC(ids));
    } else {
      if (status == "ZERO_RESULTS") return;
      console.error('NearbySearch failed with status: ' + status);
    };
  });
};
};



var callbackFromC = function(ids) {
  return function(response, status) {
    var placeDict = Session.get('placeOptions');

    if (status !== 'OK') {
      console.error('Distance Matrix Status: ' + status);
      return;
    };
      // fingers crossed order hasnt changed
      for (var i=0,placeid;placeid=ids[i];i++) {
        var el = response.rows[i].elements[0];
        if (el.status != 'OK') {
          console.error('Distance Matrix Element Status: ' + status);
          continue;
        };
        placeDict[placeid].durationFrom = el.duration;
        placeDict[placeid].distanceFrom = el.distance;
      };
      Session.set('placeOptions',placeDict);
    }
  };

  var callbackToC = function(ids) {
    return function(response, status) {
      var placeDict = Session.get('placeOptions');
      if (status !== 'OK') {
        console.error('Distance Matrix Status: ' + status);
        return;
      };
    // fingers crossed order hasnt changed
    for (var i=0,placeid;placeid=ids[i];i++) {
      var el = response.rows[0].elements[i];
      if (el.status != 'OK') {
        console.error('Distance Matrix Element Status: ' + status);
        continue;
      }
      placeDict[placeid].durationTo = el.duration;
      placeDict[placeid].distanceTo = el.distance;
    };
    Session.set('placeOptions',placeDict);
  }
};