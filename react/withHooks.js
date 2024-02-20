"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.default = withHooks;
var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));
var _helpers = require("./helpers");
function withHooks(hookTransformer) {
  return function (BaseComponent) {
    var factory = (0, _helpers.createFactory)(BaseComponent);
    var enhanced = function (props) {
      var newProps = hookTransformer(props);
      return factory((0, _extends2.default)({}, props, newProps));
    };
    if ('production' !== process.env.NODE_ENV) {
      var baseName = BaseComponent.displayName || BaseComponent.name || 'anon';
      // $FlowFixMe
      enhanced.displayName = "withHooks[".concat(baseName, "]");
    }
    return enhanced;
  };
}