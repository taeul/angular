import {IPromise, IQService} from "angular";
import {copy, prop} from "../../common/common";
import Queue from "../../common/queue";

import {ITreeChanges} from "../../transition/interface";
import {Transition} from "../../transition/transition";
import {TransitionRejection, RejectType} from "../../transition/rejectFactory";

import {IStateService, IStateDeclaration} from "../interface";
import ViewHooks from "./viewHooks";
import EnterExitHooks from "./enterExitHooks";
import ResolveHooks from "./resolveHooks";

/**
 * This class:
 *
 * * Takes a blank transition object and adds all the hooks necessary for it to behave like a state transition.
 *
 * * Runs the transition, returning a chained promise which:
 *   * transforms the resolved Transition.promise to the final destination state.
 *   * manages the rejected Transition.promise, checking for Dynamic or Redirected transitions
 *
 * * Registers a handler to update global $state data such as "active transitions" and "current state/params"
 *
 * * Registers view hooks, which maintain the list of active view configs and sync with/update the ui-views
 *
 * * Registers onEnter/onRetain/onExit hooks which delegate to the state's hooks of the same name, at the appropriate time
 *
 * * Registers eager and lazy resolve hooks
 */
export default class TransitionManager {
  private treeChanges: ITreeChanges;
  private enterExitHooks: EnterExitHooks;
  private viewHooks: ViewHooks;
  private resolveHooks: ResolveHooks;

  constructor(
      private transition: Transition,
      private $transitions,
      private $urlRouter,
      private $view, // service
      private $state: IStateService,
      private $stateParams, // service/obj
      private $q: IQService, // TODO: get from runtime.$q
      private activeTransQ: Queue<Transition>,
      private changeHistory: Queue<ITreeChanges>
  ) {
    this.viewHooks = new ViewHooks(transition, $view);
    this.enterExitHooks = new EnterExitHooks(transition);
    this.resolveHooks = new ResolveHooks(transition);

    this.treeChanges = transition.treeChanges();
  }

  registerHooks() {
    this.registerUpdateGlobalState();

    this.viewHooks.registerHooks();
    this.enterExitHooks.registerHooks();
    this.resolveHooks.registerHooks();
  }

  runTransition(): IPromise<any> {
    this.activeTransQ.clear();  // TODO: nuke this
    this.activeTransQ.enqueue(this.transition);
    return this.transition.run()
        .then((trans: Transition) => trans.to()) // resolve to the final state (TODO: good? bad?)
        .catch(error => this.transRejected(error)) // if rejected, handle dynamic and redirect
        .finally(() => this.activeTransQ.remove(this.transition));
  }

  registerUpdateGlobalState() {
    this.transition.onFinish({}, this.updateGlobalState.bind(this), {priority: -10000});
  }

  updateGlobalState() {
    let {treeChanges, transition, $state, changeHistory} = this;
    // Update globals in $state
    $state.$current = transition.$to();
    $state.current = $state.$current.self;
    changeHistory.enqueue(treeChanges);
    this.updateStateParams();
  }

  transRejected(error): (IStateDeclaration|IPromise<any>) {
    let {transition, $state, $stateParams, $q} = this;
    // Handle redirect and abort
    if (error instanceof TransitionRejection) {
      if (error.type === RejectType.IGNORED) {
        // Update $stateParmas/$state.params/$location.url if transition ignored, but dynamic params have changed.
        if (!$state.$current.params.$$filter(prop('dynamic')).$$equals($stateParams, transition.params())) {
          this.updateStateParams();
        }
        return $state.current;
      }

      if (error.type === RejectType.SUPERSEDED) {
        if (error.redirected && error.detail instanceof Transition) {
          let tMgr = this._redirectMgr(error.detail);
          tMgr.registerHooks();
          return tMgr.runTransition();
        }
      }
    }

    this.$transitions.defaultErrorHandler()(error);

    return $q.reject(error);
  }

  updateStateParams() {
    let {transition, $urlRouter, $state, $stateParams} = this;
    let options = transition.options();
    $state.params = transition.params();
    copy($state.params, $stateParams);
    $stateParams.$sync().$off();

    if (options.location && $state.$current.navigable) {
      $urlRouter.push($state.$current.navigable.url, $stateParams, { replace: options.location === 'replace' });
    }

    $urlRouter.update(true);
  }

  private _redirectMgr(redirect: Transition): TransitionManager {
    let {$transitions, $urlRouter, $view, $state, $stateParams, $q, activeTransQ, changeHistory} = this;
    return new TransitionManager(redirect, $transitions, $urlRouter, $view, $state, $stateParams, $q, activeTransQ, changeHistory);
  }
}
