"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.default = void 0;
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));
var _fp = require("../../utils/fp");
var _censorRaw = _interopRequireDefault(require("../../diagnostics/censorRaw"));
var censorLog = function (log) {
  return (0, _extends2.default)({}, log, log.resolvedConflicts ? {
    // $FlowFixMe
    resolvedConflicts: log.resolvedConflicts.map(function (conflict) {
      return (0, _fp.mapObj)(_censorRaw.default)(conflict);
    })
  } : {});
};
var censorLogs = function (logs) {
  return logs.map(censorLog);
};
var SyncLogger = /*#__PURE__*/function () {
  function SyncLogger(limit = 10) {
    this._logs = [];
    this._limit = limit;
  }
  var _proto = SyncLogger.prototype;
  _proto.newLog = function newLog() {
    if (this._logs.length >= this._limit) {
      this._logs.shift();
    }
    var log = {};
    this._logs.push(log);
    return log;
  };
  (0, _createClass2.default)(SyncLogger, [{
    key: "logs",
    get: function get() {
      // censor logs before viewing them
      return censorLogs(this._logs);
    }
  }, {
    key: "formattedLogs",
    get: function get() {
      return JSON.stringify(this.logs, null, 2);
    }
  }]);
  return SyncLogger;
}();
exports.default = SyncLogger;