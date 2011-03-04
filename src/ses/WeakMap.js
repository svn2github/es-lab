// Copyright (C) 2010 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Install a leaky WeakMap emulation on platforms that
 * don't provide a built-in one.
 */

/**
 * This {@code WeakMap} emulation is observably equivalent to the
 * ES-Harmony WeakMap, but with leakier garbage collection properties.
 *
 * <p>As with true WeakMaps, in this emulation, a key does not
 * retain maps indexed by that key and (crucially) a map does not
 * retain the keys it indexes. A key by itself also does not retain
 * the values associated with that key.
 *
 * <p>However, the values placed in an emulated WeakMap are retained
 * so long as that map is retained and those associations are not
 * overridden. For example, when used to support membranes, all
 * values exported from a given membrane will live for the lifetime
 * of the membrane. But when the membrane is revoked, all objects
 * encapsulated within that membrane will still be collected. This
 * is the best we can do without VM support.
 */
var WeakMap;

/**
 * If this is an ES5 platform and the ES-Harmony {@code WeakMap} is
 * absent, install an approximate emulation.
 *
 * <p>See {@code WeakMap} for documentation of the garbage collection
 * properties of this emulation.
 *
 * <p>Will also install some other elements of ES5 as needed to bring
 * an almost ES5 platform to be a more complete emulation of
 * ES5. On not-quite-ES5 platforms, some elements of these emulations
 * on lose SES safety. The platform must at least provide
 * Object.getOwnPropertyNames, because it cannot reasonably be
 * emulated.
 */
(function(global) {
//  "use strict"; // not here because of an unreported Caja bug

  var gopn = Object.getOwnPropertyNames;
  if (!gopn) {
    debugger;
    throw new EvalError('Please upgrade to a JavaScript platform ' +
                        'which implements Object.getOwnPropertyName');
  }

  var hop = Object.prototype.hasOwnProperty;
  var slice = Array.prototype.slice;
  var push = Array.prototype.push;
  var defProp = Object.defineProperty;
  var classProp = Object.prototype.toString;

  var real = {};
  gopn(Object).forEach(function(name) {
    real[name] = Object[name];
  });

  function defMissingProp(base, name, missingFunc) {
    if (!(name in base)) {
      defProp(base, name, {
        value: missingFunc,
        writable: true,
        enumerable: false,
        configurable: true
      });
      if (base === Object) {
        real[name] = missingFunc;
      }
    }
  }

  function identical(x, y) {
    if (x === y) {
      // 0 === -0, but they are not identical
      return x !== 0 || 1/x === 1/y;
    } else {
      // NaN !== NaN, but they are identical.
      // NaNs are the only non-reflexive value, i.e., if x !== x,
      // then x is a NaN.
      return x !== x && y !== y;
    }
  }

  /////////////// KLUDGE SWITCHES ///////////////

  /////////////////////////////////
  // The following are only the minimal kludges needed for the current
  // Mozilla Minefield (Firefox Beta) or Chromium Beta. At the time of
  // this writing, these are Mozilla 4.0b5pre and Chromium 6.0.490.0
  // (3135). As these move forward, kludges can be removed until we
  // simply rely on ES5.


  /**
   * Work around for https://bugzilla.mozilla.org/show_bug.cgi?id=591846
   * as applied to the RegExp constructor.
   *
   * <p>Note that Mozilla lists this bug as closed. But reading that
   * bug thread clarifies that is partially because the following code
   * allows us to work around the non-configurability of the RegExp
   * statics.
   */
  var UnsafeRegExp = RegExp;
  function FakeRegExp(pattern, flags) {
    switch (arguments.length) {
      case 0: {
        return UnsafeRegExp();
      }
      case 1: {
        return UnsafeRegExp(pattern);
      }
      default: {
        return UnsafeRegExp(pattern, flags);
      }
    }
  }
  FakeRegExp.prototype = UnsafeRegExp.prototype;
  FakeRegExp.prototype.constructor = FakeRegExp;
  global.RegExp = FakeRegExp;

  /**
   * Work around for http://code.google.com/p/google-caja/issues/detail?id=528
   */
  var unsafeRegExpExec = RegExp.prototype.exec;
  var unsafeRegExpTest = RegExp.prototype.test;
  RegExp.prototype.exec = function(specimen) {
    return unsafeRegExpExec.call(this, String(specimen));
  };
  RegExp.prototype.test = function(specimen) {
    return unsafeRegExpTest.call(this, String(specimen));
  };

  // As of this writing, the only major browser that does implement
  // Object.getOwnPropertyNames but not Object.freeze etc is Safari 5
  // (JavaScriptCode). When Safari implements these, the following
  // calls to defMissingProp can simply be removed.
  defMissingProp(Object, 'freeze',            function(obj) { return obj; });
  defMissingProp(Object, 'seal',              function(obj) { return obj; });
  defMissingProp(Object, 'preventExtensions', function(obj) { return obj; });
  defMissingProp(Object, 'isFrozen',          function(obj) { return false; });
  defMissingProp(Object, 'isSealed',          function(obj) { return false; });
  defMissingProp(Object, 'isExtensible',      function(obj) { return true; });
  defMissingProp(Function.prototype, 'bind',  function(self, var_args) {
    var thisFunc = this;
    var leftArgs = slice.call(arguments, 1);
    function funcBound(var_args) {
      var args = leftArgs.concat(slice.call(arguments, 0));
      return thisFunc.apply(self, args);
    }
    delete funcBound.prototype;
    return funcBound;
  });

  //////////////// END KLUDGE SWITCHES ///////////

  //////////////// New ES-Harmony methods ///////////

  defMissingProp(Object, 'getPropertyDescriptor', function(obj, name) {
    while (obj !== null) {
      var result = real.getOwnPropertyDescriptor(obj, name);
      if (result) { return result; }
      obj = real.getPrototypeOf(obj);
    }
    return undefined;
  });

  defMissingProp(Object, 'getPropertyNames', function(obj) {
    var result = [];
    while (obj !== null) {
      push.apply(result, gopn(obj));
      obj = real.getPrototypeOf(obj);
    }
    return result;
  });

  /**
   * Still strawman rather than official proposal.
   */
  defMissingProp(Object, 'identical', identical);

  //////////////// END New ES-Harmony methods ///////////


  if (typeof WeakMap === 'function') { return; }

  var NO_IDENT = 'noident:0';

  /**
   * Gets a value which is either NO_IDENT or uniquely identifies the
   * key object, for use in making maps keyed by this key object.
   *
   * <p>Two keys that are {@code identical} MUST have the same {@code
   * identity}. Two keys that are not {@code identical} MUST either
   * have different identities, or one of their identities MUST be
   * {@code NO_IDENT}. An identity is either a string or a const
   * function returning a mostly-unique string. The identity of an
   * object is always either NO_IDENT or such a function. The identity
   * of the function itself is used to resolve collisions on the name
   * in the array.
   *
   * <p>When a map stores a key's identity rather than the key itself,
   * the map does not cause the key to be retained. See the emulated
   * {@code WeakMap} below for the resulting gc properties.
   *
   * <p>To identify objects with reasonable efficiency on ES5 by
   * itself (i.e., without any object-keyed collections), we need to
   * add a reasonably hidden property to such key objects when we
   * can. This raises three issues:
   * <ul>
   * <li>arranging to add this property to objects before we lose the
   *     chance, and
   * <li>reasonably hiding the existence of this new property from
   *     most JavaScript code.
   * <li>preventing <i>identity theft</i>, where one object is created
   *     falsely claiming to have the identity of another object.
   * </ul>
   * We do so by
   * <ul>
   * <li>Making the hidden property non-enumerable, so we need not
   *     worry about for-in loops or {@code Object.keys},
   * <li>Making the hidden property an accessor property, where the
   *     hidden property's getter is the identity, and the value the
   *     getter returns is the mostly unique string.
   * <li>monkey patching those reflective methods that would
   *     prevent extensions, to add this hidden property first,
   * <li>monkey patching those methods that would reveal this
   *     hidden property, and
   * <li>monkey patching those methods that would overwrite this
   *     hidden property.
   * </ul>
   * Given our parser-less verification strategy, the remaining
   * non-transparencies which are not easily fixed are
   * <ul>
   * <li>The {@code delete}, {@code in}, property access
   *     ({@code []}, and {@code .}), and property assignment
   *     operations each reveal the
   *     presence of the hidden property. The property access
   *     operations also reveal the randomness provided by
   *     {@code Math.random}. This not currently an issue but may
   *     become one if SES otherwise seeks to hide Math.random.
   * </ul>
   * These are not easily fixed because they are primitive operations
   * which cannot be monkey patched. However, because we're
   * representing the precious identity by the identity of the
   * property's getter rather than the value gotten, this identity
   * itself cannot leak or be installed by the above non-transparent
   * operations.
   *
   * <p>Due to <a href=
   * "https://bugzilla.mozilla.org/show_bug.cgi?id=637994"
   * >Bug: Inherited accessor properties (sometimes?) reported as own
   * properties</a> we're reverting the logic of <a href=
   * "http://code.google.com/p/es-lab/source/browse/trunk/src/ses/WeakMap.js"
   * >WeakMap.js</a> from getter based as in r493 to array-based as in r491
   */
  function identity(key) {
    var name;
    if (key === Object(key)) {
      if (hop.call(key, 'ident___')) { return key.ident___; }
      if (!real.isExtensible(key)) { return NO_IDENT; }
      name = 'hash:' + Math.random();
      var result = real.freeze([name]);

      defProp(key, 'ident___', {
        value: result,
        writable: false,
        enumerable: false,
        configurable: false
      });
      return result;
    }
    if (typeof key === 'string') { return 'str:' + key; }
    return 'lit:' + key;
  }

  /**
   * Monkey patch operations that would make their first argument
   * non-extensible.
   */
  function identifyFirst(base, name) {
    var oldFunc = base[name];
    defProp(base, name, {
      value: function(obj, var_args) {
        identity(obj);
        return oldFunc.apply(this, arguments);
      }
    });
  }
  identifyFirst(Object, 'freeze');
  identifyFirst(Object, 'seal');
  identifyFirst(Object, 'preventExtensions');
  identifyFirst(Object, 'defineProperty');
  identifyFirst(Object, 'defineProperties');

  defProp(Object, 'getOwnPropertyNames', {
    value: function(obj) {
      var result = gopn(obj);
      var i = result.indexOf('ident___');
      if (i >= 0) { result.splice(i, 1); }
      return result;
    }
  });

  defProp(Object, 'getPropertyNames', {
    value: function(obj) {
      var result = real.getPropertyNames(obj);
      var i = result.indexOf('ident___');
      if (i >= 0) { result.splice(i, 1); }
      return result;
    }
  });

  defProp(Object, 'getOwnPropertyDescriptor', {
    value: function(obj, name) {
      if (name === 'ident___') { return undefined; }
      return real.getOwnPropertyDescriptor(obj, name);
    }
  });

  defProp(Object, 'getPropertyDescriptor', {
    value: function(obj, name) {
      if (name === 'ident___') { return undefined; }
      return real.getPropertyDescriptor(obj, name);
    }
  });

  defProp(Object, 'create', {
    value: function(parent, pdmap) {
      var result = real.create(parent);
      identity(result);
      if (pdmap) {
        real.defineProperties(result, pdmap);
      }
      return result;
    }
  });

  function constFunc(func) {
    Object.freeze(func.prototype);
    return Object.freeze(func);
  }

  if (WeakMap === undefined) {
    WeakMap = constFunc(function() {
      var identities = {};
      var values = {};
      return Object.freeze({
        get: constFunc(function(key) {
          var id = identity(key);
          var name;
          if (typeof id === 'string') {
            name = id;
            id = key;
          } else {
            name = id[0];
          }
          var ids = identities[name] || [];
          var i = ids.indexOf(id);
          return (i < 0) ? undefined : values[name][i];
        }),
        set: constFunc(function(key, value) {
          if (key !== Object(key)) {
            throw new TypeError('Key must not be a value type: ' + key);
          }
          var id = identity(key);
          var name;
          if (typeof id === 'string') {
            name = id;
            id = key;
          } else {
            name = id[0];
          }
          var ids = identities[name] || (identities[name] = []);
          var vals = values[name] || (values[name] = []);
          var i = ids.indexOf(id);
          if (i < 0) { i = ids.length; }
          ids[i] = id;
          vals[i] = value;
        })
      });
    });
  }

})(this);
