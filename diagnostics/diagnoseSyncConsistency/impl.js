"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.default = diagnoseSyncConsistency;
var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime/helpers/inheritsLoose"));
var _wrapNativeSuper2 = _interopRequireDefault(require("@babel/runtime/helpers/wrapNativeSuper"));
var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutPropertiesLoose"));
var _forEachAsync = _interopRequireDefault(require("../../utils/fp/forEachAsync"));
var _sync = require("../../sync");
var _RawRecord = require("../../RawRecord");
var _impl = require("../../sync/impl");
var _helpers = require("../../sync/impl/helpers");
var _censorRaw = _interopRequireDefault(require("../censorRaw"));
var _excluded = ["_status", "_changed"];
var yieldLog = function () {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
};
var recordsToMap = function (records) {
  var map = new Map();
  records.forEach(function (record) {
    if (map.has(record.id)) {
      throw new Error("\u274C Array of records has a duplicate ID ".concat(record.id));
    }
    map.set(record.id, record);
  });
  return map;
};
var renderRecord = function (record) {
  // eslint-disable-next-line no-unused-vars
  var rest = (0, _objectWithoutPropertiesLoose2.default)(record, _excluded);
  return JSON.stringify((0, _censorRaw.default)(rest), null, '  ');
};

// Indicates uncertainty whether local and remote states are fully synced - requires a retry
var InconsistentSyncError = /*#__PURE__*/function (_Error) {
  (0, _inheritsLoose2.default)(InconsistentSyncError, _Error);
  function InconsistentSyncError() {
    return _Error.apply(this, arguments) || this;
  }
  return InconsistentSyncError;
}( /*#__PURE__*/(0, _wrapNativeSuper2.default)(Error));
function diagnoseSyncConsistencyImpl({
  db: db,
  synchronize: synchronize,
  pullChanges: pullChanges,
  isInconsistentRecordAllowed = function () {
    return new Promise(function ($return) {
      return $return(false);
    });
  },
  isExcessLocalRecordAllowed = function () {
    return new Promise(function ($return) {
      return $return(false);
    });
  },
  isMissingLocalRecordAllowed = function () {
    return new Promise(function ($return) {
      return $return(false);
    });
  }
}, log) {
  return new Promise(function ($return, $error) {
    var totalCorruptionCount;
    log('# Sync consistency diagnostics');
    log();
    totalCorruptionCount = 0;
    // synchronize first, to ensure we're at consistent state
    // (twice to deal with just-resolved conflicts or data just pushed)
    log('Syncing once...');
    return Promise.resolve(synchronize()).then(function () {
      try {
        log('Syncing twice...');
        return Promise.resolve(synchronize()).then(function () {
          try {
            log('Synced.');

            // disallow further local changes
            return Promise.resolve(db.read(function (reader) {
              return new Promise(function ($return, $error) {
                var schema, allUserData, lastPulledAt, recentChanges, recentChangeCount, collections;
                return Promise.resolve(reader.callReader(function () {
                  return (0, _sync.hasUnsyncedChanges)({
                    database: db
                  });
                })).then(function ($await_9) {
                  try {
                    // ensure no more local changes
                    if ($await_9) {
                      log('❌ Sync consistency diagnostics failed because there are unsynced local changes - please try again.');
                      return $error(new InconsistentSyncError('unsynced local changes'));
                    }
                    log();

                    // fetch ALL data
                    log('Fetching all data. This may take a while (same as initial login), please be patient...');
                    ({
                      schema: schema
                    } = db);
                    return Promise.resolve(pullChanges({
                      lastPulledAt: null,
                      schemaVersion: schema.version,
                      migration: null
                    })).then(function ($await_10) {
                      try {
                        allUserData = $await_10;
                        log("Fetched all ".concat((0, _helpers.changeSetCount)(allUserData), " records"));

                        // Ensure that all data is consistent with current data - if so,
                        // an incremental sync will be empty
                        // NOTE: Fetching all data takes enough time that there's a great risk
                        // that many test will fail here. It would be easier to fetch all data
                        // first and then do a quick incremental sync, but that doesn't give us
                        // a guarantee of consistency
                        log("Ensuring no new remote changes...");
                        return Promise.resolve((0, _impl.getLastPulledAt)(db)).then(function ($await_11) {
                          try {
                            lastPulledAt = $await_11;
                            return Promise.resolve(pullChanges({
                              lastPulledAt: lastPulledAt,
                              schemaVersion: schema.version,
                              migration: null
                            })).then(function ($await_12) {
                              try {
                                recentChanges = $await_12;
                                recentChangeCount = (0, _helpers.changeSetCount)(recentChanges);
                                if (0 < recentChangeCount) {
                                  log("\u274C Sync consistency diagnostics failed because there were changes on the server between initial synchronization and now. Please try again.");
                                  log();
                                  return $error(new InconsistentSyncError('there were changes on the server between initial synchronization and now'));
                                }
                                log();

                                // Compare all the data
                                collections = Object.keys(db.collections.map);
                                return Promise.resolve((0, _forEachAsync.default)(collections, function (table) {
                                  return new Promise(function ($return, $error) {
                                    var tableCorruptionCount, records, created, updated, deleted, remoteRecords, localMap, tableSchema, remoteMap, inconsistentRecords, excessRecords, missingRecords, columnsToCheck;
                                    log("## Consistency of `".concat(table, "`"));
                                    log();
                                    return Promise.resolve(yieldLog()).then(function () {
                                      try {
                                        tableCorruptionCount = 0;
                                        return Promise.resolve(db.collections
                                        // $FlowFixMe
                                        .get(table).query().fetch()).then(function ($await_14) {
                                          try {
                                            records = $await_14;
                                            ({
                                              created: created,
                                              updated: updated,
                                              deleted: deleted
                                            } = allUserData[table]);
                                            if (deleted.length) {
                                              log("\u2753 Warning: ".concat(deleted.length, " deleted ").concat(table, " found in full (login) sync -- should not be necessary:"));
                                              log(deleted.join(','));
                                            }
                                            remoteRecords = created.concat(updated);
                                            log("Found ".concat(records.length, " `").concat(table, "` locally, ").concat(remoteRecords.length, " remotely"));

                                            // Transform records into hash maps for efficient lookup
                                            localMap = recordsToMap(records.map(function (r) {
                                              return r._raw;
                                            }));
                                            tableSchema = schema.tables[table];
                                            remoteMap = recordsToMap(remoteRecords.map(function (r) {
                                              return (0, _RawRecord.sanitizedRaw)(r, tableSchema);
                                            }));
                                            return Promise.resolve(yieldLog()).then(function () {
                                              try {
                                                inconsistentRecords = [];
                                                excessRecords = [];
                                                missingRecords = [];
                                                return Promise.resolve((0, _forEachAsync.default)(Array.from(remoteMap.entries()), function ([id, remote]) {
                                                  return new Promise(function ($return, $error) {
                                                    var local = localMap.get(id);
                                                    if (!local) {
                                                      return Promise.resolve(isMissingLocalRecordAllowed({
                                                        tableName: table,
                                                        remote: remote
                                                      })).then(function ($await_16) {
                                                        try {
                                                          if ($await_16) {
                                                            missingRecords.push(id);
                                                          } else {
                                                            log();
                                                            log("\u274C MISSING: Record `".concat(table, ".").concat(id, "` is present on server, but missing in local db"));
                                                            log();
                                                            log('```');
                                                            log("REMOTE: ".concat(renderRecord(remote)));
                                                            log('```');
                                                            tableCorruptionCount += 1;
                                                          }
                                                          return function () {
                                                            return $return();
                                                          }.call(this);
                                                        } catch ($boundEx) {
                                                          return $error($boundEx);
                                                        }
                                                      }.bind(this), $error);
                                                    }
                                                    return function () {
                                                      return $return();
                                                    }.call(this);
                                                  });
                                                })).then(function () {
                                                  try {
                                                    return Promise.resolve(yieldLog()).then(function () {
                                                      try {
                                                        columnsToCheck = tableSchema.columnArray.map(function (column) {
                                                          return column.name;
                                                        });
                                                        return Promise.resolve((0, _forEachAsync.default)(Array.from(localMap.entries()), function ([id, record]) {
                                                          return new Promise(function ($return, $error) {
                                                            var local, remote, recordIsConsistent, inconsistentColumns;
                                                            local = record;
                                                            remote = remoteMap.get(id);
                                                            // console.log(id, local, remote)
                                                            if (!remote) {
                                                              return Promise.resolve(isExcessLocalRecordAllowed({
                                                                tableName: table,
                                                                local: local
                                                              })).then(function ($await_19) {
                                                                try {
                                                                  if ($await_19) {
                                                                    excessRecords.push(id);
                                                                  } else {
                                                                    log();
                                                                    log("\u274C EXCESS: Record `".concat(table, ".").concat(id, "` is present in local db, but not on server"));
                                                                    log();
                                                                    log('```');
                                                                    log("LOCAL: ".concat(renderRecord(local)));
                                                                    log('```');
                                                                    tableCorruptionCount += 1;
                                                                  }
                                                                  return $If_3.call(this);
                                                                } catch ($boundEx) {
                                                                  return $error($boundEx);
                                                                }
                                                              }.bind(this), $error);
                                                            } else {
                                                              recordIsConsistent = local.id === remote.id && 'synced' === local._status && '' === local._changed && columnsToCheck.every(function (column) {
                                                                return local[column] === remote[column];
                                                              });
                                                              if (!recordIsConsistent) {
                                                                inconsistentColumns = columnsToCheck.filter(function (column) {
                                                                  return local[column] !== remote[column];
                                                                });
                                                                return Promise.resolve(isInconsistentRecordAllowed({
                                                                  tableName: table,
                                                                  local: local,
                                                                  remote: remote,
                                                                  inconsistentColumns: inconsistentColumns
                                                                })).then(function ($await_20) {
                                                                  try {
                                                                    if ($await_20) {
                                                                      inconsistentRecords.push(id);
                                                                    } else {
                                                                      tableCorruptionCount += 1;
                                                                      log();
                                                                      log("\u274C INCONSISTENCY: Record `".concat(table, ".").concat(id, "` differs between server and local db"));
                                                                      log();
                                                                      log('```');
                                                                      log("LOCAL: ".concat(renderRecord(local)));
                                                                      log("REMOTE: ".concat(renderRecord(remote)));
                                                                      log("DIFFERENCE:");
                                                                      inconsistentColumns.forEach(function (column) {
                                                                        log("- ".concat(column, " | local: ").concat(JSON.stringify(local[column]), " | remote: ").concat(JSON.stringify(remote[column])));
                                                                      });
                                                                      log('```');
                                                                    }
                                                                    return $If_4.call(this);
                                                                  } catch ($boundEx) {
                                                                    return $error($boundEx);
                                                                  }
                                                                }.bind(this), $error);
                                                              }
                                                              function $If_4() {
                                                                return $If_3.call(this);
                                                              }
                                                              return $If_4.call(this);
                                                            }
                                                            function $If_3() {
                                                              return $return();
                                                            }
                                                          });
                                                        })).then(function () {
                                                          try {
                                                            log();
                                                            if (inconsistentRecords.length) {
                                                              log("\u2753 Config allowed ".concat(inconsistentRecords.length, " inconsistent `").concat(table, "`"));
                                                              // log(inconsistentRecords.join(','))
                                                            }

                                                            if (excessRecords.length) {
                                                              log("\u2753 Config allowed ".concat(excessRecords.length, " excess local `").concat(table, "`"));
                                                              // log(excessRecords.join(','))
                                                            }

                                                            if (missingRecords.length) {
                                                              log("\u2753 Config allowed ".concat(missingRecords.length, " locally missing `").concat(table, "`"));
                                                              // log(missingRecords.join(','))
                                                            }

                                                            if (!tableCorruptionCount) {
                                                              log("No corruption found in this table");
                                                            }
                                                            totalCorruptionCount += tableCorruptionCount;
                                                            log();
                                                            return Promise.resolve(yieldLog()).then(function () {
                                                              try {
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
                                })).then(function () {
                                  try {
                                    log('## Conclusion');
                                    log();
                                    if (totalCorruptionCount) {
                                      log("\u274C ".concat(totalCorruptionCount, " issues found"));
                                    } else {
                                      log("\u2705 No corruption found in this database!");
                                    }
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
                  } catch ($boundEx) {
                    return $error($boundEx);
                  }
                }, $error);
              });
            })).then(function () {
              try {
                return $return(totalCorruptionCount);
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
}
function diagnoseSyncConsistency(options) {
  return new Promise(function ($return, $error) {
    var startTime, logText, log, allowedAttempts, issueCount;
    startTime = Date.now();
    logText = '';
    log = function (text = '') {
      var _options$log;
      logText = "".concat(logText, "\n").concat(text);
      null === (_options$log = options.log) || void 0 === _options$log ? void 0 : _options$log.call(options, text);
    };
    allowedAttempts = 5;
    var $Loop_5_trampoline;
    function $Loop_5() {
      if (true) {
        allowedAttempts -= 1;
        var $Try_1_Post = function () {
          try {
            return $Loop_5;
          } catch ($boundEx) {
            return $error($boundEx);
          }
        };
        var $Try_1_Catch = function (error) {
          try {
            if (error instanceof InconsistentSyncError && 1 <= allowedAttempts) {
              return $Loop_5;
            } else {
              throw error;
            }
            return $Try_1_Post();
          } catch ($boundEx) {
            return $error($boundEx);
          }
        };
        try {
          return Promise.resolve(diagnoseSyncConsistencyImpl(options, log)).then(function ($await_25) {
            try {
              issueCount = $await_25;
              log();
              log("Done in ".concat((Date.now() - startTime) / 1000, " s."));
              return $return({
                issueCount: issueCount,
                log: logText
              });
            } catch ($boundEx) {
              return $Try_1_Catch($boundEx);
            }
          }, $Try_1_Catch);
        } catch (error) {
          $Try_1_Catch(error)
        }
      } else return [1];
    }
    return ($Loop_5_trampoline = function (q) {
      while (q) {
        if (q.then) return void q.then($Loop_5_trampoline, $error);
        try {
          if (q.pop) {
            if (q.length) return q.pop() ? $Loop_5_exit.call(this) : q;else q = $Loop_5;
          } else q = q.call(this);
        } catch (_exception) {
          return $error(_exception);
        }
      }
    }.bind(this))($Loop_5);
    function $Loop_5_exit() {
      // eslint-disable-next-line no-unreachable
      return $error(new Error('unreachable'));
    }
  });
}