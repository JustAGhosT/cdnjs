/*! Terraformer JS - 0.0.1 - 2013-01-27
*   https://github.com/geoloqi/Terraformer
*   Copyright (c) 2013 Environmental Systems Research Institute, Inc.
*   Licensed MIT */

(function (root, factory) {

  if(typeof module === 'object' && typeof module.exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    exports = module.exports = factory();
  }else if(typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(factory);
  } else {
    root.Terraformer = factory();
  }

  if(typeof jasmine === "object") {
    if (typeof Terraformer === undefined){
      root.Terraformer = { };
    }
    root.Terraformer = factory();
  }

}(this, function(){
  var exports = {},
      EarthRadius = 6378137,
      DegreesPerRadian = 57.295779513082320,
      RadiansPerDegree =  0.017453292519943,
      MercatorCRS = {
        "type": "link",
        "properties": {
          "href": "http://spatialreference.org/ref/sr-org/6928/ogcwkt/",
          "type": "ogcwkt"
        }
      },
      GeographicCRS = {
        "type": "link",
        "properties": {
          "href": "http://spatialreference.org/ref/epsg/4326/ogcwkt/",
          "type": "ogcwkt"
        }
      };

  /*
  Internal: Extend one object with another.
  */
  function extend(destination, source) {
    for (var k in source) {
      if (source.hasOwnProperty(k)) {
        destination[k] = source[k];
      }
    }
    return destination;
  }

  /*
  Internal: Merge two objects together.
  */
  function mergeObjects (base, add) {
    add = add || {};

    var keys = Object.keys(add);
    for (var i in keys) {
      base[keys[i]] = add[keys[i]];
    }

    return base;
  }

  /*
  Public: Calculate an bounding box for a geojson object
  */
  function calculateBounds (geojson) {

    switch (geojson.type) {
      case 'Point':
        return [ geojson.coordinates[0], geojson.coordinates[1], geojson.coordinates[0], geojson.coordinates[1]];

      case 'MultiPoint':
        return calculateBoundsFromArray(geojson.coordinates);

      case 'LineString':
        return calculateBoundsFromArray(geojson.coordinates);

      case 'MultiLineString':
        return calculateBoundsFromNestedArrays(geojson.coordinates);

      case 'Polygon':
        return calculateBoundsFromArray(geojson.coordinates[0]);

      case 'MultiPolygon':
        return calculateBoundsFromNestedArrays(geojson.coordinates);

      case 'Feature':
        return calculateBounds(geojson.geometry);

      case 'FeatureCollection':
        return calculateBoundsForFeatureCollection(geojson);

      case 'GeometryCollection':
        return calculateBoundsForGeometryCollection(geojson);

      default:
        throw new Error("Unknown type: " + geojson.type);
    }
  }

  /*
  Internal: Calculate an bounding box from an nested array of positions
  */
  function calculateBoundsFromNestedArrays (array) {
    var extents = [], extent;

    for (var i = array.length - 1; i >= 0; i--) {
      if(typeof array[i][0] === "number"){
        extent = calculateBoundsFromArray(array);
        extents.push([extent[0],extent[1]]);
        extents.push([extent[2],extent[3]]);
      } else if(typeof array[i][0] === "object"){
        extent = calculateBoundsFromNestedArrays(array[i]);
        extents.push([extent[0],extent[1]]);
        extents.push([extent[2],extent[3]]);
      }
    }
    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Calculate an bounding box from an array of positions
  */
  function calculateBoundsFromArray (array) {
    var x1, x2, y1, y2;

    for (var i = array.length - 1; i >= 0; i--) {
      var lonlat = array[i];
      var lon = lonlat[0];

      var lat = lonlat[1];
      if (x1 === undefined) {
        x1 = lon;
      } else if (lon < x1) {
        x1 = lon;
      }

      if (y1 === undefined) {
        y1 = lat;
      } else if (lat < y1) {
        y1 = lat;
      }

      // define or smaller num
      if (x2 === undefined) {
        x2 = lon;
      } else if (lon > x2) {
        x2 = lon;
      }

      // define or smaller num
      if (y2 === undefined) {
        y2 = lat;
      } else if (lat > y2) {
        y2 = lat;
      }
    }

    return [x1, y1, x2, y2 ];
  }

  /*
  Internal: Calculate an bounding box for a feature collection
  */
  function calculateBoundsForFeatureCollection(featureCollection){
    var extents = [], extent;
    for (var i = featureCollection.features.length - 1; i >= 0; i--) {
      extent = calculateBounds(featureCollection.features[i].geometry);
      extents.push([extent[0],extent[1]]);
      extents.push([extent[2],extent[3]]);
    }

    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Calculate an bounding box for a geometry collection
  */
  function calculateBoundsForGeometryCollection(geometryCollection){
    var extents = [], extent;

    for (var i = geometryCollection.geometries.length - 1; i >= 0; i--) {
      extent = calculateBounds(geometryCollection.geometries[i]);
      extents.push([extent[0],extent[1]]);
      extents.push([extent[2],extent[3]]);
    }

    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Convert radians to degrees. Used by spatial reference converters.
  */
  function radToDeg(rad) {
    return rad * DegreesPerRadian;
  }

  /*
  Internal: Convert degrees to radians. Used by spatial reference converters.
  */
  function degToRad(deg) {
    return deg * RadiansPerDegree;
  }

  /*
  Internal: Loop over each geometry in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachGeometry(geojson, func){
    for (var i = 0; i < geojson.geometries.length; i++) {
      geojson.geometries[i].geometry = eachPosition(geojson.features[i].geometry, func);
    }
    return geojson;
  }

  /*
  Internal: Loop over each feature in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachFeature(geojson, func){
    for (var i = 0; i < geojson.features.length; i++) {
      geojson.features[i].geometry = eachPosition(geojson.features[i].geometry, func);
    }
    return geojson;
  }

  /*
  Internal: Loop over each array in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachPosition(coordinates, func) {
    for (var i = 0; i < coordinates.length; i++) {
      // we found a number so lets convert this pair
      if(typeof coordinates[i][0] === "number"){
        coordinates[i] = func(coordinates[i]);
      }
      // we found an coordinates array it again and run THIS function against it
      if(typeof coordinates[i] === "object"){
        coordinates[i] = eachPosition(coordinates[i], func);
      }
    }
    return coordinates;
  }

  /*
  Public: Convert a GeoJSON Position object to Geographic (4326)
  */
  function positionToGeographic(position) {
    var x = position[0];
    var y = position[1];
    return [radToDeg(x / EarthRadius) - (Math.floor((radToDeg(x / EarthRadius) + 180) / 360) * 360), radToDeg((Math.PI / 2) - (2 * Math.atan(Math.exp(-1.0 * y / EarthRadius))))];
  }

  /*
  Public: Convert a GeoJSON Position object to Web Mercator (102100)
  */
  function positionToMercator(position) {
    var lng = position[0];
    var lat = Math.max(Math.min(position[1], 89.99999), -89.99999);
    return [degToRad(lng) * EarthRadius, EarthRadius/2.0 * Math.log( (1.0 + Math.sin(degToRad(lat))) / (1.0 - Math.sin(degToRad(lat))) )];
  }

  /*
  Public: Apply a function agaist all positions in a geojson object. Used by spatial reference converters.
  */
  function applyConverter(geojson, converter){
    if(geojson.type === "Point") {
      geojson.coordinates = converter(geojson.coordinates);
    } else if(geojson.type === "Feature") {
      geojson.geometry = applyConverter(geojson, converter);
    } else if(geojson.type === "FeatureCollection") {
      geojson.features = eachFeature(geojson, converter);
    } else if(geojson.type === "GeometryCollection") {
      geojson.geometries = eachGeometry(geojson, converter);
    } else {
      geojson.coordinates = eachPosition(geojson.coordinates, converter);
    }

    if(converter === positionToMercator){
      geojson.crs = MercatorCRS;
    }

    if(converter === positionToGeographic){
      delete geojson.crs;
    }

    return geojson;
  }

  /*
  Public: Convert a GeoJSON object to ESRI Web Mercator (102100)
  */
  function toMercator(geojson) {
    return applyConverter(geojson, positionToMercator);
  }

  /*
  Convert a GeoJSON object to Geographic coordinates (WSG84, 4326)
  */
  function toGeographic(geojson) {
    return applyConverter(geojson, positionToGeographic);
  }


  /*
  Internal: -1,0,1 comparison function
  */
  function cmp(a, b) {
    if(a < b) {
      return -1;
    } else if(a > b) {
      return 1;
    } else {
      return 0;
    }
  }


  /*
  Internal: used to determine turn
  */
  function turn(p, q, r) {
    // Returns -1, 0, 1 if p,q,r forms a right, straight, or left turn.
    return cmp((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]), 0);
  }

  /*
  Internal: used to determine euclidean distance between two points
  */
  function euclideanDistance(p, q) {
    // Returns the squared Euclidean distance between p and q.
    var dx = q[0] - p[0];
    var dy = q[1] - p[1];

    return dx * dx + dy * dy;
  }

  function nextHullPoint(points, p) {
    // Returns the next point on the convex hull in CCW from p.
    var q = p;
    for(var r in points) {
      var t = turn(p, q, points[r]);
      if(t === -1 || t === 0 && euclideanDistance(p, points[r]) > euclideanDistance(p, q)) {
        q = points[r];
      }
    }
    return q;
  }

  function convexHull(points) {
    // implementation of the Jarvis March algorithm
    // adapted from http://tixxit.wordpress.com/2009/12/09/jarvis-march/

    if(points.length === 0) {
      return [];
    } else if(points.length === 1) {
      return points;
    }

    function comp(p1, p2) {
      if(p1[0] - p2[0] > p1[1] - p2[1]) {
        return 1;
      } else if(p1[0] - p2[0] < p1[1] - p2[1]) {
        return -1;
      } else {
        return 0;
      }
    }

    // Returns the points on the convex hull of points in CCW order.
    var hull = [points.sort(comp)[0]];

    for(var p = 0; p < hull.length; p++) {
      var q = nextHullPoint(points, hull[p]);

      if(q !== hull[0]) {
        hull.push(q);
      }
    }

    return hull;
  }

  function coordinatesContainPoint(coordinates, point) {
    var contains = false;
    for(var i = -1, l = coordinates.length, j = l - 1; ++i < l; j = i) {
      if (((coordinates[i][1] <= point[1] && point[1] < coordinates[j][1]) ||
           (coordinates[j][1] <= point[1] && point[1] < coordinates[i][1])) &&
          (point[0] < (coordinates[j][0] - coordinates[i][0]) * (point[1] - coordinates[i][1]) / (coordinates[j][1] - coordinates[i][1]) + coordinates[i][0])) {
        contains = true;
      }
    }
    return contains;
  }

  /*
  Internal: An array of variables that will be excluded form JSON objects.
  */
  var excludeFromJSON = ["length"];

  /*
  Internal: Base GeoJSON Primitive
  */
  function Primitive(geojson){
    if(geojson){
      switch (geojson.type) {
        case 'Point':
          return new Point(geojson);

        case 'MultiPoint':
          return new MultiPoint(geojson);

        case 'LineString':
          return new LineString(geojson);

        case 'MultiLineString':
          return new MultiLineString(geojson);

        case 'Polygon':
          return new Polygon(geojson);

        case 'MultiPolygon':
          return new MultiPolygon(geojson);

        case 'Feature':
          return new Feature(geojson);

        case 'FeatureCollection':
          return new FeatureCollection(geojson);

        case 'GeometryCollection':
          return new GeometryCollection(geojson);

        default:
          throw new Error("Unknown type: " + geojson.type);
      }
    }
  }

  Primitive.prototype = {
    toMercator: function(){
      return toMercator(this);
    },
    toGeographic: function(){
      return toGeographic(this);
    },
    convexHull: function(){
      var coordinates = [ ], i, j;
      if (this.type === 'Point') {
        if (this.coordinates && this.coordinates.length > 0) {
          return [ this.coordinates ];
        } else {
          return [ ];
        }
      } else if (this.type === 'LineString' || this.type === 'MultiPoint') {
        if (this.coordinates && this.coordinates.length > 0) {
          coordinates = this.coordinates;
        } else {
          return [ ];
        }
      } else if (this.type === 'Polygon' || this.type === 'MultiLineString') {
        if (this.coordinates && this.coordinates.length > 0) {
          for (i = 0; i < this.coordinates.length; i++) {
            coordinates = coordinates.concat(this.coordinates[i]);
          }
        } else {
          return [ ];
        }
      } else if (this.type === 'MultiPolygon') {
        if (this.coordinates && this.coordinates.length > 0) {
          for (i = 0; i < this.coordinates.length; i++) {
            for (j = 0; j < this.coordinates[i].length; j++) {
              coordinates = coordinates.concat(this.coordinates[i][j]);
            }
          }
        } else {
          return [ ];
        }
      } else {
        throw new Error("Unable to get convex hull of " + this.type);
      }

      return convexHull(coordinates);
    },
    toJSON: function(){
      var obj = {};
      for (var key in this) {
        if (this.hasOwnProperty(key) && this[key] && excludeFromJSON.indexOf(key)) {
          obj[key] = this[key];
        }
      }
      return obj;
    },
    toJson: function () {
      return JSON.stringify(this);
    }
  };

  /*
  GeoJSON Point Class
    new Point();
    new Point(x,y,z,wtf);
    new Point([x,y,z,wtf]);
    new Point([x,y]);
    new Point({
      type: "Point",
      coordinates: [x,y]
    });
  */
  function Point(input){
    var args = Array.prototype.slice.call(arguments);

    if(input && input.type === "Point" && input.coordinates){
      extend(this, input);
    } else if(input && Array.isArray(input)) {
      this.coordinates = input;
    } else if(args.length >= 2) {
      this.coordinates = args;
    } else {
      throw "Terraformer: invalid input for Terraformer.Point";
    }

    this.type = "Point";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  Point.prototype = new Primitive();
  Point.prototype.constructor = Point;

  /*
  GeoJSON MultiPoint Class
      new MultiPoint();
      new MultiPoint([[x,y], [x1,y1]]);
      new MultiPoint({
        type: "MultiPoint",
        coordinates: [x,y]
      });
  */
  function MultiPoint(input){
    if(input && input.type === "MultiPoint" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.coordinates = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiPoint";
    }

    this.type = "MultiPoint";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });

  }

  MultiPoint.prototype = new Primitive();
  MultiPoint.prototype.constructor = MultiPoint;
  MultiPoint.prototype.forEach = function(func){
    for (var i = 0; i < this.length; i++) {
      func.apply(this, [this.coordinates[i], i, this.coordinates]);
    }
    return this;
  };
  MultiPoint.prototype.addPoint = function(point){
    this.coordinates.push(point);
    return this;
  };
  MultiPoint.prototype.insertPoint = function(point, index){
    this.coordinates.splice(index, 0, point);
    return this;
  };
  MultiPoint.prototype.removePoint = function(remove){
    if(typeof remove === "number"){
      this.coordinates.splice(remove, 1);
    } else {
      this.coordinates.splice(this.coordinates.indexOf(remove), 1);
    }
    return this;
  };

  /*
  GeoJSON LineString Class
      new LineString();
      new LineString([[x,y], [x1,y1]]);
      new LineString({
        type: "LineString",
        coordinates: [x,y]
      });
  */
  function LineString(input){
    if(input && input.type === "LineString" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.coordinates = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.LineString";
    }

    this.type = "LineString";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  LineString.prototype = new Primitive();
  LineString.prototype.constructor = LineString;
  LineString.prototype.addVertex = function(point){
    this.coordinates.push(point);
    return this;
  };
  LineString.prototype.insertVertex = function(point, index){
    this.coordinates.splice(index, 0, point);
    return this;
  };
  LineString.prototype.removeVertex = function(remove){
    this.coordinates.splice(remove, 1);
    return this;
  };
  /*
  GeoJSON MultiLineString Class
      new MultiLineString();
      new MultiLineString([ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ]);
      new MultiLineString({
        type: "MultiLineString",
        coordinates: [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ]
      });
  */
  function MultiLineString(input){
    if(input && input.type === "MultiLineString" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.coordinates = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiLineString";
    }

    this.type = "MultiLineString";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });

  }

  MultiLineString.prototype = new Primitive();
  MultiLineString.prototype.constructor = MultiLineString;
  MultiLineString.prototype.forEach = function(func){
    for (var i = 0; i < this.coordinates.length; i++) {
      func.apply(this, [this.coordinates[i], i, this.coordinates ]);
    }
  };

  /*
  GeoJSON Polygon Class
      new Polygon();
      new Polygon([ [[x,y], [x1,y1], [x2,y2]] ]);
      new Polygon({
        type: "Polygon",
        coordinates: [ [[x,y], [x1,y1], [x2,y2]] ]
      });
  */
  function Polygon(input){
    if(input && input.type === "Polygon" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.coordinates = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.Polygon";
    }

    this.type = "Polygon";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });
  }

  Polygon.prototype = new Primitive();
  Polygon.prototype.constructor = Polygon;
  Polygon.prototype.addVertex = function(point){
    this.coordinates[0].push(point);
    return this;
  };
  Polygon.prototype.insertVertex = function(point, index){
    this.coordinates[0].splice(index, 0, point);
    return this;
  };
  Polygon.prototype.removeVertex = function(remove){
    this.coordinates[0].splice(remove, 1);
    return this;
  };
  Polygon.prototype.contains = function(primitive) {
    if (primitive.type !== "Point") {
      throw new Error("Only points are supported");
    }

    if (primitive.coordinates && primitive.coordinates.length) {
      if (this.coordinates && this.coordinates.length === 1) { // polygon with no holes
        return coordinatesContainPoint(this.coordinates[0], primitive.coordinates);
     } else { // polygon with holes
      if (coordinatesContainPoint(this.coordinates[0], primitive.coordinates)) {
        for (var i = 1; i < this.coordinates.length; i++) {
          if (coordinatesContainPoint(this.coordinates[i], primitive.coordinates)) {
            return false; // found in hole
          }
        }

        return true;
      } else {
        return false;
      }
     }
   }
  };

  /*
  GeoJSON MultiPolygon Class
      new MultiPolygon();
      new MultiPolygon([ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]);
      new MultiPolygon({
        type: "MultiPolygon",
        coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
      });
  */
  function MultiPolygon(input){
    if(input && input.type === "MultiPolygon" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.coordinates = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiPolygon";
    }

    this.type = "MultiPolygon";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });
  }

  MultiPolygon.prototype = new Primitive();
  MultiPolygon.prototype.constructor = MultiPolygon;
  MultiPolygon.prototype.forEach = function(func){
    for (var i = 0; i < this.coordinates.length; i++) {
      func.apply(this, [this.coordinates[i], i, this.coordinates ]);
    }
  };

  /*
  GeoJSON Feature Class
      new Feature();
      new Feature({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
        }
      });
      new Feature({
        type: "Polygon",
        coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
      });
  */
  function Feature(input){
    if(input && input.type === "Feature" && input.geometry){
      extend(this, input);
    } else if(input && input.type && input.coordinates) {
      this.geometry = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.Feature";
    }

    this.type = "Feature";

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  Feature.prototype = new Primitive();
  Feature.prototype.constructor = Feature;

  /*
  GeoJSON FeatureCollection Class
      new FeatureCollection();
      new FeatureCollection([feature, feature1]);
      new FeatureCollection({
        type: "FeatureCollection",
        coordinates: [feature, feature1]
      });
  */
  function FeatureCollection(input){
    if(input && input.type === "FeatureCollection" && input.features){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.features = input;
    } else {
      throw "Terraformer: invalid input for Terraformer.FeatureCollection";
    }

    this.type = "FeatureCollection";

    this.__defineGetter__('length', function () {
      return this.features ? this.features.length : 0;
    });

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  FeatureCollection.prototype = new Primitive();
  FeatureCollection.prototype.constructor = FeatureCollection;
  FeatureCollection.prototype.forEach = function(func){
    for (var i = 0; i < this.features.length; i++) {
      func.apply(this, [this.features[i], i, this.features]);
    }
  };
  FeatureCollection.prototype.get = function(id){
    var found;
    this.forEach(function(feature){
      console.log(feature.id, id);
      if(feature.id === id){
        found = feature;
      }
    });
    return found;
  };

  /*
  GeoJSON GeometryCollection Class
      new GeometryCollection();
      new GeometryCollection([geometry, geometry1]);
      new GeometryCollection({
        type: "GeometryCollection",
        coordinates: [geometry, geometry1]
      });
  */
  function GeometryCollection(input){
    if(input && input.type === "GeometryCollection" && input.geometries){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.geometries = input;
    } else if(input.coordinates && input.type){
      this.type = "GeometryCollection";
      this.geometries = [input];
    } else {
      throw "Terraformer: invalid input for Terraformer.GeometryCollection";
    }

    this.type = "GeometryCollection";

    this.__defineGetter__('length', function () {
      return this.geometries ? this.geometries.length : 0;
    });

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  GeometryCollection.prototype = new Primitive();
  GeometryCollection.prototype.constructor = GeometryCollection;
  GeometryCollection.prototype.forEach = function(func){
    for (var i = 0; i < this.geometries.length; i++) {
      func.apply(this, [this.geometries[i], i, this.geometries]);
    }
  };

  function createCircle(center, rad, interpolate){
    var mercatorPosition = positionToMercator(center);
    var steps = interpolate || 64;
    var radius = rad || 250;
    var polygon = {
      type: "Polygon",
      coordinates: [[]]
    };
    for(var i=1; i<=steps; i++) {
      var radians = i * (360/steps) * Math.PI / 180;
      polygon.coordinates[0].push([mercatorPosition[0] + radius * Math.cos(radians), mercatorPosition[1] + radius * Math.sin(radians)]);
    }
    return toGeographic(polygon);
  }

  function Circle (center, rad, interpolate) {
    var steps = interpolate || 64;
    var radius = rad || 250;

    if(!center || center.length < 2 || !radius || !steps) {
      throw new Error("Terraformer: missing parameter for Terraformer.Circle");
    }

    extend(this, new Feature({
      type: "Feature",
      geometry: createCircle(center, radius, steps),
      properties: {
        radius: radius,
        center: center,
        steps: steps
      }
    }));

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__("radius", function(){
      return this.properties.radius;
    });

    this.__defineSetter__("radius", function(val){
      this.properties.radius = val;
      this.recalculate();
    });

    this.__defineGetter__("steps", function(){
      return this.properties.steps;
    });

    this.__defineSetter__("steps", function(val){
      this.properties.steps = val;
      this.recalculate();
    });

    this.__defineGetter__("center", function(){
      return this.properties.center;
    });

    this.__defineSetter__("center", function(val){
      this.properties.center = val;
      this.recalculate();
    });
  }

  Circle.prototype = new Primitive();
  Circle.prototype.constructor = Circle;
  Circle.prototype.recalculate = function(){
    this.geometry = createCircle(this.center, this.radius, this.steps);
    return this;
  };

  exports.Primitive = Primitive;
  exports.Point = Point;
  exports.MultiPoint = MultiPoint;
  exports.LineString = LineString;
  exports.MultiLineString = MultiLineString;
  exports.Polygon = Polygon;
  exports.MultiPolygon = MultiPolygon;
  exports.Feature = Feature;
  exports.FeatureCollection = FeatureCollection;
  exports.GeometryCollection = GeometryCollection;
  exports.Circle = Circle;

  exports.toMercator = toMercator;
  exports.toGeographic = toGeographic;

  exports.Tools = {};
  exports.Tools.positionToMercator = positionToMercator;
  exports.Tools.positionToGeographic = positionToGeographic;
  exports.Tools.applyConverter = applyConverter;
  exports.Tools.toMercator = toMercator;
  exports.Tools.toGeographic = toGeographic;
  exports.Tools.createCircle = createCircle;

  exports.Tools.calculateBounds = calculateBounds;
  exports.Tools.coordinatesContainPoint = coordinatesContainPoint;
  exports.Tools.convexHull = convexHull;

  exports.MercatorCRS = MercatorCRS;
  exports.GeographicCRS = GeographicCRS;

  return exports;
}));