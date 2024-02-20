"use strict";

exports.__esModule = true;
exports.default = forEachAsync;
// Executes async action sequentially for each element in list (same as async for-of)
function forEachAsync(list, action) {
  return list.reduce(function (promiseChain, element) {
    return promiseChain.then(function () {
      return action(element);
    });
  }, Promise.resolve());
}