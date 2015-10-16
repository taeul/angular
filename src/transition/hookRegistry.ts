import {IInjectable, extend, val, isString, isFunction, removeFrom} from "../common/common";

import {IState} from "../state/interface";
import Glob from "../state/glob";

import {IMatchCriteria, IStateMatch, IEventHook, IHookRegistry, IHookRegistration} from "./interface";

/**
 * Determines if the given state matches the matchCriteria
 * @param state a State Object to test against
 * @param matchCriteria {string|array|function}
 * - If a string, matchState uses the string as a glob-matcher against the state name
 * - If an array (of strings), matchState uses each string in the array as a glob-matchers against the state name
 *   and returns a positive match if any of the globs match.
 * - If a function, matchState calls the function with the state and returns true if the function's result is truthy.
 * @returns {boolean}
 */
export function matchState(state: IState, matchCriteria: (string|IStateMatch)) {
  let toMatch = isString(matchCriteria) ? [matchCriteria] : matchCriteria;

  function matchGlobs(_state) {
    for (let i = 0; i < toMatch.length; i++) {
      let glob = Glob.fromString(toMatch[i]);

      if ((glob && glob.matches(_state.name)) || (!glob && toMatch[i] === _state.name)) {
        return true;
      }
    }
    return false;
  }

  let matchFn = <any> (isFunction(toMatch) ? toMatch : matchGlobs);
  return !!matchFn(state);
}


export class EventHook implements IEventHook {
  callback: IInjectable;
  matchCriteria: IMatchCriteria;
  priority: number;

  constructor(matchCriteria: IMatchCriteria, callback: IInjectable, options: { priority: number } = <any>{}) {
    this.callback = callback;
    this.matchCriteria = extend({to: val(true), from: val(true)}, matchCriteria);
    this.priority = options.priority || 0;
  }

  matches(to: IState, from: IState) {
    return <boolean> matchState(to, this.matchCriteria.to) && matchState(from, this.matchCriteria.from);
  }
}

interface ITransitionEvents { [key: string]: IEventHook[]; }

// Return a registration function of the requested type.
function makeHookRegistrationFn(hooks: ITransitionEvents, name: string): IHookRegistration {
  return function (matchObject, callback, options = {}) {
    let eventHook = new EventHook(matchObject, callback, options);
    hooks[name].push(eventHook);

    return function deregisterEventHook() {
      removeFrom(hooks[name])(eventHook);
    };
  };
}

export class HookRegistry implements IHookRegistry {
  static mixin(source: HookRegistry, target: IHookRegistry) {
    Object.keys(source._transitionEvents).concat(["getHooks"]).forEach(key => target[key] = source[key]);
  }

  private _transitionEvents: ITransitionEvents = {
    onBefore: [], onStart: [], onEnter: [], onRetain: [], onExit: [], onFinish: [], onSuccess: [], onError: []
  };

  getHooks = (name: string) => this._transitionEvents[name];

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onBefore
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked before a Transition begins.
   *
   * This function can be injected with one additional special value:
   * - **`$transition$`**: The current transition
   *
   * @param {object} matchObject An object that specifies which transitions to invoke the callback for (typically this
   * value will be {} for this callback, to match all invalid transitions)
   *
   * - **`to`** - {string|function=} - A glob string that matches the 'to' state's name.
   *    Or, a function with the signature `function(state) {}` which should return a boolean to indicate if the state matches.
   * - **`from`** - {string|function=} - A glob string that matches the 'from' state's name.
   *    Or, a function with the signature `function(state) {}` which should return a boolean to indicate if the state matches.
   *
   * @param {function} callback
   *   The function which will be injected and invoked, before a matching transition is started.
   *   The function may optionally return a {boolean|Transition|object} value which will affect the current transition:
   *
   * @return
   *     - **`false`** to abort the current transition
   *     - **{Transition}** A Transition object from the $transition$.redirect() factory. If returned, the
   *        current transition will be aborted and the returned Transition will supersede it.
   *     - **{object}** A map of resolve functions to be added to the current transition. These resolves will be made
   *        available for injection to further steps in the transition.  The object should have {string}s for keys and
   *        {function}s for values, like the `resolve` object in {@link ui.router.state.$stateProvider#state $stateProvider.state}.
   */
  onBefore = makeHookRegistrationFn(this._transitionEvents, "onBefore");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onStart
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked when a transition has begun.  The function is injected in the
   * destination state's ResolveContext. This function can be injected with one additional special value:
   *
   *  - **`$transition$`**: The current transition
   *
   * @param {object} matchObject An object that specifies which transitions to invoke the callback for
   *
   * - **`to`** - {string|function=} - A glob string that matches the 'to' state's name.
   *    Or, a function with the signature `function(state) {}` which should return a boolean to indicate if the state matches.
   * - **`from`** - {string|function=} - A glob string that matches the 'from' state's name.
   *    Or, a function with the signature `function(state) {}` which should return a boolean to indicate if the state matches.
   *
   * @param {function} callback
   *   The function which will be injected and invoked, when a matching transition is started.
   *   The function may optionally return a {boolean|Transition|object} value which will affect the current transition:
   *
   *     - **`false`** to abort the current transition
   *     - **{Transition}** A Transition object from the $transition$.redirect() factory. If returned, the
   *        current transition will be aborted and the returned Transition will supersede it.
   *     - **{object}** A map of resolve functions to be added to the current transition. These resolves will be made
   *        available for injection to further steps in the transition.  The object should have {string}s for keys and
   *        {function}s for values, like the `resolve` object in {@link ui.router.state.$stateProvider#state $stateProvider.state}.
   */
  onStart = makeHookRegistrationFn(this._transitionEvents, "onStart");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onEnter
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked during a transition between the matched 'to' and 'from' states,
   * when the matched 'to' state is being entered. This function is injected with the entering state's resolves.
   *
   * This function can be injected with two additional special value:
   * - **`$transition$`**: The current transition
   * - **`$state$`**: The state being entered
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback See callback in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   */
  onEnter = makeHookRegistrationFn(this._transitionEvents, "onEnter");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onRetain
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked during a transition between the matched 'to' and 'from states,
   * when the matched 'from' state is already active and is not being exited nor entered.
   *
   * This function can be injected with two additional special value:
   * - **`$transition$`**: The current transition
   * - **`$state$`**: The state that is retained
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback See callback in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   */
  onRetain = makeHookRegistrationFn(this._transitionEvents, "onRetain");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onExit
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked during a transition between the matched 'to' and 'from states,
   * when the matched 'from' state is being exited. This function is in injected with the exiting state's resolves.
   *
   * This function can be injected with two additional special value:
   * - **`$transition$`**: The current transition
   * - **`$state$`**: The state being entered
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback See callback in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   */
  onExit = makeHookRegistrationFn(this._transitionEvents, "onExit");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onFinish
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked when a transition is finished entering/exiting all states.
   *
   * This function can be injected with:
   * - **`$transition$`**: The current transition
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback See callback in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   */
  onFinish = makeHookRegistrationFn(this._transitionEvents, "onFinish");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onSuccess
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked when a transition has successfully completed between the matched
   * 'to' and 'from' state is being exited.
   * This function is in injected with the 'to' state's resolves (note: `JIT` resolves are not injected).
   *
   * This function can be injected with two additional special value:
   * - **`$transition$`**: The current transition
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback The function which will be injected and invoked, when a matching transition is started.
   *   The function's return value is ignored.
   */
  onSuccess = makeHookRegistrationFn(this._transitionEvents, "onSuccess");

  /**
   * @ngdoc function
   * @name ui.router.state.$transitionsProvider#onError
   * @methodOf ui.router.state.$transitionsProvider
   *
   * @description
   * Registers a function to be injected and invoked when a transition has failed for any reason between the matched
   * 'to' and 'from' state. The transition rejection reason is injected as `$error$`.
   *
   * @param {object} matchObject See transitionCriteria in {@link ui.router.state.$transitionsProvider#on $transitionsProvider.on}.
   * @param {function} callback The function which will be injected and invoked, when a matching transition is started.
   *   The function's return value is ignored.
   */
  onError = makeHookRegistrationFn(this._transitionEvents, "onError");
}
