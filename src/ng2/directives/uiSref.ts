/** @module ng2_directives */ /** */
import {UIRouter} from "../../router";
import {Directive, Inject, Input} from "@angular/core";
import {Optional} from "@angular/core";
import {ElementRef} from "@angular/core";
import {Renderer} from "@angular/core";
import {UIView, ParentUIViewInject} from "./uiView";
import {extend, Obj} from "../../common/common";
import {TransitionOptions} from "../../transition/interface";
import {Globals, UIRouterGlobals} from "../../globals";
import {Subscription, ReplaySubject} from "rxjs/Rx";
import {TargetState} from "../../state/targetState";

/** @hidden */
@Directive({ selector: 'a[uiSref]' })
export class AnchorUISref {
  constructor(public _el: ElementRef, public _renderer: Renderer) { }
  update(href: string) {
    this._renderer.setElementProperty(this._el.nativeElement, 'href', href);
  }
}

/**
 * A directive when clicked, initiates a [[Transition]] to a [[TargetState]].
 *
 * ### Purpose
 *
 * This directive is applied to anchor tags (`<a>`) or any other clickable element.  It is a state reference (or sref --
 * similar to an href).  When clicked, the directive will transition to that state by calling [[StateService.go]], 
 * and optionally supply state parameter values and transition options.
 *
 * When this directive is on an anchor tag, it will also add an `href` attribute to the anchor.
 *
 * ### Selector
 *
 * - `[uiSref]`: The directive is created as an attribute on an element, e.g., `<a uiSref></a>`
 * 
 * ### Inputs
 * 
 * - `uiSref`: the target state's name, e.g., `uiSref="foostate"`.  If a component template uses a relative `uiSref`,
 * e.g., `uiSref=".child"`, the reference is relative to that component's state.
 *
 * - `uiParams`: any target state parameter values, as an object, e.g., `[uiParams]="{ fooId: bar.fooId }"`
 *
 * - `uiOptions`: [[TransitionOptions]], e.g., `[uiOptions]="{ inherit: false }"`
 *
 * @example
 * ```html
 *
 * <!-- Targets bar state' -->
 * <a uiSref="bar">Bar</a>
 *
 * <!-- Assume this component's state is "foo".
 *      Relatively targets "foo.child" -->
 * <a uiSref=".child">Foo Child</a>
 *
 * <!-- Targets "bar" state and supplies parameter value -->
 * <a uiSref="bar" [uiParams]="{ barId: foo.barId }">Bar {{foo.barId}}</a>
 *
 * <!-- Targets "bar" state and parameter, doesn't inherit existing parameters-->
 * <a uiSref="bar" [uiParams]="{ barId: foo.barId }" [uiOptions]="{ inherit: false }">Bar {{foo.barId}}</a>
 * ```
 */
@Directive({
  selector: '[uiSref]',
  host: { '(click)': 'go()' }
})
export class UISref {
  @Input('uiSref') state: string;
  @Input('uiParams') params: any;
  @Input('uiOptions') options: any;

  public targetState$ = new ReplaySubject<TargetState>(1);
  private _emit: boolean = false;

  private _statesSub: Subscription;

  constructor(
      private _router: UIRouter,
      @Inject(UIView.PARENT_INJECT) public parent: ParentUIViewInject,
      @Optional() private _anchorUISref: AnchorUISref,
      @Inject(Globals) _globals: UIRouterGlobals
  ) {
    this._statesSub = _globals.states$.subscribe(() => this.update())
  }

  set "uiSref"(val: string) { this.state = val; this.update(); }
  set "uiParams"(val: Obj) { this.params = val; this.update(); }
  set "uiOptions"(val: TransitionOptions) { this.options = val; this.update(); }

  ngOnInit() {
    this._emit = true;
    this.update();
  }

  ngOnDestroy() {
    this._statesSub.unsubscribe();
    this.targetState$.unsubscribe();
  }

  update() {
    let $state = this._router.stateService;
    if (this._emit) {
      let newTarget = $state.target(this.state, this.params, this.getOptions());
      this.targetState$.next(newTarget);
    }

    if (this._anchorUISref) {
      let href = $state.href(this.state, this.params, this.getOptions());
      this._anchorUISref.update(href);
    }
  }

  getOptions() {
    let defaultOpts: TransitionOptions = {
      relative: this.parent && this.parent.context && this.parent.context.name,
      inherit: true ,
      source: "sref"
    };
    return extend(defaultOpts, this.options || {});
  }

  go() {
    this._router.stateService.go(this.state, this.params, this.getOptions());
    return false;
  }
}
