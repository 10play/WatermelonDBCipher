"use strict";

exports.__esModule = true;
exports._setCreateFactory = _setCreateFactory;
exports.createFactory = createFactory;
var _react = require("react");
var _createFactory = function (Component) {
  // eslint-disable-next-line react/function-component-definition
  return function (props) {
    return (0, _react.createElement)(Component, props);
  };
};

// undocumented binding for NT perf hack
function _setCreateFactory(newCreateFactory) {
  _createFactory = newCreateFactory;
}
function createFactory(Component) {
  return _createFactory(Component);
}