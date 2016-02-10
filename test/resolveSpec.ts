/// <reference path='../typings/angularjs/angular.d.ts' />
/// <reference path='../typings/angularjs/angular-mocks.d.ts' />
/// <reference path='../typings/jasmine/jasmine.d.ts' />

import "../src/ui-router";
import {ResolveContext} from "../src/resolve/module";

import {State} from "../src/state/module";
import {Node, PathFactory} from "../src/path/module";

import {omit, map, pick, extend, forEach} from "../src/common/common";
import {prop} from "../src/common/hof";
import {StateDeclaration} from "../src/state/interface";
import Spy = jasmine.Spy;

let module = angular.mock.module;
///////////////////////////////////////////////

var states, statesTree, statesMap: { [key:string]: State } = {};
var emptyPath;
var vals, counts, expectCounts;
var asyncCount;

beforeEach(function () {
  counts = { _J: 0, _J2: 0, _K: 0, _L: 0, _M: 0, _Q: 0 };
  vals = { _Q: null };
  expectCounts = angular.copy(counts);
  states = {
    A: { resolve: { _A: function () { return "A"; }, _A2: function() { return "A2"; }},
      B: { resolve: { _B: function () { return "B"; }, _B2: function() { return "B2"; }},
        C: { resolve: { _C: function (_A, _B) { return _A + _B + "C"; }, _C2: function() { return "C2"; }},
          D: { resolve: { _D: function (_D2) { return "D1" + _D2; }, _D2: function () { return "D2"; }} }
        }
      },
      E: { resolve: { _E: function() { return "E"; } },
        F: { resolve: { _E: function() { return "_E"; }, _F: function(_E) { return _E + "F"; }} }
      },
      G: { resolve: { _G: function() { return "G"; } },
        H: { resolve: { _G: function(_G) { return _G + "_G"; }, _H: function(_G) { return _G + "H"; } } }
      },
      I: { resolve: { _I: function(_I) { return "I"; } } }
    },
    J: { resolvePolicy: "JIT", resolve: { _J: function() { counts['_J']++; return "J"; }, _J2: function(_J) { counts['_J2']++; return _J + "J2"; } },
      K: { resolvePolicy: "JIT", resolve: { _K: function(_J2) { counts['_K']++; return _J2 + "K"; }},
        L: { resolvePolicy: "JIT", resolve: { _L: function(_K) { counts['_L']++; return _K + "L"; }},
          M: { resolvePolicy: "JIT", resolve: { _M: function(_L) { counts['_M']++; return _L + "M"; }} }
        }
      },
      N: {
        resolve: { _N: function(_J) { return _J + "N"; }, _N2: function(_J) { return _J + "N2"; }, _N3: function(_J) { return _J + "N3"; } },
        resolvePolicy: { _N: "EAGER", _N2: "LAZY", _N3: "JIT" }
      }
    },
    O: { resolve: { _O: function(_O2) { return _O2 + "O"; }, _O2: function(_O) { return _O + "O2"; } } },
    P: { resolve: { $state: function($state) { return $state } },
      Q: { resolve: { _Q: function($state) { counts._Q++; vals._Q = $state; return "foo"; }}}
    }
  };

  var stateProps = ["resolve", "resolvePolicy"];
  statesTree = loadStates({}, states, '');

  function loadStates(parent, state, name) {
    var thisState = pick.apply(null, [state].concat(stateProps));
    var substates = omit.apply(null, [state].concat(stateProps));

    thisState.template = thisState.template || "empty";
    thisState.name = name;
    thisState.parent = parent.name;
    thisState.params = {};
    thisState.data = { children: [] };

    angular.forEach(substates, function (value, key) {
      thisState.data.children.push(loadStates(thisState, value, key));
    });
    thisState = new State(thisState);
    statesMap[name] = thisState;
    return thisState;
  }
});

function makePath(names: string[]): Node[] {
  let nodes = map(names, name => new Node(statesMap[name]));
  return PathFactory.bindTransNodesToPath(nodes);
}

function getResolvedData(pathContext: ResolveContext) {
  return map(pathContext.getResolvables(), prop("data"));
}


describe('Resolvables system:', function () {
  beforeEach(inject(function ($transitions, $injector) {
    emptyPath = [];
    asyncCount = 0;
  }));

  describe('ResolveContext.resolvePathElement()', function () {
    it('should resolve all resolves in a PathElement', inject(function ($q) {
      let path = makePath([ "A" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePathElement(statesMap["A"]);
      promise.then(function () {
        let expectFn = expect(getResolvedData(ctx))
        expect(getResolvedData(ctx)).toEqualData({ _A: "A", _A2: "A2" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should not resolve non-dep parent PathElements', inject(function ($q) {
      let path = makePath([ "A", "B" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePathElement(statesMap["B"]);
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({_B: "B", _B2: "B2" });
        expect(ctx.getResolvables()["_A"]).toBeDefined();
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should resolve only eager resolves when run with "eager" policy', inject(function ($q) {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePathElement(statesMap["N"], { resolvePolicy: "EAGER" });
      promise.then(function () {
        let results = map(ctx.getResolvables(), prop("data"));
        expect(results).toEqualData({_J: "J", _N: "JN" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should resolve only eager and lazy resolves in PathElement when run with "lazy" policy', inject(function ($q) {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePathElement(statesMap["N"], { resolvePolicy: "LAZY" });
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J", _N: "JN", _N2: "JN2" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  describe('Path.getResolvables', function () {
    it('should return Resolvables from the deepest element and all ancestors', inject(function ($q) {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);
      let resolvableLocals = ctx.getResolvables(statesMap["C"]);
      let keys = Object.keys(resolvableLocals).sort();
      expect(keys).toEqual( ["$stateParams", "_A", "_A2", "_B", "_B2", "_C", "_C2" ] );
    }));
  });

  describe('Path.resolvePath()', function () {
    it('should resolve all resolves in a Path', inject(function ($q) {
      let path = makePath([ "A", "B" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePath();
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _A: "A", _A2: "A2", _B: "B", _B2: "B2" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should resolve only eager resolves when run with "eager" policy', inject(function ($q) {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePath({ resolvePolicy: "EAGER" });
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J", _N: "JN" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should resolve only lazy and eager resolves when run with "lazy" policy', inject(function ($q) {
      let path = makePath([ "J", "N" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePath({ resolvePolicy: "LAZY" });
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _J: "J", _N: "JN", _N2: "JN2"});
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));

    it('should provide each resolveResolvable with a path context, starting from the root to the resolves PathElement', inject(function($q, $state) {
      "use strict";
      let path = makePath(["P", "Q"]);
      let ctx = new ResolveContext(path);
      let promise = ctx.resolvePath({ resolvePolicy: "JIT" });

      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ $state: $state, _Q: "foo" });
        asyncCount++;
      });


      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  describe('Resolvable.resolveResolvable()', function () {
    it('should resolve one Resolvable, and its deps', inject(function ($q) {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);
      let promise = ctx.getResolvables()["_C"].resolveResolvable(ctx);
      promise.then(function () {
        expect(getResolvedData(ctx)).toEqualData({ _A: "A", _B: "B",_C: "ABC" });
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  describe('PathElement.invokeLater()', function () {
    it('should resolve only the required deps, then inject the fn', inject(function ($q) {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);
      let result;

      let onEnter1 = function (_C2) { result = _C2; };
      let promise = ctx.invokeLater(onEnter1, {});
      promise.then(function (data) {
        expect(result).toBe("C2");
        expect(getResolvedData(ctx)).toEqualData({_C2: "C2"});
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  describe('PathElement.invokeLater()', function () {
    it('should resolve the required deps on demand', inject(function ($q) {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);

      let result;
      let cOnEnter1 = function (_C2) { result = _C2; };
      let promise = ctx.invokeLater(cOnEnter1, {});
      promise.then(function (data) {
        expect(result).toBe("C2");
        expect(getResolvedData(ctx)).toEqualData({_C2: "C2"})
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(1);

      let cOnEnter2 = function (_C) { result = _C; };
      promise = ctx.invokeLater(cOnEnter2, {});
      promise.then(function (data) {
        expect(result).toBe("ABC");
        expect(getResolvedData(ctx)).toEqualData({_A: "A", _B: "B", _C: "ABC", _C2: "C2"})
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(2);
    }));
  });

  describe('invokeLater', function () {
    it('should Error if the onEnter dependency cannot be injected', inject(function ($q) {
      let path = makePath([ "A", "B", "C" ]);
      let ctx = new ResolveContext(path);

      let cOnEnter = function (_D) {  };
      let caught;
      let promise = ctx.invokeLater(cOnEnter, {});
      promise.catch(function (err) {
        caught = err;
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
      expect(caught.message).toContain("Unknown provider: _DProvider");
    }));
  });


  describe('Resolvables', function () {
    it('should be able to inject deps from the same PathElement', inject(function ($q) {
      let path = makePath([ "A", "B", "C", "D" ]);
      let ctx = new ResolveContext(path);

      let result;
      let dOnEnter = function (_D) {
        result = _D;
      };

      let promise = ctx.invokeLater(dOnEnter, {});
      promise.then(function () {
        expect(result).toBe("D1D2");
        expect(getResolvedData(ctx)).toEqualData({_D: "D1D2", _D2: "D2"})
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  describe('Resolvables', function () {
    it('should allow PathElement to override parent deps Resolvables of the same name', inject(function ($q) {
      let path = makePath([ "A", "E", "F" ]);
      let ctx = new ResolveContext(path);

      let result;
      let fOnEnter = function (_F) {
        result = _F;
      };

      let promise = ctx.invokeLater(fOnEnter, {});
      promise.then(function () {
        expect(result).toBe("_EF");
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
    }));
  });

  // State H has a resolve named _G which takes _G as an injected parameter. injected _G should come from state "G"
  // It also has a resolve named _H which takes _G as an injected parameter. injected _G should come from state "H"
  describe('Resolvables', function () {
    it('of a particular name should be injected from the parent PathElements for their own name', inject(function ($q) {
      let path = makePath([ "A", "G", "H" ]);
      let ctx = new ResolveContext(path);

      let resolvable_G = ctx.getResolvables()["_G"];
      let promise = resolvable_G.get(ctx);
      promise.then(function (data) {
        expect(data).toBe("G_G");
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(1);

      let result;
      let hOnEnter = function (_H) {
        result = _H;
      };

      promise = ctx.invokeLater(hOnEnter, {});
      promise.then(function (data) {
        expect(result).toBe("G_GH");
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(2);
    }));
  });

  describe('Resolvables', function () {
    it('should fail to inject same-name deps to self if no parent PathElement contains the name.', inject(function ($q) {
      let path = makePath([ "A", "I" ]);
      let ctx = new ResolveContext(path);

      // let iPathElement = path.elements[1];
      let iOnEnter = function (_I) {  };
      let caught;
      let promise = ctx.invokeLater(iOnEnter, {});
      promise.catch(function (err) {
        caught = err;
        asyncCount++;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
      expect(caught.message).toContain("[$injector:unpr] Unknown provider: _IProvider ");
    }));
  });

  xdescribe('Resolvables', function () {
    it('should fail to inject circular dependency', inject(function ($q) {
      var path = makePath([ "O" ]);

      var iPathElement = path.elements[0];
      var iOnEnter = function (_O) {  };
      var caught;
      var promise = iPathElement.invokeLater(iOnEnter, {}, path);
      promise.catch(function (err) {
        caught = err;
      });

      $q.flush();
      expect(asyncCount).toBe(1);
      expect(caught.message).toContain("[$injector:unpr] Unknown provider: _IProvider ");
    }));
  });

  describe('Resolvables', function () {
    it('should not re-resolve', inject(function ($q) {
      let path = makePath([ "J", "K" ]);
      let ctx = new ResolveContext(path);

      let result;
      function checkCounts() {
        expect(result).toBe("JJ2K");
        expect(counts['_J']).toBe(1);
        expect(counts['_J2']).toBe(1);
        expect(counts['_K']).toBe(1);
      }

      let onEnterCount = 0;
      let kOnEnter = function (_K) {
        result = _K;
        onEnterCount++;
      };
      let promise = ctx.invokeLater(kOnEnter, {});
      promise.then(checkCounts);
      $q.flush();
      expect(onEnterCount).toBe(1);

      // invoke again
      promise = ctx.invokeLater(kOnEnter, {});
      promise.then(checkCounts);
      $q.flush();
      expect(onEnterCount).toBe(2);
    }));
  });

  describe('Pre-Resolved Path', function () {
    it('from previous resolve operation should be re-useable when used in another resolve operation', inject(function ($q) {
      let path = makePath([ "J", "K" ]);
      let ctx1 = new ResolveContext(path);
      let async = 0;

      expect(counts["_J"]).toBe(0);
      expect(counts["_J2"]).toBe(0);

      ctx1.resolvePath({ resolvePolicy: "JIT"}).then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(1);

      let path2 = path.concat(makePath([ "L", "M" ]));
      let ctx2 = new ResolveContext(path2);
      ctx2.resolvePath({ resolvePolicy: "JIT"}).then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(1);
        expect(counts["_M"]).toBe(1);
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(2);
    }));
  });

  describe('Path.slice()', function () {
    it('should create a partial path from an original path', inject(function ($q) {
      let path = makePath([ "J", "K", "L" ]);
      let ctx1 = new ResolveContext(path);
      ctx1.resolvePath({resolvePolicy: "JIT"}).then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(1);
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(1);

      let slicedPath = path.slice(0, 2);
      expect(slicedPath.length).toBe(2);
      expect(slicedPath[0].state).toBe(path[0].state);
      expect(slicedPath[1].state).toBe(path[1].state);
      let path2 = path.concat(makePath([ "L", "M" ]));
      let ctx2 = new ResolveContext(path2);
      ctx2.resolvePath({resolvePolicy: "JIT"}).then(function () {
        expect(counts["_J"]).toBe(1);
        expect(counts["_J2"]).toBe(1);
        expect(counts["_K"]).toBe(1);
        expect(counts["_L"]).toBe(2);
        expect(counts["_M"]).toBe(1);
        asyncCount++;
      });
      $q.flush();
      expect(asyncCount).toBe(2);
    }));
  });

  // TODO: test injection of annotated functions
  // TODO: test injection of services
  // TODO: test injection of other locals
  // TODO: Implement and test injection to onEnter/Exit
  // TODO: Implement and test injection into controllers
});


describe("$resolve", function () {
  var $r, tick;

  beforeEach(module('ui.router.util'));
  beforeEach(module(function($provide) {
    $provide.factory('Foo', function() {
      return "Working";
    });
  }));

  beforeEach(inject(function($resolve, $q) {
    $r = $resolve;
    tick = $q.flush;
  }));

  describe(".resolve()", function () {
    it("calls injectable functions and returns a promise", function () {
      var fun: Spy = jasmine.createSpy('fun');
      fun.and.returnValue(42);
      var r = $r.resolve({ fun: [ '$resolve', fun ] });
      expect(r).not.toBeResolved();
      tick();
      expect(resolvedValue(r)).toEqual({ fun: 42 });
      expect(fun).toHaveBeenCalled();
      expect(fun.calls.count()).toBe(1);
      expect(fun.calls.mostRecent().args.length).toBe(1);
      expect(fun.calls.mostRecent().args[0]).toBe($r);
    });

    it("resolves promises returned from the functions", inject(function ($q) {
      var d = $q.defer();
      var fun = jasmine.createSpy('fun').and.returnValue(d.promise);
      var r = $r.resolve({ fun: [ '$resolve', fun ] });
      tick();
      expect(r).not.toBeResolved();
      d.resolve('async');
      tick();
      expect(resolvedValue(r)).toEqual({ fun: 'async' });
    }));

    it("resolves dependencies between functions", function () {
      var a = jasmine.createSpy('a');
      var b = jasmine.createSpy('b').and.returnValue('bb');
      var r = $r.resolve({ a: [ 'b', a ], b: [ b ] });
      tick();
      expect(a).toHaveBeenCalled();
      expect(a.calls.mostRecent().args).toEqual([ 'bb' ]);
      expect(b).toHaveBeenCalled();
    });

    it("resolves dependencies between functions that return promises", inject(function ($q) {
      var ad = $q.defer(), a = jasmine.createSpy('a').and.returnValue(ad.promise);
      var bd = $q.defer(), b = jasmine.createSpy('b').and.returnValue(bd.promise);
      var cd = $q.defer(), c = jasmine.createSpy('c').and.returnValue(cd.promise);

      var r = $r.resolve({ a: [ 'b', 'c', a ], b: [ 'c', b ], c: [ c ] });
      tick();
      expect(r).not.toBeResolved();
      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
      expect(c).toHaveBeenCalled();
      cd.resolve('cc');
      tick();
      expect(r).not.toBeResolved();
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalled();
      expect(b.calls.mostRecent().args).toEqual([ 'cc' ]);
      bd.resolve('bb');
      tick();
      expect(r).not.toBeResolved();
      expect(a).toHaveBeenCalled();
      expect(a.calls.mostRecent().args).toEqual([ 'bb', 'cc' ]);
      ad.resolve('aa');
      tick();
      expect(resolvedValue(r)).toEqual({ a: 'aa', b: 'bb', c: 'cc' });
      expect(a.calls.count()).toBe(1);
      expect(b.calls.count()).toBe(1);
      expect(c.calls.count()).toBe(1);
    }));

    // TODO: Reimplement cycle detection
    xit("refuses cyclic dependencies", function () {
      var a = jasmine.createSpy('a');
      var b = jasmine.createSpy('b');
      expect(caught(function () {
        $r.resolve({ a: [ 'b', a ], b: [ 'a', b ] });
      })).toMatch(/cyclic/i);
      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });

    it("allows a function to depend on an injector value of the same name", function () {
      var r = $r.resolve({ $resolve: function($resolve) { return $resolve === $r; } });
      tick();
      expect(resolvedValue(r)).toEqual({ $resolve: true });
    });

    it("allows locals to be passed that override the injector", function () {
      var fun = jasmine.createSpy('fun');
      $r.resolve({ fun: [ '$resolve', fun ] }, { $resolve: 42 });
      tick();
      expect(fun).toHaveBeenCalled();
      expect(fun.calls.mostRecent().args[0]).toBe(42);
    });

    it("does not call injectables overridden by a local", function () {
      var fun = jasmine.createSpy('fun').and.returnValue("function");
      var r = $r.resolve({ fun: [ fun ] }, { fun: "local" });
      tick();
      expect(fun).not.toHaveBeenCalled();
      expect(resolvedValue(r)).toEqual({ fun: "local" });
    });

    it("includes locals in the returned values", function () {
      var locals = { foo: 'hi', bar: 'mom' };
      var r = $r.resolve({}, locals);
      tick();
      expect(resolvedValue(r)).toEqual(locals);
    });

    it("allows inheritance from a parent resolve()", function () {
      var r = $r.resolve({ fun: function () { return true; } });
      var s = $r.resolve({ games: function () { return true; } }, {}, r);
      tick();
      expect(r).toBeResolved();
      expect(resolvedValue(s)).toEqual({ fun: true, games: true });
    });

    it("resolves dependencies from a parent resolve()", function () {
      var r = $r.resolve({ a: [ function() { return 'aa' } ] });
      var b = jasmine.createSpy('b');
      var s = $r.resolve({ b: [ 'a', b ] }, {}, r);
      tick();
      expect(b).toHaveBeenCalled();
      expect(b.calls.mostRecent().args).toEqual([ 'aa' ]);
    });

    it("allow access to ancestor resolves in descendent resolve blocks", inject(function ($q) {
      var gPromise = $q.defer(),
          gInjectable = jasmine.createSpy('gInjectable').and.returnValue(gPromise.promise),
          pPromise = $q.defer(),
          pInjectable = jasmine.createSpy('pInjectable').and.returnValue(pPromise.promise);

      var g = $r.resolve({ gP: [ gInjectable ] });

      gPromise.resolve('grandparent');
      tick();

      var s = jasmine.createSpy('s');
      var p = $r.resolve({ p: [ pInjectable ] }, {}, g);
      var c = $r.resolve({ c: [ 'p', 'gP', s ] }, {}, p);

      pPromise.resolve('parent');
      tick();

      expect(s).toHaveBeenCalled();
      expect(s.calls.mostRecent().args).toEqual([ 'parent', 'grandparent' ]);
    }));

    // test for #1353
    it("allow parent resolve to override grandparent resolve", inject(function ($q) {
      var gPromise = $q.defer(),
          gInjectable = jasmine.createSpy('gInjectable').and.returnValue(gPromise.promise);

      var g = $r.resolve({ item: [ function() { return "grandparent"; } ] });
      gPromise.resolve('grandparent');
      tick();

      var p = $r.resolve({ item: [ function() { return "parent"; } ] }, {}, g);
      var s = jasmine.createSpy('s');
      var c = $r.resolve({ c: [ s ] }, {}, p);
      var item;
      c.then(function(vals) { item = vals.item; });
      tick();

      expect(s).toHaveBeenCalled();
      expect(item).toBe('parent');
    }));

    it("allows a function to override a parent value of the same name", function () {
      var r = $r.resolve({ b: function() { return 'B' } });
      var s = $r.resolve({
        a: function (b) { return 'a:' + b },
        b: function (b) { return '(' + b + ')' },
        c: function (b) { return 'c:' + b }
      }, {}, r);
      tick();
      expect(resolvedValue(s)).toEqual({ a: 'a:(B)', b:'(B)', c:'c:(B)' });
    });

    it("allows a function to override a parent value of the same name with a promise", inject(function ($q) {
      var r = $r.resolve({ b: function() { return 'B' } });
      var superb, bd = $q.defer();
      var s = $r.resolve({
        a: function (b) { return 'a:' + b },
        b: function (b) { superb = b; return bd.promise },
        c: function (b) { return 'c:' + b }
      }, {}, r);
      tick();
      bd.resolve('(' + superb + ')');
      tick();
      expect(resolvedValue(s)).toEqual({ a: 'a:(B)', b:'(B)', c:'c:(B)' });
    }));

    it("it only resolves after the parent resolves", inject(function ($q) {
      var bd = $q.defer(), b = jasmine.createSpy('b').and.returnValue(bd.promise);
      var cd = $q.defer(), c = jasmine.createSpy('c').and.returnValue(cd.promise);
      var r = $r.resolve({ c: [ c ] });
      var s = $r.resolve({ b: [ b ] }, {}, r);
      bd.resolve('bbb');
      tick();
      expect(r).not.toBeResolved();
      expect(s).not.toBeResolved();
      cd.resolve('ccc');
      tick();
      expect(resolvedValue(r)).toEqual({ c: 'ccc' });
      expect(resolvedValue(s)).toEqual({ b: 'bbb', c: 'ccc' });
    }));

    it("rejects missing dependencies but does not fail synchronously", function () {
      var r = $r.resolve({ fun: function (invalid) {} });
      expect(r).not.toBeResolved();
      tick();
      expect(resolvedError(r)).toMatch(/unknown provider/i);
    });

    it("propagates exceptions thrown by the functions as a rejection", function () {
      var r = $r.resolve({ fun: function () { throw "i want cake" } });
      expect(r).not.toBeResolved();
      tick();
      expect(resolvedError(r)).toBe("i want cake");
    });

    it("propagates errors from a parent resolve", function () {
      var error = [ "the cake is a lie" ];
      var r = $r.resolve({ foo: function () { throw error } });
      var s = $r.resolve({ bar: function () { 42 } }, r);
      tick();
      expect(resolvedError(r)).toBe(error);
      expect(resolvedError(s)).toBe(error);
    });

    it("does not invoke any functions if the parent resolve has already failed", function () {
      var r = $r.resolve({ foo: function () { throw "oops" } });
      tick();
      expect(r).toBeResolved();
      var a = jasmine.createSpy('a');
      var s =  $r.resolve({ a: [ a ] }, {}, r);
      tick();
      expect(resolvedError(s)).toBeDefined();
      expect(a).not.toHaveBeenCalled();
    });

    // TODO: Resolvables don't do this; the $resolve service used to.  Possibly reimplement this short-circuit.
    xit("does not invoke any more functions after a failure", inject(function ($q) {
      var ad = $q.defer(), a = jasmine.createSpy('a').and.returnValue(ad.promise);
      var cd = $q.defer(), c = jasmine.createSpy('c').and.returnValue(cd.promise);
      var dd = $q.defer(), d = jasmine.createSpy('d').and.returnValue(dd.promise);
      var r = $r.resolve({ a: [ 'c', a ], c: [ c ], d: [ d ] });
      dd.reject('dontlikeit');
      tick();
      expect(resolvedError(r)).toBeDefined();
      cd.resolve('ccc');
      tick();
      expect(a).not.toHaveBeenCalled();
    }));

    it("does not invoke any more functions after a parent failure", inject(function ($q) {
      var ad = $q.defer(), a = jasmine.createSpy('a').and.returnValue(ad.promise);
      var cd = $q.defer(), c = jasmine.createSpy('c').and.returnValue(cd.promise);
      var dd = $q.defer(), d = jasmine.createSpy('d').and.returnValue(dd.promise);
      var r = $r.resolve({ c: [ c ], d: [ d ] });
      var s = $r.resolve({ a: [ 'c', a ] }, r);
      dd.reject('dontlikeit');
      tick();
      expect(resolvedError(r)).toBeDefined();
      expect(resolvedError(s)).toBeDefined();
      cd.resolve('ccc');
      tick();
      expect(a).not.toHaveBeenCalled();
    }));
  });
});


describe("State transitions with resolves", function() {
  var stateDefs: any = statesMap;
  beforeEach(module(function($stateProvider) {
    // allow tests to specify controllers after registration
    function controllerProvider(state) {
      return function() {
        return stateDefs[state.name].controller || function emptyController() {}
      }
    }

    angular.forEach(stateDefs, function(state: StateDeclaration, key) {
      if (!key) return;
      state.template = "<div ui-view></div> state"+key;
      state.controllerProvider = controllerProvider(state);
      $stateProvider.state(key, state);
    });
  }));

  var $state, $transitions, $q, $compile, $rootScope, $scope, $timeout;
  beforeEach(inject(function (_$transitions_, _$state_, _$q_, _$compile_, _$rootScope_, _$timeout_, $injector) {
    $state = _$state_;
    $transitions = _$transitions_;
    $q = _$q_;
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    $scope = $rootScope.$new();
    emptyPath = [];
    asyncCount = 0;
    $compile(angular.element("<div ui-view></div>"))($scope);
  }));

  function flush() {
    $q.flush();
    $timeout.flush();
  }

  function testGo(state, params?, options?) {
    $state.go(state, params, options);
    $q.flush();
    expect($state.current).toBe($state.get(state));
  }

  it("should not resolve jit resolves that are not injected anywhere", inject(function() {
    testGo("J");
    expect(counts).toEqualData(expectCounts);
    testGo("K");
    expect(counts).toEqualData(expectCounts);
  }));

  it("should invoke jit resolves when they are injected", inject(function() {
    stateDefs.J.controller = function JController(_J) { };

    testGo("J");
    expectCounts._J++;
    expect(counts).toEqualData(expectCounts);
  }));

  it("should invoke jit resolves only when injected", inject(function() {
    stateDefs.K.controller = function KController(_K) { };

    testGo("J");
    expect(counts).toEqualData(expectCounts);

    testGo("K");
    expectCounts._K++;
    expectCounts._J++;
    expectCounts._J2++;
    expect(counts).toEqualData(expectCounts);
  }));

  it("should not re-invoke jit resolves", inject(function() {
    stateDefs.J.controller = function JController(_J) { };
    stateDefs.K.controller = function KController(_K) { };
    testGo("J");
    expectCounts._J++;
    expect(counts).toEqualData(expectCounts);

    testGo("K");

    expectCounts._K++;
    expectCounts._J2++;
    expect(counts).toEqualData(expectCounts);
  }));

  it("should invoke jit resolves during a transition that are injected in a hook like onEnter", inject(function() {
    stateDefs.J.onEnter = function onEnter(_J) {};
    testGo("J");
    expectCounts._J++;
    expect(counts).toEqualData(expectCounts);
  }));
});



// Integration tests
describe("Integration: Resolvables system", () => {
  beforeEach(module(function ($stateProvider) {
    let copy = {};
    forEach(statesMap, (stateDef, name) => {
      copy[name] = extend({}, stateDef);
    });

    angular.forEach(copy, stateDef => {
      if (stateDef.name) $stateProvider.state(stateDef);
    });
  }));

  let $state, $rootScope, $transitions, $trace;
  beforeEach(inject((_$state_, _$rootScope_, _$transitions_, _$trace_) => {
    $state = _$state_;
    $rootScope = _$rootScope_;
    $transitions = _$transitions_;
    $trace = _$trace_;
  }));


  it("should not re-resolve data, when redirecting to a child", () => {
    $transitions.onStart({to: "J"}, ($transition$, _J) => {
      expect(counts._J).toEqualData(1);
      return $state.target("K");
    });
    $state.go("J");
    $rootScope.$digest();
    expect($state.current.name).toBe("K");
    expect(counts._J).toEqualData(1);
  });
});