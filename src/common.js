/*jshint globalstrict:true*/
/*global angular:false*/
'use strict';

var isDefined = angular.isDefined,
    isFunction = angular.isFunction,
    isString = angular.isString,
    isObject = angular.isObject,
    isArray = angular.isArray,
    forEach = angular.forEach,
    extend = angular.extend,
    copy = angular.copy;

var abstractKey = 'abstract';

function inherit(parent, extra) {
  return extend(new (extend(function() {}, { prototype: parent }))(), extra);
}

function defaults(opts, defs) {
  return extend({}, defs, pick(opts || {}, objectKeys(defs)));
}

function merge(dst) {
  forEach(arguments, function(obj) {
    if (obj !== dst) {
      forEach(obj, function(value, key) {
        if (!dst.hasOwnProperty(key)) dst[key] = value;
      });
    }
  });
  return dst;
}

/**
 * Recursive function iterator
 */
function FunctionIterator(items) {

  var it = function(initial) {
    var noOp = function() {};
    var get  = (function() { return this.next() || noOp; }).bind(this);
    var next = function() { return get()(initial, next); };
    return next();
  };

  extend(this, {
    items: items,
    _current: -1
  });

  return it.bind(this);
}

FunctionIterator.prototype.current = function() {
  return this.items[this._current];
};

FunctionIterator.prototype.next = function() {
  this._current++;
  return this.current();
};

/**
 * Finds the common ancestor path between two states.
 *
 * @param {Object} first The first state.
 * @param {Object} second The second state.
 * @return {Array} Returns an array of state names in descending order, not including the root.
 */
function ancestors(first, second) {
  var path = [];

  for (var n in first.path) {
    if (first.path[n] !== second.path[n]) break;
    path.push(first.path[n]);
  }
  return path;
}

/**
 * IE8-safe wrapper for `Object.keys()`.
 *
 * @param {Object} object A JavaScript object.
 * @return {Array} Returns the keys of the object as an array.
 */
function objectKeys(object) {
  if (Object.keys) {
    return Object.keys(object);
  }
  var result = [];

  forEach(object, function(val, key) {
    result.push(key);
  });
  return result;
}

/**
 * IE8-safe wrapper for `Array.prototype.indexOf()`.
 *
 * @param {Array} array A JavaScript array.
 * @param {*} value A value to search the array for.
 * @return {Number} Returns the array index value of `value`, or `-1` if not present.
 */
var arraySearch = indexOf;
function indexOf(array, value) {
  if (Array.prototype.indexOf) {
    return array.indexOf(value, Number(arguments[2]) || 0);
  }
  var len = array.length >>> 0, from = Number(arguments[2]) || 0;
  from = (from < 0) ? Math.ceil(from) : Math.floor(from);

  if (from < 0) from += len;

  for (; from < len; from++) {
    if (from in array && array[from] === value) return from;
  }
  return -1;
}

/**
 * Merges a set of parameters with all parameters inherited between the common parents of the
 * current state and a given destination state.
 *
 * @param {Object} currentParams The value of the current state parameters ($stateParams).
 * @param {Object} newParams The set of parameters which will be composited with inherited params.
 * @param {Object} $current Internal definition of object representing the current state.
 * @param {Object} $to Internal definition of object representing state to transition to.
 */
function inheritParams(currentParams, newParams, $current, $to) {
  var parents = ancestors($current, $to), parentParams, inherited = {}, inheritList = [];

  for (var i in parents) {
    if (!parents[i].params) continue;
    parentParams = objectKeys(parents[i].params);
    if (!parentParams.length) continue;

    for (var j in parentParams) {
      if (indexOf(inheritList, parentParams[j]) >= 0) continue;
      inheritList.push(parentParams[j]);
      inherited[parentParams[j]] = currentParams[parentParams[j]];
    }
  }
  return extend({}, inherited, newParams);
}

/**
 * Performs a non-strict comparison of the subset of two objects, defined by a list of keys.
 *
 * @param {Object} a The first object.
 * @param {Object} b The second object.
 * @param {Array} keys The list of keys within each object to compare. If the list is empty or not specified,
 *                     it defaults to the list of keys in `a`.
 * @return {Boolean} Returns `true` if the keys match, otherwise `false`.
 */
function equalForKeys(a, b, keys) {
  if (!keys) {
    keys = [];
    for (var n in a) keys.push(n); // Used instead of Object.keys() for IE8 compatibility
  }

  for (var i=0; i<keys.length; i++) {
    var k = keys[i];
    if (a[k] != b[k]) return false; // Not '===', values aren't necessarily normalized
  }
  return true;
}

/**
 * Returns the subset of an object, based on a list of keys.
 *
 * @param {Array} keys
 * @param {Object} values
 * @return {Boolean} Returns a subset of `values`.
 */
function filterByKeys(keys, values) {
  var filtered = {};

  forEach(keys, function (name) {
    if (isDefined(values[name])) filtered[name] = values[name];
  });
  return filtered;
}

// like _.indexBy
// when you know that your index values will be unique, or you want last-one-in to win
function indexBy(array, propName) {
  var result = {};
  forEach(array, function(item) {
    result[item[propName]] = item;
  });
  return result;
}

// extracted from underscore.js
// Return a copy of the object only containing the whitelisted properties.
function pick(obj) {
  var copy = {};
  var keys = Array.prototype.concat.apply(Array.prototype, Array.prototype.slice.call(arguments, 1));
  for (var key in obj) {
    if (keys.indexOf(key) !== -1) copy[key] = obj[key];
  }
  return copy;
}

// extracted from underscore.js
// Return a copy of the object omitting the blacklisted properties.
function omit(obj) {
  var copy = {};
  var keys = Array.prototype.concat.apply(Array.prototype, Array.prototype.slice.call(arguments, 1));
  for (var key in obj) {
    if (keys.indexOf(key) === -1) copy[key] = obj[key];
  }
  return copy;
}

function pluck(collection, key) {
  return map(collection, prop(key));
}

function filter(collection, callback) {
  var arr = isArray(collection), result = arr ? [] : {};
  forEach(collection, function(val, i) {
    if (callback(val, i)) {
      if (arr) result.push(val);
      else result[i] = val;
    }
  });
  return result;
}

function _filter(callback) {
  return function (collection) { return filter(collection, callback); };
}

function find(collection, callback) {
  var result;

  forEach(collection, function(val, i) {
    if (result) return;
    if (callback(val, i)) result = val;
  });

  return result;
}

function tpl(string, vals) {
  return string.replace(/\{([\w.]+)\}/g, function(_, key) {
    return parse(key)(vals) || "";
  });
}

function map(collection, callback) {
  var result = isArray(collection) ? [] : {};

  forEach(collection, function(val, i) {
    result[i] = callback(val, i);
  });
  return result;
}

function _map(callback) {
  return function mapper(collection) { return map(collection, callback); };
}

function unnest(list) {
  var result = [];
  forEach(list, function(val) { result = result.concat(val); });
  return result;
}

function unroll(callback) {
  callback = callback || angular.identity;

  return function(object) {
    var result = [];
    forEach(object, function(val, key) {
      var tmp = {};
      tmp[key] = val;
      result.push(callback(tmp));
    });
    return result;
  };
}

// Return a completely flattened version of an array.
function flatten (array) {
  function _flatten(input, output) {
    forEach(input, function(value) {
      if (angular.isArray(value)) {
        _flatten(value, output);
      } else {
        output.push(value);
      }
    });
    return output;
  }

  return _flatten(array, []);
}

function pairs(array1, array2) {
  if (array1.length !== array2.length) throw new Error("pairs(): Unequal length arrays not allowed");
  return array1.reduce(function (memo, key, i) { memo[key] = array2[i]; return memo; }, {});
}

// Checks if a value is injectable
function isInjectable(value) {
  return (isFunction(value) || (isArray(value) && isFunction(value[value.length - 1])));
}

function isNull(o) { return o === null; }

function compose() {
  var args = arguments;
  var start = args.length - 1;
  return function() {
    var i = start;
    var result = args[start].apply(this, arguments);
    while (i--) result = args[i].call(this, result);
    return result;
  };
}

function pipe() {
  return compose.apply(null, [].slice.call(arguments).reverse());
}

function prop(name) {
  return function(obj) { return obj && obj[name]; };
}

function parse(name) {
  return pipe.apply(null, name.split(".").map(prop));
}

function not(fn) {
  return function() { return !fn.apply(null, [].slice.call(arguments)); };
}

function and(fn1, fn2) {
  return function() {
    return fn1.apply(null, [].slice.call(arguments)) && fn2.apply(null, [].slice.call(arguments));
  };
}

function or(fn1, fn2) {
  return function() {
    return fn1.apply(null, [].slice.call(arguments)) || fn2.apply(null, [].slice.call(arguments));
  };
}

function is(ctor) {
  return function(val) { return val != null && val.constructor === ctor || val instanceof ctor; };
}

function eq(comp) {
  return function(val) { return val === comp; };
}

function isEq(fn1, fn2) {
  return function() {
    var args = [].slice.call(arguments);
    return fn1.apply(null, args) === fn2.apply(null, args);
  };
}

function val(v) {
  return function() { return v; };
}

function invoke(method, args) {
  return function(obj) {
    return obj[method].apply(obj, args);
  };
}

function pattern(struct) {
  return function(val) {
    for (var i = 0; i < struct.length; i++) {
      if (struct[i][0](val)) return struct[i][1](val);
    }
  };
}

var isPromise = and(isObject, pipe(prop('then'), isFunction));

var GlobBuilder = (function() {

  function Glob(text) {

    var glob = text.split('.');

    // Returns true if glob matches current $state name.
    this.matches = function(name) {
      var segments = name.split('.');

      // match single stars
      for (var i = 0, l = glob.length; i < l; i++) {
        if (glob[i] === '*') segments[i] = '*';
      }

      // match greedy starts
      if (glob[0] === '**') {
         segments = segments.slice(segments.indexOf(glob[1]));
         segments.unshift('**');
      }
      // match greedy ends
      if (glob[glob.length - 1] === '**') {
         segments.splice(segments.indexOf(glob[glob.length - 2]) + 1, Number.MAX_VALUE);
         segments.push('**');
      }
      if (glob.length != segments.length) return false;

      return segments.join('') === glob.join('');
    };
  }

  return {
    // Checks text to see if it looks like a glob.
    is: function(text) {
      return text.indexOf('*') > -1;
    },

    // Factories a glob matcher from a string
    fromString: function(text) {
      if (!this.is(text)) return null;
      return new Glob(text);
    }
  };
})();

/**
 * @ngdoc overview
 * @name ui.router.util
 *
 * @description
 * # ui.router.util sub-module
 *
 * This module is a dependency of other sub-modules. Do not include this module as a dependency
 * in your angular app (use {@link ui.router} module instead).
 *
 */
angular.module('ui.router.util', ['ng']);

/**
 * @ngdoc overview
 * @name ui.router.router
 * 
 * @requires ui.router.util
 *
 * @description
 * # ui.router.router sub-module
 *
 * This module is a dependency of other sub-modules. Do not include this module as a dependency
 * in your angular app (use {@link ui.router} module instead).
 */
angular.module('ui.router.router', ['ui.router.util']);

/**
 * @ngdoc overview
 * @name ui.router.state
 * 
 * @requires ui.router.router
 * @requires ui.router.util
 *
 * @description
 * # ui.router.state sub-module
 *
 * This module is a dependency of the main ui.router module. Do not include this module as a dependency
 * in your angular app (use {@link ui.router} module instead).
 * 
 */
angular.module('ui.router.state', ['ui.router.router', 'ui.router.util']);

/**
 * @ngdoc overview
 * @name ui.router
 *
 * @requires ui.router.state
 *
 * @description
 * # ui.router
 * 
 * ## The main module for ui.router 
 * There are several sub-modules included with the ui.router module, however only this module is needed
 * as a dependency within your angular app. The other modules are for organization purposes. 
 *
 * The modules are:
 * * ui.router - the main "umbrella" module
 * * ui.router.router - 
 * 
 * *You'll need to include **only** this module as the dependency within your angular app.*
 * 
 * <pre>
 * <!doctype html>
 * <html ng-app="myApp">
 * <head>
 *   <script src="js/angular.js"></script>
 *   <!-- Include the ui-router script -->
 *   <script src="js/angular-ui-router.min.js"></script>
 *   <script>
 *     // ...and add 'ui.router' as a dependency
 *     var myApp = angular.module('myApp', ['ui.router']);
 *   </script>
 * </head>
 * <body>
 * </body>
 * </html>
 * </pre>
 */
angular.module('ui.router', ['ui.router.state']);

angular.module('ui.router.compat', ['ui.router']);
