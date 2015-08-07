import {IParamsPath, IParamsNode} from "../path/interface"
import {IState} from "../state/interface"
import {extend, inherit} from "../common/common"

/** 
 * This class calculates parameter values from a IParamsPath.  The param values for the path
 * are available directly on the resulting object.  Param values for a specific state in the
 * path may be retrieved using the $byState(stateName) function.  
 */
export class ParamValues {
    constructor(private _byState) {}
    
    $byState(stateName: string) {
        return this._byState[stateName]; 
    }
    
    static paramsByState(path: IParamsPath): {[key: string]: any} {
        const byState = (memo, node: IParamsNode) => { 
            memo[node.state.name] = node.ownParams; 
            return memo; 
        };
        return path.nodes().reduce(byState, {});
    }

    static fromPath(path: IParamsPath): ParamValues {
        let $byState = ParamValues.paramsByState(path);
        let params = inherit(new ParamValues($byState), {});
        const extendParams = (memo, node: IParamsNode) => extend(params, node.ownParams);
        return path.nodes().reduce(extendParams, params);
    }
}
