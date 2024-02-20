"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.default = diagnoseDatabaseStructure;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _forEachAsync = _interopRequireDefault(require("../../utils/fp/forEachAsync"));
var _Schema = require("../../Schema");
var Q = _interopRequireWildcard(require("../../QueryDescription"));
var _censorRaw = _interopRequireDefault(require("../censorRaw"));
function _getRequireWildcardCache(nodeInterop) { if ("function" !== typeof WeakMap) return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (null === obj || "object" !== typeof obj && "function" !== typeof obj) { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if ("default" !== key && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/* eslint-disable no-continue */
var pad = function (text, len) {
  var padding = Array(Math.max(0, len - text.length)).fill(' ').join('');
  return "".concat(text).concat(padding);
};
var yieldLog = function () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
};
var getCollections = function (db) {
  return Object.entries(db.collections.map).map(function ([table, collection]) {
    return {
      name: table,
      // $FlowFixMe
      parents: Object.entries(collection.modelClass.associations)
      // $FlowFixMe
      .filter(function ([, association]) {
        return 'belongs_to' === association.type;
      })
      // $FlowFixMe
      .map(function ([parentTable, association]) {
        return [parentTable, association.key];
      })
    };
  });
};
var logCollections = function (log, collections) {
  collections.forEach(function ({
    name: name,
    parents: parents
  }) {
    var parentsText = parents.length ? parents.map(function ([table, key]) {
      return pad("".concat(table, "(").concat(key, ")"), 27);
    }).join(', ') : '(root)';
    log("- ".concat(pad(name, 20), ": ").concat(parentsText));
  });
  log();
};
var isUniqueIndexValid = function (collection, key) {
  var index = collection.constraints.unique[key];
  if (!index) {
    return {
      skip: true
    };
  }
  var lokiMap = Object.entries(index.lokiMap);
  // >= and undefined checks are needed because items are not removed from unique index, just made undefined
  var lokiMapValid = lokiMap.length >= collection.data.length && lokiMap.every(function ([lokiId, value]) {
    return value === undefined || collection.get(lokiId)[key] === value;
  });
  var keyMap = Object.entries(index.keyMap);
  var keyMapValid = keyMap.length >= collection.data.length && keyMap.every(function ([value, record]) {
    return record === undefined ||
    // $FlowFixMe
    record[key] === value && collection.get(record.$loki) === record;
  });
  return {
    skip: false,
    lokiMapValid: lokiMapValid,
    keyMapValid: keyMapValid
  };
};
function verifyLokiIndices(db, log) {
  return new Promise(function ($return) {
    log('## Verify LokiJS indices');
    var issueCount = 0;

    // $FlowFixMe
    var {
      loki: loki
    } = db.adapter.underlyingAdapter._driver;
    loki.collections.forEach(function (collection) {
      var {
        name: name,
        idIndex: idIndex,
        data: data,
        binaryIndices: binaryIndices,
        uniqueNames: uniqueNames
      } = collection;
      log("**Indices of `".concat(name, "`**"));
      log();

      // check idIndex
      if (idIndex) {
        if (idIndex.length === data.length && idIndex.every(function (lokiId, i) {
          return data[i].$loki === lokiId;
        })) {
          log('idIndex: ok');
        } else {
          log('❌ idIndex: corrupted!');
          issueCount += 1;
        }
      } else {
        log('idIndex: (skipping)');
      }

      // check binary indices
      var binKeys = Object.keys(binaryIndices);
      binKeys.forEach(function (binKey) {
        if (collection.checkIndex(binKey, {
          repair: true
        })) {
          log("".concat(binKey, " binary index: ok"));
        } else {
          log("\u274C ".concat(binKey, " binary index: corrupted! checking if repaired..."));
          issueCount += 1;
          if (collection.checkIndex(binKey)) {
            log('repaired ok');
          } else {
            log('❌❌ still broken after repair!');
          }
        }
      });

      // check unique indices
      if ('local_storage' !== name && !(1 === uniqueNames.length && 'id' === uniqueNames[0])) {
        log("\u274C expected to only have a single unique index for 'id', has: ".concat(uniqueNames.join(', ')));
        issueCount += 1;
      }
      uniqueNames.forEach(function (key) {
        var results = isUniqueIndexValid(collection, key);
        if (!results.skip) {
          if (results.lokiMapValid) {
            log("".concat(key, " index loki map: ok"));
          } else {
            log("\u274C ".concat(key, " index loki map: corrupted!"));
            issueCount += 1;
          }
          if (results.keyMapValid) {
            log("".concat(key, " index key map: ok"));
          } else {
            log("\u274C ".concat(key, " index key map: corrupted!"));
            issueCount += 1;
          }
        } else {
          log("".concat(key, " index: (skipping)"));
        }
      });
      log();
    });
    return $return(issueCount);
  });
}
function diagnoseDatabaseStructure({
  db: db,
  log: _log = function () {},
  shouldSkipParent = function () {
    return false;
  },
  isOrphanAllowed = function () {
    return new Promise(function ($return) {
      return $return(false);
    });
  }
}) {
  return db.read(function () {
    return new Promise(function ($return, $error) {
      var startTime, logText, log, totalIssueCount, collections;
      startTime = Date.now();
      logText = '';
      log = function log(text = '') {
        logText = "".concat(logText, "\n").concat(text);
        _log(text);
      };
      totalIssueCount = 0;
      log('# Database structure diagnostics');
      log();
      if ('loki' === db.adapter.underlyingAdapter.constructor.adapterType) {
        return Promise.resolve(verifyLokiIndices(db, log)).then(function ($await_4) {
          try {
            // eslint-disable-next-line require-atomic-updates
            totalIssueCount += $await_4;
            return function $If_1() {
              log('## Collection parent-child relations');
              log();
              collections = getCollections(db);
              // log(JSON.stringify(collections, null, 2))
              log('```');
              logCollections(log, collections);
              log('```');
              return Promise.resolve(yieldLog()).then(function ($await_5) {
                try {
                  return Promise.resolve((0, _forEachAsync.default)(collections, function ({
                    name: name,
                    parents: parents
                  }) {
                    return new Promise(function ($return, $error) {
                      var records, collectionOrphanCount;
                      log("## Structure of ".concat(name));
                      log();
                      if (!parents.length) {
                        log("(skipping - no parents)");
                        log();
                        return $return();
                      }
                      return Promise.resolve(yieldLog()).then(function ($await_6) {
                        try {
                          return Promise.resolve(db.collections
                          // $FlowFixMe
                          .get(name).query().fetch()).then(function ($await_7) {
                            try {
                              records = $await_7;
                              log("Found ".concat(records.length, " `").concat(name, "`"));
                              return Promise.resolve(yieldLog()).then(function ($await_8) {
                                try {
                                  collectionOrphanCount = 0;
                                  return Promise.resolve((0, _forEachAsync.default)(parents, function ([parentName, key]) {
                                    return new Promise(function ($return, $error) {
                                      var expectedParentSet, expectedParents, parentsFound, allowedOprhans, foundParentSet, orphans;
                                      expectedParentSet = new Set([]);
                                      records.forEach(function (record) {
                                        var id = record._getRaw(key);
                                        if (null !== id && !shouldSkipParent({
                                          tableName: name,
                                          parentTableName: parentName,
                                          relationKey: key,
                                          record: record._raw
                                        })) {
                                          expectedParentSet.add(id);
                                        }
                                      });
                                      expectedParents = (0, _toConsumableArray2.default)(expectedParentSet);
                                      return Promise.resolve(db.collections
                                      // $FlowFixMe
                                      .get(parentName)
                                      // $FlowFixMe
                                      .query(Q.where((0, _Schema.columnName)('id'), Q.oneOf(expectedParents))).fetch()).then(function ($await_9) {
                                        try {
                                          parentsFound = $await_9;
                                          log();
                                          log("Found ".concat(parentsFound.length, " parent `").concat(parentName, "` (via `").concat(name, ".").concat(key, "`)"));
                                          allowedOprhans = [];
                                          if (parentsFound.length !== expectedParents.length) {
                                            foundParentSet = new Set(parentsFound.map(function (record) {
                                              return record.id;
                                            }));
                                            orphans = [];
                                            return Promise.resolve((0, _forEachAsync.default)(records, function (record) {
                                              return new Promise(function ($return, $error) {
                                                var parentId;
                                                parentId = record._getRaw(key);
                                                if (null === parentId || foundParentSet.has(parentId) || shouldSkipParent({
                                                  tableName: name,
                                                  parentTableName: parentName,
                                                  relationKey: key,
                                                  record: record._raw
                                                })) {
                                                  return $If_3.call(this);
                                                } // ok
                                                else {
                                                  return Promise.resolve(isOrphanAllowed({
                                                    tableName: name,
                                                    parentTableName: parentName,
                                                    relationKey: key,
                                                    record: record._raw
                                                  })).then(function ($await_10) {
                                                    try {
                                                      if ($await_10) {
                                                        allowedOprhans.push(record);
                                                      } else {
                                                        orphans.push(record);
                                                      }
                                                      return $If_3.call(this);
                                                    } catch ($boundEx) {
                                                      return $error($boundEx);
                                                    }
                                                  }.bind(this), $error);
                                                }
                                                function $If_3() {
                                                  return $return();
                                                }
                                              });
                                            })).then(function ($await_11) {
                                              try {
                                                if (orphans.length) {
                                                  collectionOrphanCount += orphans.length;
                                                  log("\u274C Error! ".concat(expectedParents.length - parentsFound.length, " missing parent `").concat(parentName, "` across ").concat(orphans.length, " orphans:"));
                                                  orphans.forEach(function (orphan) {
                                                    log();
                                                    log("MISSING PARENT `".concat(parentName, ".").concat(orphan._getRaw(key), " (via ").concat(key, ")`:"));
                                                    log();
                                                    log('```');
                                                    log("".concat(JSON.stringify((0, _censorRaw.default)(orphan._raw), null, '  ')));
                                                    log('```');
                                                  });
                                                }
                                                return Promise.resolve(yieldLog()).then(function ($await_12) {
                                                  try {
                                                    if (allowedOprhans.length) {
                                                      log("\u2753 Config allowed ".concat(allowedOprhans.length, " orphans for this field"));
                                                      // log(allowedOprhans.join(','))
                                                    }
                                                    return $If_2.call(this);
                                                  } catch ($boundEx) {
                                                    return $error($boundEx);
                                                  }
                                                }.bind(this), $error);
                                              } catch ($boundEx) {
                                                return $error($boundEx);
                                              }
                                            }.bind(this), $error);
                                          }
                                          function $If_2() {
                                            return Promise.resolve(yieldLog()).then(function ($await_13) {
                                              try {
                                                return $return();
                                              } catch ($boundEx) {
                                                return $error($boundEx);
                                              }
                                            }, $error);
                                          }
                                          return $If_2.call(this);
                                        } catch ($boundEx) {
                                          return $error($boundEx);
                                        }
                                      }.bind(this), $error);
                                    });
                                  })).then(function ($await_14) {
                                    try {
                                      if (!collectionOrphanCount) {
                                        // log(`No orphans found in ${name}`)
                                      }
                                      totalIssueCount += collectionOrphanCount;
                                      log();
                                      return $return();
                                    } catch ($boundEx) {
                                      return $error($boundEx);
                                    }
                                  }, $error);
                                } catch ($boundEx) {
                                  return $error($boundEx);
                                }
                              }, $error);
                            } catch ($boundEx) {
                              return $error($boundEx);
                            }
                          }, $error);
                        } catch ($boundEx) {
                          return $error($boundEx);
                        }
                      }, $error);
                    });
                  })).then(function ($await_15) {
                    try {
                      log('## Conclusion');
                      log();
                      if (totalIssueCount) {
                        log("\u274C ".concat(totalIssueCount, " issues found"));
                      } else {
                        log("\u2705 No issues found in this database!");
                      }
                      log();
                      log("Done in ".concat((Date.now() - startTime) / 1000, " s."));
                      return $return({
                        issueCount: totalIssueCount,
                        log: logText
                      });
                    } catch ($boundEx) {
                      return $error($boundEx);
                    }
                  }, $error);
                } catch ($boundEx) {
                  return $error($boundEx);
                }
              }, $error);
            }.call(this);
          } catch ($boundEx) {
            return $error($boundEx);
          }
        }.bind(this), $error);
      }
      return function $If_1() {
        log('## Collection parent-child relations');
        log();
        collections = getCollections(db);
        log('```');
        logCollections(log, collections);
        log('```');
        return Promise.resolve(yieldLog()).then(function ($await_5) {
          try {
            return Promise.resolve((0, _forEachAsync.default)(collections, function ({
              name: name,
              parents: parents
            }) {
              return new Promise(function ($return, $error) {
                var records, collectionOrphanCount;
                log("## Structure of ".concat(name));
                log();
                if (!parents.length) {
                  log("(skipping - no parents)");
                  log();
                  return $return();
                }
                return Promise.resolve(yieldLog()).then(function ($await_6) {
                  try {
                    return Promise.resolve(db.collections.get(name).query().fetch()).then(function ($await_7) {
                      try {
                        records = $await_7;
                        log("Found ".concat(records.length, " `").concat(name, "`"));
                        return Promise.resolve(yieldLog()).then(function ($await_8) {
                          try {
                            collectionOrphanCount = 0;
                            return Promise.resolve((0, _forEachAsync.default)(parents, function ([parentName, key]) {
                              return new Promise(function ($return, $error) {
                                var expectedParentSet, expectedParents, parentsFound, allowedOprhans, foundParentSet, orphans;
                                expectedParentSet = new Set([]);
                                records.forEach(function (record) {
                                  var id = record._getRaw(key);
                                  if (null !== id && !shouldSkipParent({
                                    tableName: name,
                                    parentTableName: parentName,
                                    relationKey: key,
                                    record: record._raw
                                  })) {
                                    expectedParentSet.add(id);
                                  }
                                });
                                expectedParents = (0, _toConsumableArray2.default)(expectedParentSet);
                                return Promise.resolve(db.collections.get(parentName).query(Q.where((0, _Schema.columnName)('id'), Q.oneOf(expectedParents))).fetch()).then(function ($await_9) {
                                  try {
                                    parentsFound = $await_9;
                                    log();
                                    log("Found ".concat(parentsFound.length, " parent `").concat(parentName, "` (via `").concat(name, ".").concat(key, "`)"));
                                    allowedOprhans = [];
                                    if (parentsFound.length !== expectedParents.length) {
                                      foundParentSet = new Set(parentsFound.map(function (record) {
                                        return record.id;
                                      }));
                                      orphans = [];
                                      return Promise.resolve((0, _forEachAsync.default)(records, function (record) {
                                        return new Promise(function ($return, $error) {
                                          var parentId;
                                          parentId = record._getRaw(key);
                                          if (null === parentId || foundParentSet.has(parentId) || shouldSkipParent({
                                            tableName: name,
                                            parentTableName: parentName,
                                            relationKey: key,
                                            record: record._raw
                                          })) {
                                            return $If_3.call(this);
                                          } else {
                                            return Promise.resolve(isOrphanAllowed({
                                              tableName: name,
                                              parentTableName: parentName,
                                              relationKey: key,
                                              record: record._raw
                                            })).then(function ($await_10) {
                                              try {
                                                if ($await_10) {
                                                  allowedOprhans.push(record);
                                                } else {
                                                  orphans.push(record);
                                                }
                                                return $If_3.call(this);
                                              } catch ($boundEx) {
                                                return $error($boundEx);
                                              }
                                            }.bind(this), $error);
                                          }
                                          function $If_3() {
                                            return $return();
                                          }
                                        });
                                      })).then(function ($await_11) {
                                        try {
                                          if (orphans.length) {
                                            collectionOrphanCount += orphans.length;
                                            log("\u274C Error! ".concat(expectedParents.length - parentsFound.length, " missing parent `").concat(parentName, "` across ").concat(orphans.length, " orphans:"));
                                            orphans.forEach(function (orphan) {
                                              log();
                                              log("MISSING PARENT `".concat(parentName, ".").concat(orphan._getRaw(key), " (via ").concat(key, ")`:"));
                                              log();
                                              log('```');
                                              log("".concat(JSON.stringify((0, _censorRaw.default)(orphan._raw), null, '  ')));
                                              log('```');
                                            });
                                          }
                                          return Promise.resolve(yieldLog()).then(function ($await_12) {
                                            try {
                                              if (allowedOprhans.length) {
                                                log("\u2753 Config allowed ".concat(allowedOprhans.length, " orphans for this field"));
                                              }
                                              return $If_2.call(this);
                                            } catch ($boundEx) {
                                              return $error($boundEx);
                                            }
                                          }.bind(this), $error);
                                        } catch ($boundEx) {
                                          return $error($boundEx);
                                        }
                                      }.bind(this), $error);
                                    }
                                    function $If_2() {
                                      return Promise.resolve(yieldLog()).then(function ($await_13) {
                                        try {
                                          return $return();
                                        } catch ($boundEx) {
                                          return $error($boundEx);
                                        }
                                      }, $error);
                                    }
                                    return $If_2.call(this);
                                  } catch ($boundEx) {
                                    return $error($boundEx);
                                  }
                                }.bind(this), $error);
                              });
                            })).then(function ($await_14) {
                              try {
                                if (!collectionOrphanCount) {}
                                totalIssueCount += collectionOrphanCount;
                                log();
                                return $return();
                              } catch ($boundEx) {
                                return $error($boundEx);
                              }
                            }, $error);
                          } catch ($boundEx) {
                            return $error($boundEx);
                          }
                        }, $error);
                      } catch ($boundEx) {
                        return $error($boundEx);
                      }
                    }, $error);
                  } catch ($boundEx) {
                    return $error($boundEx);
                  }
                }, $error);
              });
            })).then(function ($await_15) {
              try {
                log('## Conclusion');
                log();
                if (totalIssueCount) {
                  log("\u274C ".concat(totalIssueCount, " issues found"));
                } else {
                  log("\u2705 No issues found in this database!");
                }
                log();
                log("Done in ".concat((Date.now() - startTime) / 1000, " s."));
                return $return({
                  issueCount: totalIssueCount,
                  log: logText
                });
              } catch ($boundEx) {
                return $error($boundEx);
              }
            }, $error);
          } catch ($boundEx) {
            return $error($boundEx);
          }
        }, $error);
      }.call(this);
    });
  });
}