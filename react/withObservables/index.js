"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
exports.__esModule = true;
exports.default = void 0;
var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime/helpers/inheritsLoose"));
var _react = require("react");
var _hoistNonReactStatics = _interopRequireDefault(require("hoist-non-react-statics"));
var _garbageCollector = _interopRequireDefault(require("./garbageCollector"));
/* eslint-disable react/sort-comp */
function subscribe(value, onNext, onError, onComplete) {
  var wmelonTag = value && value.constructor && value.constructor._wmelonTag;
  if ('model' === wmelonTag) {
    onNext(value);
    return value.experimentalSubscribe(function (isDeleted) {
      if (isDeleted) {
        onComplete();
      } else {
        onNext(value);
      }
    });
  } else if ('query' === wmelonTag) {
    return value.experimentalSubscribe(onNext);
  } else if ('function' === typeof value.observe) {
    var subscription = value.observe().subscribe(onNext, onError, onComplete);
    return function () {
      return subscription.unsubscribe();
    };
  } else if ('function' === typeof value.subscribe) {
    var _subscription = value.subscribe(onNext, onError, onComplete);
    return function () {
      return _subscription.unsubscribe();
    };
  }

  // eslint-disable-next-line no-console
  console.error("[withObservable] Value passed to withObservables doesn't appear to be observable:", value);
  throw new Error("[withObservable] Value passed to withObservables doesn't appear to be observable. See console for details");
}
function identicalArrays(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (var i = 0, len = left.length; i < len; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}
function getTriggeringProps(props, propNames) {
  if (!propNames) {
    return [];
  }
  return propNames.map(function (name) {
    return props[name];
  });
}
var hasOwn = function (obj, key) {
  // $FlowFixMe
  return Object.prototype.hasOwnProperty.call(obj, key);
};

// TODO: This is probably not going to be 100% safe to use under React async mode
// Do more research
var WithObservablesComponent = /*#__PURE__*/function (_Component) {
  (0, _inheritsLoose2.default)(WithObservablesComponent, _Component);
  function WithObservablesComponent(props, BaseComponent, getObservables, triggerProps) {
    var _this = _Component.call(this, props) || this;
    _this._unsubscribe = null;
    _this._prefetchTimeoutCanceled = false;
    _this._exitedConstructor = false;
    _this.BaseComponent = BaseComponent;
    _this.triggerProps = triggerProps;
    _this.getObservables = getObservables;
    _this.state = {
      isFetching: true,
      values: {},
      error: null,
      triggeredFromProps: getTriggeringProps(props, triggerProps)
    };

    // The recommended React practice is to subscribe to async sources on `didMount`
    // Unfortunately, that's slow, because we have an unnecessary empty render even if we
    // can get first values before render.
    //
    // So we're subscribing in constructor, but that's dangerous. We have no guarantee that
    // the component will actually be mounted (and therefore that `willUnmount` will be called
    // to safely unsubscribe). So we're setting a safety timeout to avoid leaking memory.
    // If component is not mounted before timeout, we'll unsubscribe just to be sure.
    // (If component is mounted after all, just super slow, we'll subscribe again on didMount)
    _this.subscribeWithoutSettingState(_this.props);
    (0, _garbageCollector.default)(function () {
      if (!_this._prefetchTimeoutCanceled) {
        // eslint-disable-next-line no-console
        console.warn("[withObservables] Unsubscribing from source. Leaky component!");
        _this.unsubscribe();
      }
    });
    _this._exitedConstructor = true;
    return _this;
  }
  var _proto = WithObservablesComponent.prototype;
  _proto.componentDidMount = function componentDidMount() {
    this.cancelPrefetchTimeout();
    if (!this._unsubscribe) {
      // eslint-disable-next-line no-console
      console.warn("[withObservables] Component mounted but no subscription present. Slow component (timed out) or a bug! Re-subscribing...");
      var newTriggeringProps = getTriggeringProps(this.props, this.triggerProps);
      this.subscribe(this.props, newTriggeringProps);
    }
  }

  // eslint-disable-next-line
  ;
  _proto.UNSAFE_componentWillReceiveProps = function UNSAFE_componentWillReceiveProps(nextProps) {
    var {
      triggeredFromProps: triggeredFromProps
    } = this.state;
    var newTriggeringProps = getTriggeringProps(nextProps, this.triggerProps);
    if (!identicalArrays(triggeredFromProps, newTriggeringProps)) {
      this.subscribe(nextProps, newTriggeringProps);
    }
  };
  _proto.subscribe = function (props, triggeredFromProps) {
    this.setState({
      isFetching: true,
      values: {},
      triggeredFromProps: triggeredFromProps
    });
    this.subscribeWithoutSettingState(props);
  }

  // NOTE: This is a hand-coded equivalent of Rx combineLatestObject
  ;
  _proto.subscribeWithoutSettingState = function subscribeWithoutSettingState(props) {
    var _this2 = this;
    this.unsubscribe();
    var observablesObject = this.getObservables(props);
    var subscriptions = [];
    var isUnsubscribed = false;
    var unsubscribe = function () {
      isUnsubscribed = true;
      subscriptions.forEach(function (_unsubscribe) {
        return _unsubscribe();
      });
      subscriptions = [];
    };
    var values = {};
    var valueCount = 0;
    var keys = Object.keys(observablesObject);
    var keyCount = keys.length;
    keys.forEach(function (key) {
      if (isUnsubscribed) {
        return;
      }

      // $FlowFixMe
      var subscribable = observablesObject[key];
      subscriptions.push(subscribe(
      // $FlowFixMe
      subscribable, function (value) {
        // console.log(`new value for ${key}, all keys: ${keys}`)
        // Check if we have values for all observables; if yes - we can render; otherwise - only set value
        var isFirstEmission = !hasOwn(values, key);
        if (isFirstEmission) {
          valueCount += 1;
        }
        values[key] = value;
        var hasAllValues = valueCount === keyCount;
        if (hasAllValues && !isUnsubscribed) {
          // console.log('okay, all values')
          _this2.withObservablesOnChange(values);
        }
      }, function (error) {
        // Error in one observable should cause all observables to be unsubscribed from - the component is, in effect, broken now
        unsubscribe();
        _this2.withObservablesOnError(error);
      }, function () {
        // TODO: Should we do anything on completion?
        // console.log(`completed for ${key}`)
      }));
    });
    if ('production' !== process.env.NODE_ENV) {
      var renderedTriggerProps = this.triggerProps ? this.triggerProps.join(',') : 'null';
      var renderedKeys = keys.join(', ');
      this.constructor.displayName = "withObservables[".concat(renderedTriggerProps, "] { ").concat(renderedKeys, " }");
    }
    this._unsubscribe = unsubscribe;
  }

  // DO NOT rename (we want on call stack as debugging help)
  ;
  _proto.withObservablesOnChange = function withObservablesOnChange(values) {
    if (this._exitedConstructor) {
      this.setState({
        values: values,
        isFetching: false
      });
    } else {
      // Source has called with first values synchronously while we're still in the
      // constructor. Here, `this.setState` does not work and we must mutate this.state
      // directly
      this.state.values = values;
      this.state.isFetching = false;
    }
  }

  // DO NOT rename (we want on call stack as debugging help)
  ;
  _proto.withObservablesOnError = function withObservablesOnError(error) {
    // console.error(`[withObservables] Error in Rx composition`, error)
    if (this._exitedConstructor) {
      this.setState({
        error: error,
        isFetching: false
      });
    } else {
      this.state.error = error;
      this.state.isFetching = false;
    }
  };
  _proto.unsubscribe = function unsubscribe() {
    this._unsubscribe && this._unsubscribe();
    this.cancelPrefetchTimeout();
  };
  _proto.cancelPrefetchTimeout = function cancelPrefetchTimeout() {
    this._prefetchTimeoutCanceled = true;
  };
  _proto.shouldComponentUpdate = function shouldComponentUpdate(nextProps, nextState) {
    // If one of the triggering props change but we don't yet have first values from the new
    // observable, *don't* render anything!
    return !nextState.isFetching;
  };
  _proto.componentWillUnmount = function componentWillUnmount() {
    this.unsubscribe();
  };
  _proto.render = function render() {
    var {
      isFetching: isFetching,
      values: values,
      error: error
    } = this.state;
    if (isFetching) {
      return null;
    } else if (error) {
      // rethrow error found in Rx composition as to unify withObservables errors with other React errors
      // the responsibility for handling errors is on the user (by using an Error Boundary)
      throw error;
    } else {
      return (0, _react.createElement)(this.BaseComponent, Object.assign({}, this.props, values));
    }
  };
  return WithObservablesComponent;
}(_react.Component);
/**
 *
 * Injects new props to a component with values from the passed Observables
 *
 * Every time one of the `triggerProps` changes, `getObservables()` is called
 * and the returned Observables are subscribed to.
 *
 * Every time one of the Observables emits a new value, the matching inner prop is updated.
 *
 * You can return multiple Observables in the function. You can also return arbitrary objects that have
 * an `observe()` function that returns an Observable.
 *
 * The inner component will not render until all supplied Observables return their first values.
 * If `triggerProps` change, renders will also be paused until the new Observables emit first values.
 *
 * If you only want to subscribe to Observables once (the Observables don't depend on outer props),
 * pass `null` to `triggerProps`.
 *
 * Errors are re-thrown in render(). Use React Error Boundary to catch them.
 *
 * Example use:
 * ```js
 *   withObservables(['task'], ({ task }) => ({
 *     task: task,
 *     comments: task.comments.observe()
 *   }))
 * ```
 */
var withObservables = function (triggerProps, getObservables) {
  return function (BaseComponent) {
    var ConcreteWithObservablesComponent = /*#__PURE__*/function (_WithObservablesCompo) {
      (0, _inheritsLoose2.default)(ConcreteWithObservablesComponent, _WithObservablesCompo);
      function ConcreteWithObservablesComponent(props) {
        return _WithObservablesCompo.call(this, props, BaseComponent, getObservables, triggerProps) || this;
      }
      return ConcreteWithObservablesComponent;
    }(WithObservablesComponent);
    if ('production' !== process.env.NODE_ENV) {
      var renderedTriggerProps = triggerProps ? triggerProps.join(',') : 'null';
      ConcreteWithObservablesComponent.displayName = "withObservables[".concat(renderedTriggerProps, "]");
    }
    return (0, _hoistNonReactStatics.default)(ConcreteWithObservablesComponent, BaseComponent);
  };
};
var _default = withObservables;
exports.default = _default;