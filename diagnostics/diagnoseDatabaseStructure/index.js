"use strict";

exports.__esModule = true;
exports.default = diagnoseDatabaseStructure;
function diagnoseDatabaseStructure(options) {
  return require('./impl').default(options);
}