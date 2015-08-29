/// <reference path='../../typings/angularjs/angular.d.ts' />

import {IServiceProviderFactory} from "angular";

import {Transition} from "./transition";

import TargetState from "../state/targetState";

import {ITransPath} from "../path/interface";

import {IHookRegistry, ITransitionService, ITransitionOptions, IEventHook, IHookRegistration} from "./interface";

import HookRegistry from "./hookRegistry";

/**
 * The default transition options.
 * Include this object when applying custom defaults:
 * let reloadOpts = { reload: true, notify: true }
 * let options = defaults(theirOpts, customDefaults, defaultOptions);
 */
export let defaultTransOpts: ITransitionOptions = {
  location    : true,
  relative    : null,
  inherit     : false,
  notify      : true,
  reload      : false,
  trace       : false,
  custom      : {},
  current     : () => null
};

class TransitionService implements IHookRegistry {
  constructor() {
    this._reinit();
  }

  onBefore  : IHookRegistration;
  onStart   : IHookRegistration;
  onEnter   : IHookRegistration;
  onExit    : IHookRegistration;
  onSuccess : IHookRegistration;
  onError   : IHookRegistration;
  
  private _reinit() {
    let registry = new HookRegistry();
    let passthroughFns = ["onBefore", "onStart", "onEnter", "onExit", "onSuccess", "onError"];

    passthroughFns.forEach(fnName => this[fnName] = registry[fnName].bind(registry));
    this.$$hooks = (type: string) => registry.transitionEvents[type];
  }

  create(fromPath: ITransPath, targetState: TargetState) {
    return new Transition(fromPath, targetState);
  }

  $$hooks: (type: string) => IEventHook[];
}


let $transition: ITransitionService = new TransitionService();

$TransitionProvider.prototype = $transition;
function $TransitionProvider() {
  this._reinit.bind($transition)();

  /**
   * @ngdoc service
   * @name ui.router.state.$transition
   *
   * @description
   * The `$transition` service is a registry for global transition hooks, and is a factory for Transition objects.
   */
  this.$get = function $get() {
    return $transition;
  };
}

export default $transition;
export let $transitionProvider = $TransitionProvider;
angular.module('ui.router.state')
  .provider('$transition', <IServiceProviderFactory> $transitionProvider);