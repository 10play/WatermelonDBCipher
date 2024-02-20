"use strict";

exports.__esModule = true;
exports.default = exports.censorValue = void 0;
var _fp = require("../utils/fp");
// beginning, end, length
var censorValue = function (value) {
  return "".concat(value.slice(0, 2), "***").concat(value.slice(-2), "(").concat(value.length, ")");
};
exports.censorValue = censorValue;
var shouldCensorKey = function (key) {
  return 'id' !== key && !key.endsWith('_id') && '_status' !== key && '_changed' !== key;
};

// $FlowFixMe
var censorRaw = (0, _fp.mapObj)(function (value, key) {
  return shouldCensorKey(key) && 'string' === typeof value ? censorValue(value) : value;
});
var _default = censorRaw;
exports.default = _default;