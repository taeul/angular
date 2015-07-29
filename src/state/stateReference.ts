import {IState, IStateDeclaration} from "./interface";
import {abstractKey} from "../common/common";
/**
 * @ngdoc object
 * @name ui.router.state.type:StateReference
 *
 * @description
 * Wraps a state and a set of parameters with the value used to identify the state. Allows states
 * to be referenced in a consistent way in application code, separate from state definitions.
 *
 * @param {*} identifier  An identifier for a state. Either a fully-qualified path, or the object
 *            used to define the state.
 * @param {State} definition The `State` object definition.
 * @param {Object} params Parameters attached to the current state reference.
 * @param {Object} params Parameters attached to the current state reference.
 * @param {Object} base Optional. Base state used during lookup of state definition by identifier.
 *
 * @returns {Function}
 */
export default class StateReference {
  private _identifier;
  private _definition: IState;
  private _params;
  private _base;

  constructor(identifier, definition: IState, params, base) {
    this._identifier = identifier;
    this._definition = definition;
    this._params = params;
    this._base = base;
  }

  identifier() {
    return this._identifier;
  }

  $state(): IState {
    return this._definition;
  }

  state(): IStateDeclaration {
    return this._definition && this._definition.self;
  }

  params(newParams?: any) {
    if (newParams)
      return new StateReference(this._identifier, this._definition, newParams, this._base);
    return this._params;
  }

  base() {
    return this._base;
  }

  valid() {
    var def = this._definition;
    return !!(def && def.self && !def.self[abstractKey] && def.params.$$validates(this._params));
  }

  error() {
    switch (true) {
      case (!this._definition && !!this._base):
        return `Could not resolve '${this._identifier}' from state '${this._base}'`;
      case (!this._definition):
        return `No such state '${this._identifier}'`;
      case !this._definition.self:
        return `State '${this._identifier}' has an invalid definition`;
      case this._definition.self[abstractKey]:
        return `Cannot transition to abstract state '${this._identifier}'`;
    }
  }
}
