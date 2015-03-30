describe('state', function () {

  var stateProvider, locationProvider, templateParams, ctrlName;

  beforeEach(module('ui.router', function($locationProvider) {
    locationProvider = $locationProvider;
    $locationProvider.html5Mode(false);
  }));

  var log, logEvents, logEnterExit;
  function eventLogger(event, to, toParams, from, fromParams) {
    if (logEvents) log += event.name + '(' + to.name + ',' + from.name + ');';
  }
  function callbackLogger(what) {
    return function () {
      if (logEnterExit) log += this.name + '.' + what + ';';
    };
  }

  var A = { data: {}, controller: function() { log += "controller;"; } },
      B = {},
      C = {},
      D = { params: { x: null, y: null } },
      DD = { parent: D, params: { x: null, y: null, z: null } },
      DDDD = { parent: D, controller: function() {}, template: "hey"},
      E = { params: { i: {} } },
      H = { data: {propA: 'propA', propB: 'propB'} },
      HH = { parent: H },
      HHH = {parent: HH, data: {propA: 'overriddenA', propC: 'propC'} },
      RS = { url: '^/search?term', reloadOnSearch: false },
      OPT = { url: '/opt/:param', params: { param: "100" } },
      OPT2 = { url: '/opt2/:param2/:param3', params: { param3: "300", param4: "400" } },
      AppInjectable = {};

  beforeEach(module(function ($stateProvider, $provide) {
    angular.forEach([ A, B, C, D, DD, E, H, HH, HHH ], function (state) {
      state.onEnter = callbackLogger('onEnter');
      state.onExit = callbackLogger('onExit');
    });
    stateProvider = $stateProvider;

    $stateProvider
      .state('A', A)
      .state('B', B)
      .state('C', C)
      .state('D', D)
      .state('DD', DD)
      .state('DDDD', DDDD)
      .state('E', E)
      .state('H', H)
      .state('HH', HH)
      .state('HHH', HHH)
      .state('OPT', OPT)
      .state('OPT.OPT2', OPT2)
      .state('RS', RS)

      .state('home', { url: "/" })
      .state('home.item', { url: "front/:id" })
      .state('about', { url: "/about" })
      .state('about.person', { url: "/:person" })
      .state('about.person.item', { url: "/:id" })
      .state('about.sidebar', {})
      .state('about.sidebar.item', {
        url: "/:item",
        templateUrl: function(params) {
          templateParams = params;
          return "/templates/" + params.item + ".html";
        }
      })
      .state('dynamicController', {
        url: "/dynamic/:type",
        template: "test",
        controllerProvider: function($stateParams) {
          ctrlName = $stateParams.type + "Controller";
          return ctrlName;
        }
      })
      .state('home.redirect', {
        url: "redir",
        onEnter: function($state) {
          $state.transitionTo("about");
        }
      })
      .state('resolveFail', {
        url: "/resolve-fail",
        resolve: {
          badness: function($q) {
            return $q.reject("!");
          }
        }
      })
      .state('resolveTimeout', {
        url: "/:foo",
        resolve: {
          value: function ($timeout) {
            return $timeout(function() { log += "Success!"; }, 1);
          }
        },
        controller: function() { log += "controller;"}
      })
      .state('badParam', {
        url: "/bad/{param:int}"
      })
      .state('badParam2', {
        url: "/bad2/{param:[0-9]{5}}"
      })

      .state('json', { url: '/jsonstate/{param:json}' })

      .state('first', { url: '^/first/subpath' })
      .state('second', { url: '^/second' })

      // State param inheritance tests. param1 is inherited by sub1 & sub2;
      // param2 should not be transferred (unless explicitly set).
      .state('root', { url: '^/root?param1' })
      .state('root.sub1', {url: '/1?param2' })
      .state('logA', {
        url: "/logA",
        template: "<div> <div ui-view/></div>",
        controller: function() {log += "logA;"}
      })
      .state('logA.logB', {
        url: "/logB",
        views:{
          '':{
                template: "<div> <div ui-view/></div>",
                controller: function() {log += "logB;"}
          }
        }
      })
      .state('logA.logB.logC', {
        url: "/logC",
        views:{
          '':{
                template: "<div> <div ui-view/></div>",
                controller: function() {log += "logC;"}
          }
        }
      })
    $stateProvider.state('root.sub2', {url: '/2?param2' });

    $provide.value('AppInjectable', AppInjectable);
  }));

  beforeEach(inject(function ($rootScope) {
    log = '';
    logEvents = logEnterExit = false;
    $rootScope.$on('$stateChangeStart', eventLogger);
    $rootScope.$on('$stateChangeCancel', eventLogger);
    $rootScope.$on('$stateChangeSuccess', eventLogger);
    $rootScope.$on('$stateChangeError', eventLogger);
    $rootScope.$on('$stateNotFound', eventLogger);
  }));


  function $get(what) {
    return jasmine.getEnv().currentSpec.$injector.get(what);
  }

  function initStateTo(state, optionalParams) {
    var $state = $get('$state'), $q = $get('$q');
    $state.transitionTo(state, optionalParams || {});
    $q.flush();
    expect($state.current).toBe(state);
  }

  describe('provider', function () {
    it ('should ignore Object properties when registering states', function () {
      expect(function() {
        stateProvider.state('toString', { url: "/to-string" });
      }).not.toThrow();
      expect(function() {
        stateProvider.state('watch', { url: "/watch" });
      }).not.toThrow();
    });
  });

  describe('.transitionTo()', function () {
    it('returns a promise for the target state', inject(function ($state, $q) {
      var trans = $state.transitionTo(A, {});
      $q.flush();
      expect(resolvedValue(trans)).toBe(A);
    }));

    it('allows transitions by name', inject(function ($state, $q) {
      $state.transitionTo('A', {});
      $q.flush();
      expect($state.current).toBe(A);
    }));

    it('doesn\'t trigger state change if reloadOnSearch is false', inject(function ($state, $q, $location, $rootScope){
      initStateTo(RS);
      $location.search({term: 'hello'});
      var called;
      $rootScope.$on('$stateChangeStart', function (ev, to, toParams, from, fromParams) {
        called = true
      });
      $q.flush();
      expect($location.search()).toEqual({term: 'hello'});
      expect(called).toBeFalsy();        
    }));

    it('ignores non-applicable state parameters', inject(function ($state, $q) {
      $state.transitionTo('A', { w00t: 'hi mom!' });
      $q.flush();
      expect($state.current).toBe(A);
    }));

    it('triggers $stateChangeStart', inject(function ($state, $q, $rootScope) {
      initStateTo(E, { i: 'iii' });
      var called;
      $rootScope.$on('$stateChangeStart', function (ev, to, toParams, from, fromParams) {
        expect(from).toBe(E);
        expect(fromParams).toEqual({ i: 'iii' });
        expect(to).toBe(D);
        expect(toParams).toEqual({ x: '1', y: '2' });

        expect($state.current).toBe(from); // $state not updated yet
        expect($state.params).toEqual(fromParams);
        called = true;
      });
      $state.transitionTo(D, { x: '1', y: '2' });
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toBe(D);
    }));

    it('can be cancelled by preventDefault() in $stateChangeStart', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called;
      $rootScope.$on('$stateChangeStart', function (ev) {
        ev.preventDefault();
        called = true;
      });
      var promise = $state.transitionTo(B, {});
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toBe(A);
      expect(resolvedError(promise)).toBeTruthy();
    }));

    it('can be cancelled by preventDefault() in $stateChangeStart and broadcasts $stateChangeCancel', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called, cancelEventCalled;
      $rootScope.$on('$stateChangeStart', function (ev) {
        ev.preventDefault();
        called = true;
      });
      $rootScope.$on('$stateChangeCancel', function (ev) {
        ev.preventDefault();
        cancelEventCalled = true;
      });
      var promise = $state.transitionTo(B, {});
      $q.flush();
      expect(called).toBeTruthy();
      expect(cancelEventCalled).toBeTruthy();
      expect($state.current).toBe(A);
      expect(resolvedError(promise)).toBeTruthy();
    }));

    it('triggers $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(E, { i: 'iii' });
      var called;
      $rootScope.$on('$stateNotFound', function (ev, redirect, from, fromParams) {
        expect(from).toBe(E);
        expect(fromParams).toEqual({ i: 'iii' });
        expect(redirect.to).toEqual('never_defined');
        expect(redirect.toParams).toEqual({ x: '1', y: '2' });

        expect($state.current).toBe(from); // $state not updated yet
        expect($state.params).toEqual(fromParams);
        called = true;
      });
      var message;
      try {
        $state.transitionTo('never_defined', { x: '1', y: '2' });
      } catch(err) {
        message = err.message;
      }
      $q.flush();
      expect(message).toEqual('No such state \'never_defined\'');
      expect(called).toBeTruthy();
      expect($state.current).toBe(E);
    }));

    it('can be cancelled by preventDefault() in $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called;
      $rootScope.$on('$stateNotFound', function (ev) {
        ev.preventDefault();
        called = true;
      });
      var promise = $state.transitionTo('never_defined', {});
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toBe(A);
      expect(resolvedError(promise)).toBeTruthy();
    }));

    it('can be redirected in $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called;
      $rootScope.$on('$stateNotFound', function (ev, redirect) {
        redirect.to = D;
        redirect.toParams = { x: '1', y: '2' };
        called = true;
      });
      var promise = $state.transitionTo('never_defined', { z: 3 });
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toBe(D);
      expect($state.params).toEqual({ x: '1', y: '2' });
    }));

    it('can lazy-define a state in $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(DD, { x: "1", y: "2", z: "3" });
      var called;
      $rootScope.$on('$stateNotFound', function (ev, redirect) {
        stateProvider.state(redirect.to, { parent: DD, params: { x: {}, y: {}, z: {}, w: {} }});
        called = true;
      });
      var promise = $state.go('DDD', { w: "4" });
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current.name).toEqual('DDD');
      expect($state.params).toEqual({ x: "1", y: "2", z: "3", w: "4" });
    }));

    it('can defer a state transition in $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called;
      var deferred = $q.defer();
      $rootScope.$on('$stateNotFound', function (ev, redirect) {
        ev.retry = deferred.promise;
        called = true;
      });
      var promise = $state.go('AA', { a: "1" });
      stateProvider.state('AA', { parent: A, params: { a: {} }});
      deferred.resolve();
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current.name).toEqual('AA');
      expect($state.params).toEqual({ a: "1" });
    }));

    it('can defer and supersede a state transition in $stateNotFound', inject(function ($state, $q, $rootScope) {
      initStateTo(A);
      var called;
      var deferred = $q.defer();
      $rootScope.$on('$stateNotFound', function (ev, redirect) {
        ev.retry = deferred.promise;
        called = true;
      });
      var promise = $state.go('AA', { a: 1 });
      $state.go(B);
      stateProvider.state('AA', { parent: A, params: { a: {} }});
      deferred.resolve();
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toEqual(B);
      expect($state.params).toEqual({});
    }));

    it('triggers $stateChangeSuccess', inject(function ($state, $q, $rootScope) {
      initStateTo(E, { i: 'iii' });
      var called;
      $rootScope.$on('$stateChangeSuccess', function (ev, to, toParams, from, fromParams) {
        expect(from).toBe(E);
        expect(fromParams).toEqual({ i: 'iii' });
        expect(to).toBe(D);
        expect(toParams).toEqual({ x: '1', y: '2' });

        expect($state.current).toBe(to); // $state has been updated
        expect($state.params).toEqual(toParams);
        called = true;
      });
      $state.transitionTo(D, { x: '1', y: '2' });
      $q.flush();
      expect(called).toBeTruthy();
      expect($state.current).toBe(D);
    }));

    it('does not trigger $stateChangeSuccess or $viewContentLoading when suppressed, but changes state', inject(function ($state, $q, $rootScope, $httpBackend) {
      initStateTo(E, { i: 'iii' });
      var called;

      $rootScope.$on('$stateChangeSuccess', function () { called = true; });
      $rootScope.$on('$viewContentLoading', function (evt, foo) { called = true; });
      $state.transitionTo(DDDD, {}, { notify: false });
      $q.flush();

      expect(called).toBeFalsy();
      expect($state.current).toBe(DDDD);
    }));

    it('does not trigger $stateChangeSuccess when suppressed, but updates params', inject(function ($state, $q, $rootScope) {
      initStateTo(E, { x: 'iii' });
      var called;

      $rootScope.$on('$stateChangeSuccess', function () { called = true; });
      $state.transitionTo(E, { i: '1', y: '2' }, { notify: false });
      $q.flush();

      expect(called).toBeFalsy();
      expect($state.params.i).toBe('1');
      expect($state.current).toBe(E);
    }));

    it('is a no-op when passing the current state and identical parameters', inject(function ($state, $q) {
      initStateTo(A);
      var trans = $state.transitionTo(A, {}); // no-op
      expect(trans).toBeDefined(); // but we still get a valid promise
      $q.flush();
      expect(resolvedValue(trans)).toBe(A);
      expect($state.current).toBe(A);
      expect(log).toBe('');
    }));

    it('aborts pending transitions (last call wins)', inject(function ($state, $q) {
      initStateTo(A);
      logEvents = true;

      var superseded = $state.transitionTo(B, {});
      $state.transitionTo(C, {});
      $q.flush();
      expect($state.current).toBe(C);
      expect(resolvedError(superseded)).toBeTruthy();
      expect(log).toBe(
        '$stateChangeStart(B,A);' +
        '$stateChangeStart(C,A);' +
        '$stateChangeSuccess(C,A);');
    }));

    it('aborts pending transitions even when going back to the current state', inject(function ($state, $q) {
      initStateTo(A);
      logEvents = true;

      var superseded = $state.transitionTo(B, {});
      $state.transitionTo(A, {});
      $q.flush();
      expect($state.current).toBe(A);
      expect(resolvedError(superseded)).toBeTruthy();
      expect(log).toBe('$stateChangeStart(B,A);');
    }));

    it('aborts pending transitions when aborted from callbacks', inject(function ($state, $q) {
      var superseded = $state.transitionTo('home.redirect');
      $q.flush();
      expect($state.current.name).toBe('about');
    }));

    it('triggers onEnter and onExit callbacks', inject(function ($state, $q) {
      initStateTo(A);
      logEnterExit = true;
      $state.transitionTo(D, {}); $q.flush();
      log += $state.current.name + ';';
      $state.transitionTo(DD, {}); $q.flush();
      log += $state.current.name + ';';
      $state.transitionTo(A, {}); $q.flush();
      expect(log).toBe(
        'A.onExit;' +
        'D.onEnter;' +
        'D;' +
        'DD.onEnter;' +
        'DD;' +
        'DD.onExit;' +
        'D.onExit;' +
        'A.onEnter;');
    }));

    it('doesn\'t transition to parent state when child has no URL', inject(function ($state, $q) {
      $state.transitionTo('about.sidebar'); $q.flush();
      expect($state.current.name).toEqual('about.sidebar');
    }));

    it('notifies on failed relative state resolution', inject(function ($state, $q) {
      $state.transitionTo(DD);
      $q.flush();

      var err = "Could not resolve '^.Z' from state 'DD'";
      expect(function() { $state.transitionTo("^.Z", null, { relative: $state.$current }); }).toThrow(err);
    }));

    it('uses the controllerProvider to get controller dynamically', inject(function ($state, $q) {
      $state.transitionTo('dynamicController', { type: "Acme" });
      $q.flush();
      expect(ctrlName).toEqual("AcmeController");
    }));
  });

  describe('.go()', function () {
    it('transitions to a relative state', inject(function ($state, $q) {
      $state.transitionTo('about.person.item', { person: "bob", id: 5 }); $q.flush();
      $state.go('^.^.sidebar'); $q.flush();
      expect($state.$current.name).toBe('about.sidebar');

      // Transitions to absolute state
      $state.go("home"); $q.flush();
      expect($state.$current.name).toBe('home');


      // Transition to a child state
      $state.go(".item", { id: 5 }); $q.flush();
      expect($state.$current.name).toBe('home.item');

      // Transition to grandparent's sibling through root
      // (Equivalent to absolute transition, assuming the root is known).
      $state.go("^.^.about"); $q.flush();
      expect($state.$current.name).toBe('about');

      // Transition to grandchild
      $state.go(".person.item", { person: "bob", id: 13 }); $q.flush();
      expect($state.$current.name).toBe('about.person.item');

      // Transition to immediate parent
      $state.go("^"); $q.flush();
      expect($state.$current.name).toBe('about.person');

      // Transition to sibling
      $state.go("^.sidebar"); $q.flush();
      expect($state.$current.name).toBe('about.sidebar');
    }));

    it('keeps parameters from common ancestor states', inject(function ($state, $stateParams, $q) {
      $state.transitionTo('about.person', { person: 'bob' });
      $q.flush();

      $state.go('.item', { id: "5" });
      $q.flush();

      expect($state.$current.name).toBe('about.person.item');
      expect($stateParams).toEqual({ person: 'bob', id: "5" });

      $state.go('^.^.sidebar');
      $q.flush();
      expect($state.$current.name).toBe('about.sidebar');
    }));
  });

  describe('.reload()', function () {
   it('returns a promise for the state transition', inject(function ($state, $q) {
      var trans = $state.transitionTo(A, {});
      $q.flush();
      expect(resolvedValue(trans)).toBe(A);

      trans = $state.reload();
      $q.flush();
      expect(resolvedValue(trans)).toBe(A);
    }));

    it('should reload the current state with the current parameters', inject(function ($state, $q, $timeout) {
      $state.transitionTo('resolveTimeout', { foo: "bar" });
      $q.flush();
      expect(log).toBe('');

      $timeout.flush();
      expect(log).toBe('Success!');

      $state.reload();
      $q.flush();
      $timeout.flush();
      expect(log).toBe('Success!Success!');
    }));

    it('should invoke the controller', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/> </div>')($rootScope);
      $state.transitionTo('resolveTimeout', { foo: "bar" });
      $timeout.flush();
      $q.flush();
      expect(log).toBe('Success!controller;');

      $state.reload();
      $timeout.flush();
      $q.flush();
      expect(log).toBe('Success!controller;Success!controller;');
    }));

    it('should invoke the controllers by state when given state name', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      log = '';
      $state.reload('logA');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      log = '';
      $state.reload('logA.logB');
      $q.flush();
      expect(log).toBe('logB;logC;');

      log = '';
      $state.reload('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logC;');
    }));

    it('should reload all states when passing false', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      log = '';
      $state.reload(false);
      $q.flush();
      expect(log).toBe('logA;logB;logC;');
    }));

    it('should reload all states when passing true', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      log = '';
      $state.reload(true);
      $q.flush();
      expect(log).toBe('logA;logB;logC;');
    }));


    it('should invoke the controllers by state when given stateObj', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');

      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      log = '';
      $state.reload($state.current);
      $q.flush();
      expect(log).toBe('logC;');
    }));

    it('should throw an exception for invalid reload state name', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      expect(function(){
          $state.reload('logInvalid')}
        ).toThrow("No such reload state 'logInvalid'");
    }));

    it('should throw an exception for invalid reload state object', inject(function ($state, $q, $timeout, $rootScope, $compile) {
      $compile('<div> <div ui-view/></div>')($rootScope);
      $state.transitionTo('logA.logB.logC');
      $q.flush();
      expect(log).toBe('logA;logB;logC;');

      expect(function(){
          $state.reload({foo:'bar'})}
        ).toThrow("Invalid reload state object");

      expect(function(){
          $state.reload({name:'invalidState'})}
        ).toThrow("No such reload state 'invalidState'");
    }));
  });

  describe('.is()', function () {
    it('should return true when the current state is passed', inject(function ($state, $q) {
      $state.transitionTo(A); $q.flush();
      expect($state.is(A)).toBe(true);
      expect($state.is(A, null)).toBe(true);
      expect($state.is('A')).toBe(true);
      expect($state.is(B)).toBe(false);
    }));

    it('should return undefined when queried state does not exist', inject(function ($state) {
      expect($state.is('Z')).toBeUndefined();
    }));

    it('should return true when the current state is passed with matching parameters', inject(function ($state, $q) {
      $state.transitionTo(D, {x: 'foo', y: 'bar'}); $q.flush();
      expect($state.is(D)).toBe(true);
      expect($state.is(D, {x: 'foo', y: 'bar'})).toBe(true);
      expect($state.is('D', {x: 'foo', y: 'bar'})).toBe(true);
      expect($state.is(D, {x: 'bar', y: 'foo'})).toBe(false);
    }));

    it('should work for relative states', inject(function ($state, $q) {
      var options = { relative: $state.get('about') };
      
      $state.transitionTo('about.person'); $q.flush();
      expect($state.is('.person', undefined, options)).toBe(true);

      $state.transitionTo('about.person', { person: 'bob' }); $q.flush();
      expect($state.is('.person', { person: 'bob' }, options)).toBe(true);
      expect($state.is('.person', { person: 'john' }, options)).toBe(false);

      options.relative = $state.get('about.person.item');
      expect($state.is('^', undefined, options)).toBe(true);
    }));
  });

  describe('.includes()', function () {
    it('should return true when the current state is passed', inject(function ($state, $q) {
      $state.transitionTo(A); $q.flush();
      expect($state.includes(A)).toBe(true);
      expect($state.includes('A')).toBe(true);
      expect($state.includes(B)).toBe(false);
    }));

    it('should return true when the current state\'s parent is passed', inject(function ($state, $q) {
      $state.transitionTo('about.person.item'); $q.flush();
      expect($state.includes('about')).toBe(true);
      expect($state.includes('about.person')).toBe(true);
      expect($state.includes('about.sidebar')).toBe(false);
    }));

    it('should return undefined when queried state does not exist', inject(function ($state) {
      expect($state.includes('Z')).toBeUndefined();
    }));

    it('should return true when the current state is passed with partial matching parameters', inject(function ($state, $q) {
      $state.transitionTo(D, {x: 'foo', y: 'bar'}); $q.flush();
      expect($state.includes(D, {x: 'foo'})).toBe(true);
      expect($state.includes(D, {y: 'bar'})).toBe(true);
      expect($state.includes('D', {x: 'foo'})).toBe(true);
      expect($state.includes(D, {y: 'foo'})).toBe(false);
    }));

    it('should return true when the current state is passed with partial matching parameters from state\'s parent', inject(function ($state, $q) {
      $state.transitionTo('about.person.item', {person: 'bob', id: 5}); $q.flush();
      expect($state.includes('about.person', {person: 'bob'})).toBe(true);
      expect($state.includes('about.person', {person: 'steve'})).toBe(false);
    }));

    it('should return true when the current state is passed with partial glob patterns', inject(function ($state, $q) {
      $state.transitionTo('about.person.item', {person: 'bob', id: 5}); $q.flush();
      expect($state.includes('*.person.*')).toBe(true);
      expect($state.includes('*.person.**')).toBe(true);
      expect($state.includes('**.item.*')).toBe(false);
      expect($state.includes('**.item')).toBe(true);
      expect($state.includes('**.stuff.*')).toBe(false);
      expect($state.includes('*.*.*')).toBe(true);
      expect($state.includes('about.*.*')).toBe(true);
      expect($state.includes('about.**')).toBe(true);
      expect($state.includes('about.*.**')).toBe(true);
      expect($state.includes('*.about.*')).toBe(false);
      expect($state.includes('about.*.*', {person: 'bob'})).toBe(true);
      expect($state.includes('about.*.*', {person: 'shawn'})).toBe(false);
    }));

    it('should work for relative states', inject(function ($state, $q) {
      $state.transitionTo('about.person.item', { person: 'bob', id: 5 }); $q.flush();

      expect($state.includes('.person', undefined, { relative: 'about' } )).toBe(true);
      expect($state.includes('.person', null, { relative: 'about' } )).toBe(true);

      expect($state.includes('^', undefined, { relative: $state.get('about.person.item') })).toBe(true);

      expect($state.includes('.person', { person: 'bob' }, { relative: $state.get('about') } )).toBe(true);
      expect($state.includes('.person', { person: 'steve' }, { relative: $state.get('about') } )).toBe(false);
    }));
  });

  describe('.current', function () {
    it('is always defined', inject(function ($state) {
      expect($state.current).toBeDefined();
    }));

    it('updates asynchronously as the transitionTo() promise is resolved', inject(function ($state, $q) {
      var trans = $state.transitionTo(A, {});
      expect($state.current).not.toBe(A);
      $q.flush();
      expect($state.current).toBe(A);
    }));
  });

  describe('$current', function () {
    it('is always defined', inject(function ($state) {
      expect($state.$current).toBeDefined();
    }));

    it('wraps the raw state object', inject(function ($state) {
      initStateTo(A);
      expect($state.$current.data).toBe(A.data); // 'data' is reserved for app use
    }));
  });


  describe('.params', function () {
    it('is always defined', inject(function ($state) {
      expect($state.params).toBeDefined();
      expect(angular.isObject($state.params)).toBe(true);
    }));

    it('contains the parameter values for the current state', inject(function ($state, $q) {
      initStateTo(D, { x: 'x value', z: 'invalid value' });
      expect($state.params).toEqual({ x: 'x value', y: null });
    }));
  });


  describe('.transition', function () {
    it('is null when no transition is taking place', inject(function ($state, $q) {
      expect($state.transition).toBeNull();
      $state.transitionTo(A, {});
      $q.flush();
      expect($state.transition).toBeNull();
    }));

    it('is the current transition', inject(function ($state, $q) {
      var trans = $state.transitionTo(A, {});
      expect($state.transition).toBe(trans);
    }));
  });


  describe('.href()', function () {
    it('aborts on un-navigable states', inject(function ($state) {
      expect($state.href("A")).toBeNull();
      expect($state.href("about.sidebar", null, { lossy: false })).toBeNull();
    }));

    it('generates a parent state URL when lossy is true', inject(function ($state) {
      expect($state.href("about.sidebar", null, { lossy: true })).toEqual("#/about");
    }));

    it('generates a URL without parameters', inject(function ($state) {
      expect($state.href("home")).toEqual("#/");
      expect($state.href("about", {})).toEqual("#/about");
      expect($state.href("about", { foo: "bar" })).toEqual("#/about");
    }));

    it('generates a URL with parameters', inject(function ($state) {
      expect($state.href("about.person", { person: "bob" })).toEqual("#/about/bob");
      expect($state.href("about.person.item", { person: "bob", id: null })).toEqual("#/about/bob/");
    }));

    it('inherit url parameters from current url', inject(function ($state) {
      initStateTo($state.get('root'), {param1: 1});
      expect($state.href("root", {}, {})).toEqual("#/root?param1=1");
      expect($state.href("root", {}, {inherit:false})).toEqual("#/root");
      expect($state.href("root", {}, {inherit:true})).toEqual("#/root?param1=1");
    }));
    
    it('generates absolute url when absolute is true', inject(function ($state) {
      expect($state.href("about.sidebar", null, { absolute: true })).toEqual("http://server/#/about");
      locationProvider.html5Mode(true);
      expect($state.href("about.sidebar", null, { absolute: true })).toEqual("http://server/about");
    }));

    it('respects $locationProvider.hashPrefix()', inject(function ($state) {
      locationProvider.hashPrefix("!");
      expect($state.href("home")).toEqual("#!/");
    }));

    describe('when $browser.baseHref() exists', function() {
      beforeEach(inject(function($browser) {
        spyOn($browser, 'baseHref').andCallFake(function() {
          return '/base/';
        });
      }));

      it('does not prepend relative urls', inject(function($state) {
        expect($state.href("home")).toEqual("#/");
      }));

      it('prepends absolute urls', inject(function($state) {
        expect($state.href("home", null, { absolute: true })).toEqual("http://server/base/#/");
      }));

      it('prepends relative and absolute urls in html5Mode', inject(function($state) {
        locationProvider.html5Mode(true);
        expect($state.href("home")).toEqual("/base/");
        expect($state.href("home", null, { absolute: true })).toEqual("http://server/base/");
      }));
    });
  });

  describe('.get()', function () {
    it("should return the state's config", inject(function ($state) {
      expect($state.get('home').url).toBe('/');
      expect($state.get('home.item').url).toBe('front/:id');
      expect($state.get('A')).toBe(A);
      expect($state.get('Z')).toBeNull();
    }));

    it("should return all of the state's config", inject(function ($state) {
      var list = $state.get().sort(function(a, b) { return (a.name > b.name) - (b.name > a.name); });
      var names = [
        '', // implicit root state
        'A',
        'B',
        'C',
        'D',
        'DD',
        'DDDD',
        'E',
        'H',
        'HH',
        'HHH',
        'OPT',
        'OPT.OPT2',
        'RS',
        'about',
        'about.person',
        'about.person.item',
        'about.sidebar',
        'about.sidebar.item',
        'badParam',
        'badParam2',
        'dynamicController',
        'first',
        'home',
        'home.item',
        'home.redirect',
        'json',
        'logA',
        'logA.logB',
        'logA.logB.logC',
        'resolveFail',
        'resolveTimeout',
        'root',
        'root.sub1',
        'root.sub2',
        'second'
      ];
      expect(list.map(function(state) { return state.name; })).toEqual(names);
    }));

    it('should work for relative states', inject(function ($state) {
      var about = $state.get('about');

      var person = $state.get('.person', about);
      expect(person.url).toBe('/:person');
      expect($state.get('^', 'about.person').url).toBe('/about');

      var item = $state.get('.person.item', about);
      expect(item.url).toBe('/:id');
      expect($state.get('^.^', item).url).toBe('/about');
    }));

    it("should return undefined on invalid state query", inject(function ($state) {
      expect($state.get(null)).toBeNull();
      expect($state.get(false)).toBeNull();
      expect($state.get(undefined)).toBeNull();
    }));
  });

  describe('optional parameters', function() {
    it("should be populated during transition, if unspecified", inject(function($state, $q) {
      var stateParams;
      $state.get("OPT").onEnter = function($stateParams) { stateParams = $stateParams; };
      $state.go("OPT"); $q.flush();
      expect($state.current.name).toBe("OPT");
      expect($state.params).toEqual({ param: "100" });
      expect(stateParams).toEqual({ param: "100" });
    }));

    it("should allow null default value for non-url params", inject(function($state, $q) {
      $state.go("D"); $q.flush();
      expect($state.current.name).toBe("D");
      expect($state.params).toEqual({ x: null, y: null });
    }));

    it("should allow arbitrary objects to pass for non-url params", inject(function($state, $q) {
      $state.go("D", { x: 100, y: { foo: 'bar' } }); $q.flush();
      expect($state.current.name).toBe("D");
      expect($state.params).toEqual({ x: 100, y: { foo: 'bar' } });
    }));

    it("should be populated during primary transition, if unspecified", inject(function($state, $q) {
      var count = 0;
      $state.get("OPT").onEnter = function($stateParams) { count++; };
      $state.go("OPT"); $q.flush();
      expect($state.current.name).toBe("OPT");
      expect($state.params).toEqual({ param: "100" });
      expect(count).toEqual(1);
    }));

    it("should allow mixed URL and config params", inject(function($state, $q) {
      var count = 0;
      $state.get("OPT").onEnter =      function($stateParams) { count++; };
      $state.get("OPT.OPT2").onEnter = function($stateParams) { count++; };
      $state.go("OPT"); $q.flush();
      expect($state.current.name).toBe("OPT");
      expect($state.params).toEqual({ param: "100" });
      expect(count).toEqual(1);

      $state.go("OPT.OPT2", { param2: 200 }); $q.flush();
      expect($state.current.name).toBe("OPT.OPT2");
      expect($state.params).toEqual({ param: "100", param2: "200", param3: "300", param4: "400" });
      expect(count).toEqual(2);
    }));
  });

  // TODO: Enforce by default in next major release (1.0.0)
  xdescribe('non-optional parameters', function() {
    it("should cause transition failure, when unspecified.", inject(function($state, $q) {
      var count = 0;
      $state.get("OPT").onEnter =      function() { count++; };
      $state.get("OPT.OPT2").onEnter = function() { count++; };
      $state.go("OPT"); $q.flush();
      expect($state.current.name).toBe("OPT");
      expect($state.params).toEqual({ param: "100" });
      expect(count).toEqual(1);

      var result;
      $state.go("OPT.OPT2").then(function(data) { result = data; });
      $q.flush();
      expect($state.current.name).toBe("OPT");
      expect($state.params).toEqual({ param: "100" });
      expect(result).toEqual("asdfasdf");
      expect(count).toEqual(1);
    }));
  });

  describe('url handling', function () {
    it('should transition to the same state with different parameters', inject(function ($state, $rootScope, $location) {
      $location.path("/about/bob");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();
      expect($state.params).toEqual({ person: "bob" });
      expect($state.current.name).toBe('about.person');

      $location.path("/about/larry");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();
      expect($state.params).toEqual({ person: "larry" });
      expect($state.current.name).toBe('about.person');
    }));

    it('preserve hash', inject(function($state, $rootScope, $location) {
      $location.path("/about/bob");
      $location.hash("frag");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();
      expect($state.params).toEqual({ person: "bob" });
      expect($state.current.name).toBe('about.person');
      expect($location.path()).toBe('/about/bob');
      expect($location.hash()).toBe('frag');
    }));

    it('should correctly handle absolute urls', inject(function ($state, $rootScope, $location) {
      $location.path("/first/subpath");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();
      expect($state.current.name).toBe('first');

      $state.transitionTo('second');
      $rootScope.$apply();
      expect($state.current.name).toBe('second');
      expect($location.path()).toBe('/second');
    }));

    it('should ignore bad urls', inject(function ($state, $rootScope, $location) {
      $location.path("/first/second");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();
      expect($state.current.name).toBe('');
    }));

    describe("typed parameter handling", function() {
      beforeEach(function () {
        stateProvider.state({
          name: "types",
          url: "/types/{p1:string}/{p2:date}",
          params: {
            p1: { value: [ "defaultValue" ], array: true },
            p2: new Date(2014, 10, 15),
            nonurl: null
          }
        });
        stateProvider.state({
          name: "types.substate",
          url: "/sub/{p3[]:int}/{p4:json}?{p5:bool}",
          params: {
            "p3[]": [ 10 ]
          }
        });
      });

      it('should initialize parameters without a hacky empty test', inject(function ($urlMatcherFactory, $state) {
        new UrlMatcher("");
      }));

      it('should ignore bad url parameters', inject(function ($state, $rootScope, $location, $urlMatcherFactory) {
        $location.path("/bad/5");
        $rootScope.$broadcast("$locationChangeSuccess");
        $rootScope.$apply();
        expect($state.current.name).toBe("badParam");

        $state.transitionTo("about");
        $rootScope.$apply();
        expect($state.current.name).toBe('about');

        $location.path("/bad/foo");
        $rootScope.$broadcast("$locationChangeSuccess");
        $rootScope.$apply();
        expect($state.current.name).toBe("about");
      }));

      it('should ignore bad state parameters', inject(function ($state, $rootScope, $location, $stateParams) {
        $state.go("badParam", { param: 5 });
        $rootScope.$apply();
        expect($state.current.name).toBe("badParam");
        expect($stateParams).toEqual({param: 5});

        $state.go("badParam2", { param: '12345' }); // must be 5 digits
        $rootScope.$apply();
        expect($state.current.name).toBe("badParam2");

        $state.go("about");
        $rootScope.$apply();
        expect($state.current.name).toBe('about');

        $state.go("badParam", { param: 'foo' });
        $rootScope.$apply();
        expect($state.current.name).toBe("about");

        $state.go("badParam2", { param: '1234' }); // must be 5 digits
        $rootScope.$apply();
        expect($state.current.name).toBe("about");
      }));

      function expectStateUrlMappingFn($state, $rootScope, $q, $location) {
        return function (state, url, params, defaults, nonurlparams) {
          $state.go(state, extend({}, nonurlparams, params));
          $q.flush();

          expect($state.current.name).toBe(state.name || state); // allow object
          expect($state.params).toEqual(extend({}, defaults, params, nonurlparams));
          expect($location.url()).toBe(url);

          initStateTo(A);

          $location.url(url);
          $rootScope.$broadcast("$locationChangeSuccess");
          $q.flush();

          expect($state.current.name).toBe(state.name || state); // allow object
          expect($state.params).toEqual(extend({}, defaults, params));
          expect($location.url()).toBe(url);
        }
      }

      it('should map to/from the $location.url() and $stateParams', inject(function($state, $location, $q, $rootScope) {
        var nov15 = new Date(2014,10,15);
        var defaults = { p1: [ 'defaultValue' ], p2: nov15, nonurl: null };
        var params = { p1: [ "foo" ], p2: nov15  };
        var nonurl = { nonurl: { foo: 'bar' } };

        var check = expectStateUrlMappingFn($state, $rootScope, $q, $location);
        check('types', '/types/defaultValue/2014-11-15', { }, defaults);
        check('types', "/types/foo/2014-11-15", params, defaults, nonurl);

        extend(defaults, { "p3[]": [ 10 ] });
        extend(params, { p4: { baz: "qux" }});
        check('types.substate', "/types/foo/2014-11-15/sub/10/%7B%22baz%22:%22qux%22%7D", params, defaults, nonurl);

        extend(params, { p5: true });
        check('types.substate', "/types/foo/2014-11-15/sub/10/%7B%22baz%22:%22qux%22%7D?p5=1", params, defaults, nonurl);
      }));
    });

    it('should revert to last known working url on state change failure', inject(function ($state, $rootScope, $location, $q) {
      $state.transitionTo("about");
      $q.flush();

      $location.path("/resolve-fail");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();

      expect($state.current.name).toBe("about");
    }));

    it('should not revert to last known working url on state change failure', inject(function ($state, $rootScope, $location, $q) {
      $state.transitionTo("about");
      $q.flush();

      $rootScope.$on("$stateChangeError", function(event){
          event.defaultPrevented = true;
      });

      $location.path("/resolve-fail");
      $rootScope.$broadcast("$locationChangeSuccess");
      $rootScope.$apply();

      expect($location.path()).toBe("/resolve-fail");
    }));

    it('should replace browser history when "replace" enabled', inject(function ($state, $rootScope, $location, $q) {

      spyOn($location, 'replace');

      $state.transitionTo('about', {}, { location: 'replace' });
      $q.flush();

      expect($location.replace).toHaveBeenCalled();
    }));

    it('should not replace history normally', inject(function ($state, $rootScope, $location, $q) {

      spyOn($location, 'replace');

      $state.transitionTo('about');
      $q.flush();

      expect($location.replace).not.toHaveBeenCalled();

    }));
  });

  describe('default properties', function() {
    it('should always have a name', inject(function ($state, $q) {
      $state.transitionTo(A);
      $q.flush();
      expect($state.$current.name).toBe('A');
      expect($state.$current.toString()).toBe('A');
    }));

    it('should always have a resolve object', inject(function ($state) {
      expect($state.$current.resolve).toEqual({});
    }));
  });

  describe('"data" property inheritance/override', function () {
    it('should stay immutable for if state doesn\'t have parent', inject(function ($state) {
      initStateTo(H);
      expect($state.current.name).toEqual('H');
      expect($state.current.data.propA).toEqual(H.data.propA);
      expect($state.current.data.propB).toEqual(H.data.propB);
    }));

    it('should be inherited from parent if state doesn\'t define it', inject(function ($state) {
      initStateTo(HH);
      expect($state.current.name).toEqual('HH');
      expect($state.current.data.propA).toEqual(H.data.propA);
      expect($state.current.data.propB).toEqual(H.data.propB);
    }));

    it('should be overridden/extended if state defines it', inject(function ($state) {
      initStateTo(HHH);
      expect($state.current.name).toEqual('HHH');
      expect($state.current.data.propA).toEqual(HHH.data.propA);
      expect($state.current.data.propB).toEqual(H.data.propB);
      expect($state.current.data.propB).toEqual(HH.data.propB);
      expect($state.current.data.propC).toEqual(HHH.data.propC);
    }));
  });

  describe('substate and stateParams inheritance', function() {
    it('should inherit the parent param', inject(function ($state, $stateParams, $q) {
      initStateTo($state.get('root'), { param1: 1 });
      $state.go('root.sub1', { param2: 2 });
      $q.flush();
      expect($state.current.name).toEqual('root.sub1');
      expect($stateParams).toEqual({ param1: "1", param2: "2" });
    }));

    it('should not inherit siblings\' states', inject(function ($state, $stateParams, $q) {
      initStateTo($state.get('root'), { param1: 1 });
      $state.go('root.sub1', { param2: 2 });
      $q.flush();
      expect($state.current.name).toEqual('root.sub1');

      $state.go('root.sub2');
      $q.flush();
      expect($state.current.name).toEqual('root.sub2');

      expect($stateParams).toEqual({ param1: "1", param2: undefined });
    }));
  });

  describe('html5Mode compatibility', function() {

    it('should generate non-hashbang URLs in HTML5 mode', inject(function ($state) {
      expect($state.href("about.person", { person: "bob" })).toEqual("#/about/bob");
      locationProvider.html5Mode(true);
      expect($state.href("about.person", { person: "bob" })).toEqual("/about/bob");
    }));
  });

  describe('default properties', function () {
    it('should always have a name', inject(function ($state, $q) {
      $state.transitionTo(A); $q.flush();
      expect($state.$current.name).toBe('A');
      expect($state.$current.toString()).toBe('A');
    }));

    it('should always have a resolve object', inject(function ($state) {
      expect($state.$current.resolve).toEqual({});
    }));

    it('should include itself and parent states', inject(function ($state, $q) {
      $state.transitionTo(DD); $q.flush();
      expect($state.$current.includes).toEqual({ '': true, D: true, DD: true });
    }));
  });

  describe('template handling', function () {
    it('should inject $stateParams into templateUrl function', inject(function ($state, $q, $httpBackend) {
      $httpBackend.expectGET("/templates/foo.html").respond("200");
      $state.transitionTo('about.sidebar.item', { item: "foo" }); $q.flush();
      expect(templateParams).toEqual({ item: "foo" });
    }));
  });

  describe('provider decorators', function () {

    it('should return built-in decorators', inject(function ($state) {
      expect(stateProvider.decorator('parent')({ parent: A }).self.name).toBe("A");
    }));

    it('should allow built-in decorators to be overridden', inject(function ($state, $q) {
      stateProvider.decorator('data', function(state) {
        return angular.extend(state.data || {}, { foo: "bar" });
      });
      stateProvider.state('AA', { parent: A, data: { baz: "true" } });

      $state.transitionTo('AA');
      $q.flush();
      expect($state.current.data).toEqual({ baz: 'true', foo: 'bar' });
    }));

    it('should allow new decorators to be added', inject(function ($state, $q) {
      stateProvider.decorator('custom', function(state) {
        return function() { return "Custom functionality for state '" + state + "'" };
      });
      stateProvider.state('decoratorTest', {});

      $state.transitionTo('decoratorTest');
      $q.flush();
      expect($state.$current.custom()).toBe("Custom functionality for state 'decoratorTest'");
    }));

    it('should allow built-in decorators to be extended', inject(function ($state, $q, $httpBackend) {
      stateProvider.decorator('views', function(state, parent) {
        var result = {};

        angular.forEach(parent(state), function(config, name) {
          result[name] = angular.extend(config, { templateProvider: function() {
            return "Template for " + name;
          }});
        });
        return result;
      });

      stateProvider.state('viewTest', {
        views: {
          viewA: {},
          viewB: {}
        }
      });

      $state.transitionTo('viewTest');
      $q.flush();

      expect($state.$current.views['viewA@'].templateProvider()).toBe('Template for viewA@');
      expect($state.$current.views['viewB@'].templateProvider()).toBe('Template for viewB@');
    }));

  });
});

describe('state queue', function(){
  angular.module('ui.router.queue.test', ['ui.router.queue.test.dependency'])
    .config(function($stateProvider) {
      $stateProvider
        .state('queue-test-a', {})
        .state('queue-test-b-child', { parent: 'queue-test-b' })
        .state('queue-test-b', {});
    });
  angular.module('ui.router.queue.test.dependency', [])
    .config(function($stateProvider) {
      $stateProvider
        .state('queue-test-a.child', {})
    });

  var expectedStates = ['','queue-test-a', 'queue-test-a.child', 'queue-test-b', 'queue-test-b-child'];

  it('should work across modules', function() {
    module('ui.router.queue.test', 'ui.router.queue.test.dependency');

    inject(function ($state) {
      var list = $state.get().sort(function(a, b) { return (a.name > b.name) - (b.name > a.name); });
      expect(list.map(function(state) { return state.name; })).toEqual(expectedStates);
    });
  });

  it('should work when parent is name string', function() {
    module('ui.router.queue.test', 'ui.router.queue.test.dependency');

    inject(function ($state) {
      var list = $state.get().sort(function(a, b) { return (a.name > b.name) - (b.name > a.name); });
      expect(list.map(function(state) { return state.name; })).toEqual(expectedStates);
    });
  });
});
