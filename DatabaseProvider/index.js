"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.withDatabase = exports.DatabaseProvider = exports.DatabaseContext = exports.DatabaseConsumer = void 0;
var _withDatabase = _interopRequireDefault(require("../react/withDatabase"));
exports.withDatabase = _withDatabase.default;
var _DatabaseContext = _interopRequireWildcard(require("../react/DatabaseContext"));
exports.DatabaseContext = _DatabaseContext.default;
exports.DatabaseConsumer = _DatabaseContext.DatabaseConsumer;
var _DatabaseProvider = _interopRequireDefault(require("../react/DatabaseProvider"));
exports.DatabaseProvider = _DatabaseProvider.default;
function _getRequireWildcardCache(nodeInterop) { if ("function" !== typeof WeakMap) return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (null === obj || "object" !== typeof obj && "function" !== typeof obj) { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if ("default" !== key && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }