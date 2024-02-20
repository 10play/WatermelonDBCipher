"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.encodeCreateIndices = encodeCreateIndices;
exports.encodeDropIndices = encodeDropIndices;
exports.encodeSchema = exports.encodeMigrationSteps = void 0;
var _RawRecord = require("../../../RawRecord");
var _encodeValue = _interopRequireDefault(require("../encodeValue"));
var standardColumns = "\"id\" primary key, \"_changed\", \"_status\"";
var commonSchema = 'create table "local_storage" ("key" varchar(16) primary key not null, "value" text not null);' + 'create index "local_storage_key_index" on "local_storage" ("key");';
var encodeCreateTable = function ({
  name: name,
  columns: columns
}) {
  var columnsSQL = [standardColumns].concat(Object.keys(columns).map(function (column) {
    return "\"".concat(column, "\"");
  })).join(', ');
  return "create table \"".concat(name, "\" (").concat(columnsSQL, ");");
};
var encodeIndex = function (column, tableName) {
  return column.isIndexed ? "create index if not exists \"".concat(tableName, "_").concat(column.name, "\" on \"").concat(tableName, "\" (\"").concat(column.name, "\");") : '';
};
var encodeTableIndicies = function ({
  name: tableName,
  columns: columns
}) {
  return Object.values(columns)
  // $FlowFixMe
  .map(function (column) {
    return encodeIndex(column, tableName);
  }).concat(["create index if not exists \"".concat(tableName, "__status\" on \"").concat(tableName, "\" (\"_status\");")]).join('');
};
var identity = function (sql) {
  return sql;
};
var encodeTable = function (table) {
  return (table.unsafeSql || identity)(encodeCreateTable(table) + encodeTableIndicies(table));
};
var encodeSchema = function ({
  tables: tables,
  unsafeSql: unsafeSql
}) {
  var sql = Object.values(tables)
  // $FlowFixMe
  .map(encodeTable).join('');
  return (unsafeSql || identity)(commonSchema + sql, 'setup');
};
exports.encodeSchema = encodeSchema;
function encodeCreateIndices({
  tables: tables,
  unsafeSql: unsafeSql
}) {
  var sql = Object.values(tables)
  // $FlowFixMe
  .map(encodeTableIndicies).join('');
  return (unsafeSql || identity)(sql, 'create_indices');
}
function encodeDropIndices({
  tables: tables,
  unsafeSql: unsafeSql
}) {
  var sql = Object.values(tables)
  // $FlowFixMe
  .map(function ({
    name: tableName,
    columns: columns
  }) {
    return Object.values(columns)
    // $FlowFixMe
    .map(function (column) {
      return column.isIndexed ? "drop index if exists \"".concat(tableName, "_").concat(column.name, "\";") : '';
    }).concat(["drop index if exists \"".concat(tableName, "__status\";")]).join('');
  }).join('');
  return (unsafeSql || identity)(sql, 'drop_indices');
}
var encodeAddColumnsMigrationStep = function ({
  table: table,
  columns: columns,
  unsafeSql: unsafeSql
}) {
  return columns.map(function (column) {
    var addColumn = "alter table \"".concat(table, "\" add \"").concat(column.name, "\";");
    var setDefaultValue = "update \"".concat(table, "\" set \"").concat(column.name, "\" = ").concat((0, _encodeValue.default)((0, _RawRecord.nullValue)(column)), ";");
    var addIndex = encodeIndex(column, table);
    return (unsafeSql || identity)(addColumn + setDefaultValue + addIndex);
  }).join('');
};
var encodeMigrationSteps = function (steps) {
  return steps.map(function (step) {
    if ('create_table' === step.type) {
      return encodeTable(step.schema);
    } else if ('add_columns' === step.type) {
      return encodeAddColumnsMigrationStep(step);
    } else if ('sql' === step.type) {
      return step.sql;
    }
    throw new Error("Unsupported migration step ".concat(step.type));
  }).join('');
};
exports.encodeMigrationSteps = encodeMigrationSteps;