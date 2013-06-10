
$ViewDirective.$inject = ['$state', '$compile', '$controller', '$injector', '$anchorScroll'];
function $ViewDirective(   $state,   $compile,   $controller,   $injector,   $anchorScroll) {
  // Unfortunately there is no neat way to ask $injector if a service exists
  var $animator; try { $animator = $injector.get('$animator'); } catch (e) { /* do nothing */ }

  var directive = {
    restrict: 'ECA',
    terminal: true,
    transclude: true,
    compile: function (element, attr, transclude) {
      return function(scope, element, attr) {
        var viewScope, viewLocals,
            name = attr[directive.name] || attr.name || '',
            onloadExp = attr.onload || '',
            animate = isDefined($animator) && $animator(scope, attr);

        // Put back the compiled initial view
        element.append(transclude(scope));

        // Find the details of the parent view directive (if any) and use it
        // to derive our own qualified view name, then hang our own details
        // off the DOM so child directives can find it.
        var parent = element.parent().inheritedData('$uiView');
        if (name.indexOf('@') < 0) name  = name + '@' + (parent ? parent.state.name : '');
        var view = { name: name, state: null };
        element.data('$uiView', view);

        scope.$on('$stateChangeSuccess', function() { updateView(true); });
        updateView(false);

        function updateView(doAnimate) {
          var locals = $state.$current && $state.$current.locals[name];
          if (locals === viewLocals) return; // nothing to do

          // Remove existing content
          if (animate && doAnimate) {
            animate.leave(element.contents(), element);
          } else {
            element.html('');
          }

          // Destroy previous view scope
          if (viewScope) {
            viewScope.$destroy();
            viewScope = null;
          }

          if (locals) {
            viewLocals = locals;
            view.state = locals.$$state;

            var contents;
            if (animate && doAnimate) {
              contents = angular.element('<div></div>').html(locals.$template).contents();
              animate.enter(contents, element);
            } else {
              element.html(locals.$template);
              contents = element.contents();
            }

            var link = $compile(contents);
            viewScope = scope.$new();
            if (locals.$$controller) {
              locals.$scope = viewScope;
              var controller = $controller(locals.$$controller, locals);
              element.children().data('$ngControllerController', controller);
            }
            link(viewScope);
            viewScope.$emit('$viewContentLoaded');
            viewScope.$eval(onloadExp);

            // TODO: This seems strange, shouldn't $anchorScroll listen for $viewContentLoaded if necessary?
            // $anchorScroll might listen on event...
            $anchorScroll();
          } else {
            viewLocals = null;
            view.state = null;

            // Restore the initial view
            var compiledElem = transclude(scope);
            if (animate && doAnimate) {
              animate.enter(compiledElem, element);
            } else {
              element.append(compiledElem);
            }
          }
        }
      };
    }
  };
  return directive;
}

angular.module('ui.state').directive('uiView', $ViewDirective);
