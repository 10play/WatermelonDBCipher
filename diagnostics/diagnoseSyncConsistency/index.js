"use strict";

exports.__esModule = true;
exports.default = diagnoseSyncConsistency;
function diagnoseSyncConsistency(options) {
  return require('./impl').default(options);
}