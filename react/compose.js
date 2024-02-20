"use strict";

exports.__esModule = true;
exports.default = void 0;
var compose = function (...funcs) {
  return function (Component) {
    var enhance = funcs.reduce(function (a, b) {
      return function (...args) {
        return a(b.apply(void 0, args));
      };
    }, function (arg) {
      return arg;
    });
    var EnhancedComponent = enhance(Component);
    EnhancedComponent.displayName = "".concat(Component.name, ".Enhanced");
    return EnhancedComponent;
  };
};
var _default = compose;
exports.default = _default;