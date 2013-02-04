/**
 * Angular-state: Advanced UI state management / routing for AngularJS
 *
 * Copyright (C) 2013 Foxtrot Media Ltd, http://foxtrotmedia.co.nz/
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
(function () {
  'use strict';

  var angular = window.angular,
    isDefined = angular.isDefined,
    isFunction = angular.isFunction,
    isString = angular.isString,
    isObject = angular.isObject,
    forEach = angular.forEach,
    extend = angular.extend,
    copy = angular.copy;

  function inherit(parent, extra) {
    return extend(new (extend(function() {}, { prototype:parent }))(), extra);
  }

  angular.module('ngStates',  [ 'ng' ])

    .service('$templateFactory',
      [        '$http', '$templateCache', '$injector',
      function ($http,   $templateCache,   $injector) {
        this.fromString = function (template, params) {
          return isFunction(template) ? template(params) : template;
        };
        this.fromUrl = function (url, params) {
          if (isFunction(url)) url = url(params);
          if (url == null) return null;
          else return $http
              .get(url, { cache: $templateCache })
              .then(function(response) { return response.data; });
        };
        this.fromProvider = function (provider, params) {
          return $injector.invoke(provider, null, { params: params });
        };
        this.fromConfig = function (config, params) {
          return (
            isDefined(config.template) ? this.fromString(config.template, params) :
            isDefined(config.templateUrl) ? this.fromUrl(config.templateUrl, params) :
            isDefined(config.templateProvider) ? this.fromProvider(config.templateProvider, params) :
            null
          );
        };
      }])

    // Make the factory available as a provider so that other providers can use it during configuration
    .provider('$urlMatcherFactory',
      function () {
        var $urlMatcherFactory = this;

        function quoteRegExp(string) {
          return string.replace(/[\\\[\]^$*+?.()|{}]/g, "\\$&");
        }

        function UrlMatcher(pattern) {
          // Find all placeholders and create a compiled pattern
          var placeholder = /:(\w+)|\{(\w+)(?:\:((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})*))?\}/g,
              segments = [], names = {}, params = [], compiled = '^', last = 0, m;

          function addParameter(id) {
            if (!/^\w+$/.test(id)) throw new Error("Invalid parameter name '" + id + "' in pattern '" + pattern + "'");
            if (names[id]) throw new Error("Duplicate parameter name '" + id + "' in pattern '" + pattern + "'");
            names[id] = true;
            params.push(id);
          }

          while ((m = placeholder.exec(pattern)) != null) {
            var id = (m[1] != null) ? m[1] : m[2];
            var regexp = (m[3] != null) ? m[3] : '[^//]*';
            var segment = pattern.substring(last, m.index);
            if (segment.indexOf('?') >= 0) break; // we're into the search part
            compiled += quoteRegExp(segment) + '(' + regexp + ')';
            addParameter(id);
            segments.push(segment);
            last = placeholder.lastIndex;
          }
          var segment = pattern.substring(last);
          // Find any search parameter names
          var i = segment.indexOf('?');
          if (i >= 0) {
            forEach(segment.substring(i+1).split(/&/), addParameter);
            segment = segment.substring(0, i);
          }
          compiled += quoteRegExp(segment) + '$';
          segments.push(segment);
          this.regexp = new RegExp(compiled);
          this.params = params;
          this.segments = segments;
          this.source = pattern;
        }

        UrlMatcher.prototype.concat = function (pattern) {
          return $urlMatcherFactory.compile(this.source + pattern); // TODO: Handle search parameters
        };

        UrlMatcher.prototype.toString = function () {
          return this.source;
        };

        UrlMatcher.prototype.exec = function (path, searchParams) {
          var m = this.regexp.exec(path);
          if (m == null) return null;

          var params = this.params, nTotal = params.length,
            nPath = this.segments.length-1,
            values = {}, i;

          for (i=0; i<nPath; i++) values[params[i]] = decodeURIComponent(m[i+1]);
          for (/**/; i<nTotal; i++) values[params[i]] = searchParams[params[i]];

          return values;
        };

        UrlMatcher.prototype.format = function (values) {
          var segments = this.segments, params = this.params;
          if (!values) return segments.join('');

          var nPath = segments.length-1, nTotal = params.length,
            result = segments[0], i, search;

          for (i=0; i<nPath; i++) {
            var value = values[params[i]];
            if (value != null) result += value;
            result += segments[i+1];
          }
          for (/**/; i<nTotal; i++) {
            var value = values[params[i]];
            if (value != null) {
              result += (search ? '&' : '?') + params[i] + '=' + encodeURIComponent(value);
              search = true;
            }
          }

          return result;
        };


        this.compile = function (pattern) {
          return new UrlMatcher(pattern);
        };

        this.isMatcher = function (o) {
          return o instanceof UrlMatcher;
        };

        this.$get = function () {
          return $urlMatcherFactory;
        };
      })

    .provider('$urlRouter',
      [        '$urlMatcherFactoryProvider',
      function ($urlMatcherFactory) {
        var rules = [], otherwise = null;

        // Returns a string that is a prefix of all strings matching the RegExp
        function regExpPrefix(re) {
          var prefix = /^\^((?:\\[^a-zA-Z0-9]|[^\\\[\]^$*+?.()|{}]+)*)/.exec(re.source);
          return (prefix != null) ? prefix[1].replace(/\\(.)/g, "$1") : '';
        }

        // Interpolates matched values into a String.replace()-style pattern
        function interpolate(pattern, match) {
          return pattern.replace(/\$(\$|\d{1,2})/, function (m, what) {
            return match[what == '$' ? 0 : Number(what)]
          });
        }

        this.rule =
          function (rule) {
            if (!isFunction(rule)) throw new Error("'rule' must be a function");
            rules.push(rule);
            return this;
          };

        this.otherwise =
          function (rule) {
            if (isString(rule)) {
              var redirect = rule;
              rule = function () { return redirect };
            }
            else if (!isFunction(rule)) throw new Error("'rule' must be a function");
            otherwise = rule;
            return this;
          };


        function handleIfMatch($location, handler, match) {
          if (match == null) return false;
          var result = handler(match, $location);
          return isDefined(result) ? result : true;
        }

        this.when =
          function (what, handler) {
            var rule;
            if (isString(what)) what = $urlMatcherFactory.compile(what);
            if ($urlMatcherFactory.isMatcher(what)) {
              if (isString(handler)) {
                var redirect = $urlMatcherFactory.compile(handler);
                handler = function (match) { return redirect.format(match) };
              }
              else if (!isFunction(handler)) throw new Error("invalid 'handler' in when()");
              rule = function ($location) {
                return handleIfMatch($location, handler, what.exec($location.path(), $location.search()));
              };
              rule.prefix = isString(what.prefix) ? what.prefix : '';
            }
            else if (what instanceof RegExp) {
              if (isString(handler)) {
                var redirect = handler;
                handler = function (match) { return interpolate(redirect, match) };
              }
              else if (!isFunction(handler)) throw new Error("invalid 'handler' in when()");
              if (what.global || what.sticky) throw new Error("when() RegExp must not be global or sticky");
              rule = function ($location) {
                return handleIfMatch($location, handler, what.exec($location.path()));
              };
              rule.prefix = regExpPrefix(what);
            }
            else throw new Error("invalid 'what' in when()");
            return this.rule(rule);
          };

        this.$get =
          [        '$location', '$rootScope',
          function ($location,   $rootScope) {
            if (otherwise) rules.push(otherwise);

            // TODO: Optimize groups of rules with non-empty prefix into some sort of decision tree
            function update() {
              var n=rules.length, i, handled;
              for (i=0; i<n; i++) {
                if (handled = rules[i]($location)) {
                  if (isString(handled)) $location.replace().url(handled);
                  break;
                }
              }
            }

            $rootScope.$on('$locationChangeSuccess', update);
            return {};
          }];
      }])

    .value('$stateParams', {})
    .provider('$state',
      [        '$urlRouterProvider', '$urlMatcherFactoryProvider',
      function ($urlRouterProvider,   $urlMatcherFactory) {

        var root, states = {}, $state;

        function findState(stateOrName) {
          var state;
          if (isString(stateOrName)) {
            state = states[stateOrName];
            if (!state) throw new Error("No such state '" + stateOrName + "'");
          } else {
            state = states[stateOrName.name];
            if (!state || state !== stateOrName && state.self !== stateOrName) throw new Error("Invalid or unregistered state");
          }
          return state;
        }

        function stateToString() {
          return this.name;
        }

        function registerState(state) {
          // Wrap a new object around the state so we can store our private details easily.
          state = inherit(state, { self: state, toString: stateToString });

          var name = state.name;
          if (!isString(name)) throw new Error("State must have a name");
          if (states[name]) throw new Error("State '" + name + "'' is already defined");
          var parent = state.parent = state.parent ? findState(state.parent) : root;

          if (!state.urlMatcher && state.url != null) { // empty url is valid!
            if (state.url.charAt(0) == '^') {
              state.urlMatcher = $urlMatcherFactory.compile(state.url.substring(1));
            } else {
              var relativeTo = parent; while (!relativeTo.urlMatcher) relativeTo = relativeTo.parent;
              state.urlMatcher = relativeTo.urlMatcher.concat(state.url);
            }
          }

          // Figure out the parameters for this state and ensure they're a super-set of parent's parameters
          var params = state.params = state.urlMatcher ? state.urlMatcher.params : state.parent.params;
          var paramNames = {}; forEach(params, function (p) { paramNames[p] = true });
          if (parent) {
            forEach(parent.params, function (p) {
              if (!paramNames[p]) throw new Error("State '" + name + "' does not define parameter '" + p + "'");
              paramNames[p] = false;
            });
            var ownParams = state.ownParams = [];
            forEach(paramNames, function (own, p) { if (own) ownParams.push(p) });
          } else {
            state.ownParams = params;
          }

          // Also keep a full path from the root down to this state as this is needed for state activation,
          // as well as a set of all state names for fast lookup via $state.contains()
          state.path = parent ? parent.path.concat(state) : []; // exclude root from path
          var includes = state.includes = parent ? extend({}, parent.includes) : {}; includes[name] = true;
          if (!state.resolve) state.resolve = {};

          // 'locals' is the only property we add to the existing state object directly.
          state.self.locals = null;

          // Register the state in the global state list and with $urlRouter if necessary.
          if (!state.abstract && state.urlMatcher) {
            $urlRouterProvider.when(state.urlMatcher, function (params) {
              $state.transitionTo(state, params);
            });
          }

          return states[name] = state;
        }

        // Implicit root state
        root = registerState({
          name: '',
          url: '^',
          abstract: true,
        });

        // .state(state)
        // .state(name, state)
        this.state = function (name, state) {
          if (isObject(name)) state = name;
          else state.name = name;
          registerState(state);
          return this;
        };

        this.when = function (path, route) {
          route.parent = null;
          route.url = '^' + path;
          if (!route.name) route.name = 'route(' + path + ')';
          return this.state(route);
        };

        this.$get =
          [        '$stateParams', '$rootScope', '$q', '$templateFactory', '$injector',
          function ($stateParams,   $rootScope,   $q,   $templateFactory,   $injector) {

            $state = {
              params: {},
              current: root.self,
              $current: root,
              $locals: [],

              transitionTo: transitionTo,

              is: function (stateOrName) {
                return $state.$current === findState(stateOrName);
              },
              includes: function (stateOrName) {
                return $state.$current.includes[findState(stateOrName).name];
              },
            }

            function transitionTo(to, toParams) {
              to = findState(to); if (to.abstract) throw new Error("Cannot transition to abstract state '" + to + "'");
              var toPath = to.path, from = findState($state.current), fromParams = $state.params, fromPath = from.path;

              // TODO: Handle concurrent transitions -- either the earlier transition is aborted, or additional
              // transitions are rejected while a transition is in progress.

              $rootScope.$broadcast('$stateChangeStart', to.self, from.self);

              // Starting from the root of the path, keep all levels that haven't changed
              var keep, state, locals, toLocals = [];
              for (keep = 0, state = toPath[keep];
                   state && state === fromPath[keep] && equalForKeys(toParams, fromParams, state.ownParams);
                   keep++, state = toPath[keep]) {
                locals = toLocals[keep] = state.locals;
              }

              // Resolve locals for the remaining states, but don't update any states just yet
              var resolving = [];
              for (var l=keep; l<toPath.length; l++, state=toPath[l]) {
                toLocals[l] = locals = (locals ? inherit(locals, {}) : {});
                resolving.push(resolve(state, locals, toParams));
              }

              // Once everything is resolved, we are ready to perform the actual transition
              return $q.all(resolving).then(function () {
                // Exit 'from' states not kept
                for (var l=fromPath.length-1; l>=keep; l--) {
                  var exiting = fromPath[l].self;
                  if (exiting.onExit) exiting.onExit();
                  exiting.locals = null;
                }

                // Enter 'to' states not kept
                for (var l=keep; l<toPath.length; l++) {
                  var entering = toPath[l].self;
                  entering.locals = toLocals[l];
                  if (entering.onEnter) entering.onEnter();
                }

                $state.current = to.self;
                $state.params = toParams;
                $state.$current = to;
                $state.$locals = toLocals;

                copy(toParams, $stateParams);

                $rootScope.$broadcast('$stateChangeSuccess', to.self, from.self);

                return to.self;
              }, function (error) {
                $rootScope.$broadcast('$stateChangeError', to.self, from.self, error);
              });
            }

            function resolve(state, locals, $stateParams) {
              var keys = [], values = [];

              forEach(state.resolve || {}, function (value, key) {
                keys.push(key);
                values.push(isString(value)
                    ? $injector.get(value)
                    : $injector.invoke(value, { $stateParams: $stateParams }));
              });

              var template = $templateFactory.fromConfig(state, $stateParams);
              if (template != null) {
                keys.push('$template');
                values.push(template);
              }

              return $q.all(values).then(function(values) {
                forEach(values, function(value, index) {
                  locals[keys[index]] = value;
                });
                return locals;
              });
            }

            function equalForKeys(a, b, keys) {
              for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if (a[k] !== b[k]) return false;
              }
              return true;
            }

            return $state;
          }];
      }])

    .directive('ngStateView',
      [        '$state', '$anchorScroll', '$compile', '$controller',
      function ($state,   $anchorScroll,   $compile,   $controller) {
        return {
          restrict: 'ECA',
          terminal: true,
          link: function(scope, element, attr) {
            var lastScope, lastLocals,
              level = attr.level || 0, // TODO: Find a better mechanism for this, either implicit or a name, not a numeric level
              onloadExp = attr.onload || '';
              
            scope.$on('$stateChangeSuccess', update);
            update();

            function destroyLastScope() {
              if (lastScope) {
                lastScope.$destroy();
                lastScope = null;
              }
            }

            function clearContent() {
              element.html('');
              destroyLastScope();
            }

            function update() {
              if ($state.$current) {
                var state = $state.$current.path[level];
                var locals = $state.$locals[level];
                if (state) {
                  if (locals === lastLocals) return; // nothing to do
                  lastLocals = locals;
                  var template = locals.$template;
                  if (template) {
                    element.html(template);
                    destroyLastScope();

                    var link = $compile(element.contents());
                    lastScope = scope.$new();
                    if (state.controller) {
                      locals.$scope = lastScope;
                      var controller = $controller(state.controller, locals);
                      element.contents().data('$ngControllerController', controller);
                    }
                    // TODO: Does it make sense to bind parameters in scope?
                    // forEach(state.ownParamNames, function (name) {
                    //   lastScope[name] = current.params[name];
                    // });

                    link(lastScope);
                    lastScope.$emit('$viewContentLoaded');
                    lastScope.$eval(onloadExp);

                    // TODO: This seems strange, shouldn't $anchorScroll listen for $viewContentLoaded if necessary?
                    // $anchorScroll might listen on event...
                    $anchorScroll();
                    return;
                  }
                }
                clearContent();
              }
            }
          },
        };
      }]);
})();
