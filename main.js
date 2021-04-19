/**todo
 * lat/lon OR x/y to route/station
 * route/station to lat/lon
 * error messages if the input is bad
 * zoom to result, select the station
 * 
 * try lat/lon to route/station from map click 
 *  
 * https://jsfiddle.net/b3gcehnf/ 
 * 
 * 
*/

require(["esri/geometry/Point", "esri/layers/FeatureLayer", "esri/Map", "esri/layers/MapImageLayer", "esri/views/MapView", "esri/request", "esri/widgets/Expand", "esri/geometry/projection", "esri/geometry/SpatialReference"],
  function (Point, FeatureLayer, Map, MapImageLayer, MapView, esriRequest, Expand, projection, SpatialReference) {
    "use strict"
    const xInput = document.getElementById("X");
    const yInput = document.getElementById("Y");
    const sInput = document.getElementById("station");
    const rInput = document.getElementById("routeID");
    const stationingForm = document.getElementById("stationingForm");
    const NAD83 = new SpatialReference({ wkid: 26912 });
    let stationView;

    const routesLayer = new MapImageLayer({
      url: "https://maps.udot.utah.gov/randh/rest/services/Test/MM_Stationing_Test/MapServer",
      sublayers: [{id: 1, visible: true}]
    });

    const stationLayer = new FeatureLayer({
      url: "https://maps.udot.utah.gov/randh/rest/services/Test/MM_Stationing_Test/MapServer/0"
    });
    
    const map = new Map({
      layers: [routesLayer, stationLayer],
      basemap: "gray" // Basemap  layer service
    });

    const view = new MapView({
      map: map,
      center: [-111.8910, 40.7608], // Longitude, latitude
      zoom: 13, // Zoom level
      container: "viewDiv" // Div element
    });

    const stationExpand = new Expand({
      expandIconClass: "esri-icon-layer-list",
      view: view,
      expanded: true,
      content: stationingForm
    });

    view.ui.add(stationExpand, "top-right");
    
    view.when(function() {
      /**this loops through all layers in the map
       * and then all layerViews
       * and gets the layerView for the stationing points
       */
      map.layers.forEach(function(layer) {
        view.whenLayerView(layer).then(function(layerView) {
          if (layer.type === "feature" && layer.geometryType == "point") {
            stationView = layerView;


          }
        });
      });
      
    });

    function highlightFilter(route, station) {
      station = splitstation(station)
      let featureFilter = {
        where: `STATION_LABEL = '${route}_${station}'`
      };
      console.log(featureFilter);
      // set effect on excluded features
      // make them gray and transparent
      
      stationView.effect = {
          filter: featureFilter,
          excludedEffect: "grayscale(100%) opacity(30%)"
      };

    }
   
    function convertSR(lat, lon) {
      /**Promise takes in latitude and longitude
       * converts to point geometry
       * projects to NAD83 Zone 12
       */
      return new Promise((resolve) => {
        let point = new Point({
          type: "point",
          latitude: lat,
          longitude: lon
        });

        projection.load().then(function () {
          console.log(lat, lon)
          const pointProjected = projection.project(point, NAD83);
          resolve([pointProjected.x, pointProjected.y]);
        });
      });
    }

    view.on("click", function (event) {
      /**gets the coordinates of the spot you click in the map
      * converts those coordinates to NAD83
      * populates those coordinates in the stationing form
      */
      convertSR(event.mapPoint.latitude, event.mapPoint.longitude)
        .then((r) => setXYInput(r[0], r[1]));
    });

    function setXYInput(x, y) {
      /**sets coodinates in stationing form */
      xInput.value = x;
      yInput.value = y;
    }

    getStation.addEventListener("click", function (btn) {
      /**listener for the 'Coordinates" portion of the Coordinates 
       * fetches values from form and adds them to the options for the REST API Call
      */
      const X = xInput.value;
      const Y = yInput.value;
      const url = btn.target.value;

      let options = {
        query: {
          locations: `[{"routeId" : "", "geometry" : { "x" : ${X}, "y" : ${Y} }}]`,
          inSR: 26912,
          outSR: 4326,
          f: "json"
        },
        responseType: "json"
      };
      makeRequest(url, options, "Station")
    });

    getCoords.addEventListener("click", function (btn) {
      /**listener for the 'Stationing" portion of the Coordinates 
      * fetches values from form and adds them to the options for the REST API Call
      */
      const url = btn.target.value;
      const station = sInput.value;
      const routeID = rInput.value;

      let options = {
        query: {
          locations: `[{ "routeId" : ${routeID}, "station" : ${station} }]`,
          outSR: 4326,
          f: "json"
        },
        responseType: "json"
      };
      highlightFilter(routeID, station)
      makeRequest(url, options, "Coordinates")

    });
    function splitstation(station){
      return station.split("+")[0];
    }
    function makeRequest(url, options, type) {
      /**Takes in REST Call options and which type, 
       * based on which button was clicked i the form */
      esriRequest(url, options).then(function (response) {
        setResults(response, type);
      });
    }

    function setResults(response, type) {
      /**takes results of rest call
       * gets the x/y and route/station depending on call type
       * sets to form
       * calls zoomTo, to center the map.
       */
   
      let x, y,station,routeID;
      if (type == "Coordinates") {
        routeID = response["data"]["locations"][0].routeID;
        x = response["data"]["locations"][0]["geometries"][0].x;
        y = response["data"]["locations"][0]["geometries"][0].y;
        //must convert from WGS84 lat long to NAD83 XY
        convertSR(y, x).then((r) => setXYInput(r[0], r[1]));

      }
      else {
        
        station = response["data"]["locations"][0]["results"][0].station;
        routeID = response["data"]["locations"][0]["results"][0].routeId;
        sInput.value = station;
        rInput.value = routeID;
        highlightFilter(routeID, station)        
        x = response["data"]["locations"][0]["results"][0].geometry.x;
        y = response["data"]["locations"][0]["results"][0].geometry.y;

      }
      zoomTo(x, y);
    }

    function zoomTo(x, y) {
      view.goTo({
        center: [x, y]

      }).catch(function (error) {
        if (error.name != "AbortError") {
          console.error(error);
        }
      });

    }
  });