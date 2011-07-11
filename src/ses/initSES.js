// Copyright (C) 2011 Google Inc.
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

var RegExp;

/**
 * @fileoverview Monkey patch almost ES5 platforms into a closer
 * emulation of full <a href=
 * "http://code.google.com/p/es-lab/wiki/SecureableES5" >secureable
 * ES5</a>.
 *
 * <p>Qualifying platforms generally include all JavaScript platforms
 * shown on <a href="http://kangax.github.com/es5-compat-table/"
 * >ECMAScript 5 compatibility table</a> that implement {@code
 * Object.getOwnPropertyNames}. At the time of this writing,
 * qualifying browsers already include the latest released versions of
 * Internet Explorer (9), Firefox (4), Chrome (11), and Safari
 * (5.0.5), their corresponding standalone (e.g., server-side) JavaScript
 * engines, Rhino 1.73, BESEN.
 *
 * <p>On such not-quite-ES5 platforms, some elements of these
 * emulations may lose SES safety, as enumerated in the comment on
 * each kludge record in the {@code kludges} array below. The platform
 * must at least provide {@code Object.getOwnPropertyNames}, because
 * it cannot reasonably be emulated.
 *
 * <p>This file is useful by itself, as it has no dependencies on the
 * rest of SES. It creates no new global bindings, but merely repairs
 * standard globals or standard elements reachable from standard
 * globals. If the future-standard {@code WeakMap} global is present,
 * as it is currently on FF7.0a1, then it will repair it in place. The
 * one non-standard element that this file uses is {@code console.log}
 * if present, in order to report the repairs it found necessary. If
 * {@code console.log} is absent, then this file performs its repairs
 * silently.
 *
 * <p>Generally, this file should be run as the first script in a
 * JavaScript context (i.e. a browser frame), as it replies on other
 * primordial objects and methods not yet being perturbed.
 *
 * <p>TODO(erights): This file tries to protects itself from most
 * post-initialization perturbation, by stashing the primordials it
 * needs for later use, but this attempt is currently incomplete. We
 * need to revisit this when we support Confined-ES5, as a variant of
 * SES in which the primordials are not frozen.
 */
(function(global) {
  "use strict";

  function log(str) {
    if (typeof console !== 'undefined' && 'log' in console) {
      // We no longer test (typeof console.log === 'function') since,
      // on IE9 and IE10preview, in violation of the ES5 spec, it
      // is callable but has typeof "object".
      // TODO(erights): report to MS.
      console.log(str);
    }
  }

  if (!Object.getOwnPropertyNames) {
    var complaint = 'Please upgrade to a JavaScript platform ' +
      'which implements Object.getOwnPropertyNames';
    log(complaint);
    throw new EvalError(complaint);
  }

  /////////////// KLUDGE SWITCHES ///////////////

  /////////////////////////////////
  // The following are only the minimal kludges needed for the current
  // Firefox, Safari, or the current Chrome Beta. At the time of
  // this writing, these are Firefox 4.0, Safari 5.0.4 (5533.20.27)
  // and Chrome 12.0.742.12 dev
  // As these move forward, kludges can be removed until we simply
  // rely on ES5.


  /**
   * Tests for
   * https://bugs.webkit.org/show_bug.cgi?id=51097
   * https://bugs.webkit.org/show_bug.cgi?id=58338
   * http://code.google.com/p/v8/issues/detail?id=1437
   *
   * <p>No workaround attempted. Just reporting that this platform is
   * not SES-safe.
   */
  function test_GLOBAL_LEAKS() {
    var v = {}.valueOf;
    var that = 'dummy';
    try {
      that = v();
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: ' +
          'valueOf() threw ' + err);
      return true;
    }
    return true;
  }


  /**
   * Workaround for https://bugs.webkit.org/show_bug.cgi?id=55736
   *
   * <p>As of this writing, the only major browser that does implement
   * Object.getOwnPropertyNames but not Object.freeze etc is the
   * released Safari 5 (JavaScriptCore). The Safari beta 5.0.4
   * (5533.20.27, r84622) already does implement freeze, which is why
   * this WebKit bug is listed as closed. When the released Safari has
   * this fix, we can retire this kludge.
   *
   * <p>This kludge is <b>not</b> safety preserving. The emulations it
   * installs if needed do not actually provide the safety that the
   * rest of SES relies on.
   */
  function test_MISSING_FREEZE_ETC() {
    return !('freeze' in Object);
  }


  /**
   * Workaround for https://bugs.webkit.org/show_bug.cgi?id=55537
   *
   * This bug is fixed on the latest Safari beta 5.0.5 (5533.21.1,
   * r88603). When the released Safari has this fix, we can retire
   * this kludge.
   *
   * <p>This kludge is safety preserving.
   */
  function test_MISSING_CALLEE_DESCRIPTOR() {
    function foo(){}
    if (Object.getOwnPropertyNames(foo).indexOf('callee') < 0) { return false; }
    if (foo.hasOwnProperty('callee')) {
      log('New symptom: empty strict function has own callee');
    }
    return true;
  }


  /**
   * Work around for https://bugzilla.mozilla.org/show_bug.cgi?id=591846
   * as applied to the RegExp constructor.
   *
   * <p>Note that Mozilla lists this bug as closed. But reading that
   * bug thread clarifies that is partially because the following code
   * allows us to work around the non-configurability of the RegExp
   * statics.
   *
   * <p>This kludge is safety preserving.
   */
  function test_REGEXP_CANT_BE_NEUTERED() {
    if (!RegExp.hasOwnProperty('leftContext')) { return false; }
    var deletion;
    try {
      deletion = delete RegExp.leftContext;
    } catch (err) {
      if (!(err instanceof TypeError)) {
        log('New symptom: deletion failed with ' + err);
      }
      return true;
    }
    if (!RegExp.hasOwnProperty('leftContext')) { return false; }
    if (deletion) {
      log('New symptom: Deletion of RegExp.leftContext failed.');
    }
    return true;
  }


  /**
   * Work around for http://code.google.com/p/v8/issues/detail?id=1393
   *
   * <p>This kludge is safety preserving.
   */
  function test_REGEXP_TEST_EXEC_UNSAFE() {
    (/foo/).test('xfoox');
    var match = new RegExp('(.|\r|\n)*','').exec()[0];
    if (match === 'undefined') { return false; }
    if (match !== 'xfoox') {
      log('New symptom: regExp.exec() does not match against "undefined".');
    }
    return true;
  }


  /**
   * Workaround for https://bugs.webkit.org/show_bug.cgi?id=26382
   *
   * <p>As of this writing, the only major browser that does implement
   * Object.getOwnPropertyNames but not Function.prototype.bind is
   * Safari 5 (JavaScriptCore), including the current Safari beta
   * 5.0.4 (5533.20.27, r84622).
   *
   * <p>This kludge is safety preserving. But see
   * https://bugs.webkit.org/show_bug.cgi?id=26382#c25 for why this
   * kludge cannot faithfully implement the specified semantics.
   *
   * <p>See also https://bugs.webkit.org/show_bug.cgi?id=42371
   */
  function test_MISSING_BIND() {
    return !('bind' in Function.prototype);
  }


  /**
   * Workaround for http://code.google.com/p/google-caja/issues/detail?id=1362
   *
   * <p>This is an unfortunate oversight in the ES5 spec: Even if
   * Date.prototype is frozen, it is still defined to be a Date, and
   * so has mutable state in internal properties that can be mutated
   * by the primordial mutation methods on Date.prototype, such as
   * {@code Date.prototype.setFullYear}.
   *
   * <p>This kludge is safety preserving.
   */
  function test_MUTABLE_DATE_PROTO() {
    try {
      Date.prototype.setFullYear(1957);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: Mutating Date.prototype failed with ' + err);
      return true;
    }
    var v = Date.prototype.getFullYear();
    if (v !== v && typeof v === 'number') {
      // NaN indicates we're probably ok.
      return false;
    }
    if (v !== 1957) {
      log('New symptom: Mutating Date.prototype did not throw');
    }
    return true;
  }


  /**
   * Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=656828
   *
   * <p>A bug in the current FF6.0a1 implementation: Even if
   * WeakMap.prototype is frozen, it is still defined to be a WeakMap,
   * and so has mutable state in internal properties that can be
   * mutated by the primordial mutation methods on WeakMap.prototype,
   * such as {@code WeakMap.prototype.set}.
   *
   * <p>This kludge is safety preserving.
   *
   * <p>TODO(erights): Update the ES spec page to reflect the current
   * agreement with Mozilla.
   */
  function test_MUTABLE_WEAKMAP_PROTO() {
    if (typeof WeakMap !== 'function') { return false; }
    var x = {};
    try {
      WeakMap.prototype.set(x, 86);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: Mutating WeakMap.prototype failed with ' + err);
      return true;
    }
    var v = WeakMap.prototype.get(x);
    if (v !== 86) {
      log('New symptom: Mutating WeakMap.prototype did not throw');
    }
    return true;
  }


  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=1447
   *
   * <p>This bug is fixed as of V8 r8258 bleeding-edge, but is not yet
   * available in the latest dev-channel Chrome (13.0.782.15 dev).
   *
   * <p>Unfortunately, an ES5 strict method wrapper cannot emulate
   * absence of a [[Construct]] behavior, as specified for the Chapter
   * 15 built-in methods. The installed wrapper relies on {@code
   * Function.prototype.apply}, as inherited by original, obeying its
   * contract.
   *
   * <p>This kludge is safety preserving.
   */
  function test_NEED_TO_WRAP_FOREACH() {
    if (!('freeze' in Object)) {
      // Object.freeze is still absent on released Safari and would
      // cause a bogus bug detection in the following try/catch code.
      return false;
    }
    try {
      ['z'].forEach(function(){ Object.freeze(Array.prototype.forEach); });
      return false;
    } catch (err) {
      if (!(err instanceof TypeError)) {
        log('New Symptom: freezing forEach failed with ' + err);
      }
      return true;
    }
  }


  /**
   * TODO(erights): isolate and report the V8 bug mentioned below.
   *
   * <p>Sometimes, when trying to freeze an object containing an
   * accessor property with a getter but no setter, Chrome fails with
   * <blockquote>Uncaught TypeError: Cannot set property ident___ of
   * #<Object> which has only a getter</blockquote>. So if necessary,
   * this kludge overrides {@code Object.defineProperty} to always
   * install a dummy setter in lieu of the absent one.
   *
   * <p>TODO(erights): We should also override {@code
   * Object.getOwnPropertyDescriptor} to hide the presence of the
   * dummy setter, and instead report an absent setter.
   */
  function test_NEEDS_DUMMY_SETTER() {
    return (typeof navigator !== 'undefined' &&
            (/Chrome/).test(navigator.userAgent));
  }


  /**
   * Work around for https://bugzilla.mozilla.org/show_bug.cgi?id=637994
   *
   * <p>On Firefox 4 an inherited non-configurable accessor property
   * appears to be an own property of all objects which inherit this
   * accessor property. This is fixed as of Forefox Nightly 7.0a1
   * (2011-06-21).
   *
   * <p>Our workaround wraps hasOwnProperty, getOwnPropertyNames, and
   * getOwnPropertyDescriptor to heuristically decide when an accessor
   * property looks like it is apparently own because of this bug, and
   * suppress reporting its existence.
   *
   * <p>However, it is not feasible to likewise wrap JSON.stringify,
   * and this bug will cause JSON.stringify to be misled by inherited
   * enumerable non-configurable accessor properties. To prevent this,
   * we wrap defineProperty, freeze, and seal to prevent the creation
   * of <i>enumerable</i> non-configurable accessor properties on
   * those platforms with this bug.
   *
   * <p>A little known fact about JavaScript is that {@code
   * Object.prototype.propertyIsEnumerable} actually tests whether a
   * property is both own and enumerable. Assuming that our wrapping
   * of defineProperty, freeze, and seal prevents the occurrence of an
   * enumerable non-configurable accessor property, it should also
   * prevent the occurrence of this bug for any enumerable property,
   * and so we do not need to wrap propertyIsEnumerable.
   *
   * <p>This kludge seems to be safety preserving, but the issues are
   * delicate and not well understood.
   */
  function test_ACCESSORS_INHERIT_AS_OWN() {
    var base = {};
    var derived = Object.create(base);
    function getter() { return 'gotten'; }
    Object.defineProperty(base, 'foo', {get: getter});
    if (!derived.hasOwnProperty('foo') &&
        Object.getOwnPropertyDescriptor(derived, 'foo') === void 0 &&
        Object.getOwnPropertyNames(derived).indexOf('foo') < 0) {
      return false;
    }
    if (!derived.hasOwnProperty('foo') ||
        Object.getOwnPropertyDescriptor(derived, 'foo').get !== getter ||
        Object.getOwnPropertyNames(derived).indexOf('foo') < 0) {
      log('New symptom: ' +
          'Accessor properties partially inherit as own properties.');
    }
    Object.defineProperty(base, 'bar', {get: getter, configurable: true});
    if (!derived.hasOwnProperty('bar') &&
        Object.getOwnPropertyDescriptor(derived, 'bar') === void 0 &&
        Object.getOwnPropertyNames(derived).indexOf('bar') < 0) {
      return true;
    }
    log('New symptom: ' +
        'Accessor properties inherit as own even if configurable.');
    return true;
  }


  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=1360
   *
   * Our workaround wraps {@code sort} to wrap the comparefn.
   */
  function test_SORT_LEAKS_GLOBAL() {
    var that = 'dummy';
    [2,3].sort(function(x,y) { that = this; return x - y; });
    if (that === void 0) { return false; }
    if (that !== global) {
      log('New symptom: ' +
          'sort called comparefn with "this" === ' + that);
    }
    return true;
  }


  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=1360
   *
   * <p>Our workaround wraps {@code replace} to wrap the replaceValue
   * if it's a function.
   */
  function test_REPLACE_LEAKS_GLOBAL() {
    var that = 'dummy';
    'x'.replace(/x/, function() { that = this; return 'y';});
    if (that === void 0) { return false; }
    if (that !== global) {
      log('New symptom: ' +
          'replace called replaceValue function with "this" === ' + that);
    }
    return true;
  }


  /**
   * Protect an 'in' with a try/catch to workaround a bug in Safari
   * WebKit Nightly Version 5.0.5 (5533.21.1, r89741).
   *
   * <p>See https://bugs.webkit.org/show_bug.cgi?id=63398
   *
   * <p>Notes: We're seeing exactly
   * <blockquote>
   *   New symptom (c): ('caller' in &lt;a bound function&gt;) threw:
   *   TypeError: Cannot access caller property of a strict mode
   *   function<br>
   *   New symptom (c): ('arguments' in &lt;a bound function&gt;)
   *   threw: TypeError: Can't access arguments object of a strict
   *   mode function
   * </blockquote>
   * which means we're skipping both the catch and the finally in
   * {@code has} while hitting the catch in {@code has2}. Further, if
   * we remove one of these finally clauses (forget which) and rerun
   * the example, if we're under the debugger the browser crashes. If
   * we're not, then the TypeError escapes both catches.
   */
  function has(base, name, baseDesc) {
    var result = void 0;
    try {
      result = name in base;
    } catch (err) {
      log('New symptom (a): (\'' +
          name + '\' in <' + baseDesc + '>) threw: ' + err);
      // treat this as a safe absence
      result = false;
      return false;
    } finally {
      if (result === void 0) {
        log('New symptom (b): (\'' +
            name + '\' in <' + baseDesc + '>) failed');
      }
    }
    return !!result;
  }

  function has2(base, name, baseDesc) {
    var result;
    try {
      result = has(base, name, baseDesc);
    } catch (err) {
      log('New symptom (c): (\'' +
          name + '\' in <' + baseDesc + '>) threw: ' + err);
      // treat this as a safe absence
      result = false;
      return false;
    } finally {
      if (result === void 0) {
        log('New symptom (d): (\'' +
            name + '\' in <' + baseDesc + '>) failed');
      }
    }
    return !!result;
  }

  /**
   * No workaround (yet?) for
   * https://bugzilla.mozilla.org/show_bug.cgi?id=591846 as applied to
   * "caller"
   */
  function test_BUILTIN_LEAKS_CALLER() {
    var map = Array.prototype.map;
    if (!has(map, 'caller', 'a builtin')) { return false; }
    try {
      delete map.caller;
    } catch (err) { }
    if (!has(map, 'caller', 'a builtin')) { return false; }
    function foo() { return map.caller; }
    // using Function so it'll be non-strict
    var testfn = Function('f', 'return [1].map(f)[0];');
    var caller;
    try {
      caller = testfn(foo);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: builtin "caller" failed with: ' + err);
      return true;
    }
    if (null === caller || void 0 === caller) { return false; }
    if (testfn === caller) { return true; }
    log('New symptom: Unexpected "caller": ' + caller);
    return true;
  }

  /**
   * No workaround (yet?) for
   * https://bugzilla.mozilla.org/show_bug.cgi?id=591846 as applied to
   * "arguments"
   */
  function test_BUILTIN_LEAKS_ARGUMENTS() {
    var map = Array.prototype.map;
    if (!has(map, 'arguments', 'a builtin')) { return false; }
    try {
      delete map.arguments;
    } catch (err) { }
    if (!has(map, 'arguments', 'a builtin')) { return false; }
    function foo() { return map.arguments; }
    // using Function so it'll be non-strict
    var testfn = Function('f', 'return [1].map(f)[0];');
    var args;
    try {
      args = testfn(foo);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: builtin "arguments" failed with: ' + err);
      return true;
    }
    if (args === void 0 || args === null) { return false; }
    return true;
  }

  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=893
   */
  function test_BOUND_FUNCTION_LEAKS_CALLER() {
    if (!('bind' in Function.prototype)) { return false; }
    function foo() { return bar.caller; }
    var bar = foo.bind({});
    if (!has2(bar, 'caller', 'a bound function')) { return false; }
    try {
      delete bar.caller;
    } catch (err) { }
    if (!has2(bar, 'caller', 'a bound function')) {
      log('New symptom: "caller" on bound functions can be deleted.');
      return true;
    }
    // using Function so it'll be non-strict
    var testfn = Function('f', 'return f();');
    var caller;
    try {
      caller = testfn(bar);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: bound function "caller" failed with: ' + err);
      return true;
    }
    if ([testfn, void 0, null].indexOf(caller) >= 0) { return false; }
    log('New symptom: Unexpected "caller": ' + caller);
    return true;
  }

  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=893
   */
  function test_BOUND_FUNCTION_LEAKS_ARGUMENTS() {
    if (!('bind' in Function.prototype)) { return false; }
    function foo() { return bar.arguments; }
    var bar = foo.bind({});
    if (!has2(bar, 'arguments', 'a bound function')) { return false; }
    try {
      delete bar.arguments;
    } catch (err) { }
    if (!has2(bar, 'arguments', 'a bound function')) {
      log('New symptom: "arguments" on bound functions can be deleted.');
      return true;
    }
    // using Function so it'll be non-strict
    var testfn = Function('f', 'return f();');
    var args;
    try {
      args = testfn(bar);
    } catch (err) {
      if (err instanceof TypeError) { return false; }
      log('New symptom: bound function "arguments" failed with: ' + err);
      return true;
    }
    if (args === void 0 || args === null) { return false; }
    return true;
  }

  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=621
   *
   */
  function test_JSON_PARSE_PROTO_CONFUSION() {
    var x = JSON.parse('{"__proto__":[]}');
    if (Object.getPrototypeOf(x) !== Object.prototype) {
      return true;
    }
    if (!Array.isArray(x.__proto__)) {
      log('New symptom: JSON.parse did not set "__proto__" as ' +
          'a regular property');
      return true;
    }
    return false;
  }


  //////////////// END KLUDGE SWITCHES ///////////

  var call = Function.prototype.call;
  var apply = Function.prototype.apply;

  var hop = Object.prototype.hasOwnProperty;
  var objToString = Object.prototype.toString;
  var slice = Array.prototype.slice;
  var concat = Array.prototype.concat;
  var defProp = Object.defineProperty;
  var getPrototypeOf = Object.getPrototypeOf;

  function repair_MISSING_CALLEE_DESCRIPTOR() {
    var realGOPN = Object.getOwnPropertyNames;
    Object.getOwnPropertyNames = function calleeFix(base) {
      var result = realGOPN(base);
      if (typeof base === 'function') {
        var i = result.indexOf('callee');
        if (i >= 0 && !hop.call(base, 'callee')) {
          result.splice(i, 1);
        }
      }
      return result;
    };
  }

  function repair_REGEXP_CANT_BE_NEUTERED() {
    var UnsafeRegExp = RegExp;
    var FakeRegExp = function FakeRegExp(pattern, flags) {
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
    };
    FakeRegExp.prototype = UnsafeRegExp.prototype;
    FakeRegExp.prototype.constructor = FakeRegExp;
    RegExp = FakeRegExp;
  }

  function repair_REGEXP_TEST_EXEC_UNSAFE() {
    var unsafeRegExpExec = RegExp.prototype.exec;
    unsafeRegExpExec.call = call;
    var unsafeRegExpTest = RegExp.prototype.test;
    unsafeRegExpTest.call = call;

    RegExp.prototype.exec = function fakeExec(specimen) {
      return unsafeRegExpExec.call(this, String(specimen));
    };
    RegExp.prototype.test = function fakeTest(specimen) {
      return unsafeRegExpTest.call(this, String(specimen));
    };
  }


  function patchMissingProp(base, name, missingFunc) {
    if (!(name in base)) {
      defProp(base, name, {
        value: missingFunc,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }

  function repair_MISSING_FREEZE_ETC() {
    patchMissingProp(Object, 'freeze',
                     function fakeFreeze(obj) { return obj; });
    patchMissingProp(Object, 'seal',
                     function fakeSeal(obj) { return obj; });
    patchMissingProp(Object, 'preventExtensions',
                     function fakePreventExtensions(obj) { return obj; });
    patchMissingProp(Object, 'isFrozen',
                     function fakeIsFrozen(obj) { return false; });
    patchMissingProp(Object, 'isSealed',
                     function fakeIsSealed(obj) { return false; });
    patchMissingProp(Object, 'isExtensible',
                     function fakeIsExtensible(obj) { return true; });
  }

  function repair_MISSING_BIND() {
    patchMissingProp(Function.prototype, 'bind',
                     function fakeBind(self, var_args) {
      var thisFunc = this;
      var leftArgs = slice.call(arguments, 1);
      function funcBound(var_args) {
        var args = concat.call(leftArgs, slice.call(arguments, 0));
        return apply.call(thisFunc, self, args);
      }
      delete funcBound.prototype;
      return funcBound;
    });
  }

  /**
   * Return a function suitable for using as a forEach argument on a
   * list of method names, where that function will monkey patch each
   * of these names methods on {@code constr.prototype} so that they
   * can't be called on {@code constr.prototype} itself even across
   * frames.
   *
   * <p>This only works when {@code constr} corresponds to an internal
   * [[Class]] property whose value is {@code classString}. To test
   * for {@code constr.prototype} cross-frame, we observe that for all
   * objects of this [[Class]], only the prototypes directly inherit
   * from an object that does not have this [[Class]].
   */
  function makeMutableProtoPatcher(constr, classString) {
    var proto = constr.prototype;
    var baseToString = objToString.call(proto);
    if (baseToString !== '[object ' + classString + ']') {
      throw new TypeError('unexpected: ' + baseToString);
    }
    if (getPrototypeOf(proto) !== Object.prototype) {
      throw new TypeError('unexpected inheritance: ' + classString);
    }
    function mutableProtoPatcher(name) {
      if (!hop.call(proto, name)) { return; }
      var originalMethod = proto[name];
      originalMethod.apply = apply;
      function replacement(var_args) {
        var parent = getPrototypeOf(this);
        if (objToString.call(parent) !== baseToString) {
          var thisToString = objToString.call(this);
          if (thisToString === baseToString) {
            throw new TypeError('May not mutate internal state of a ' +
                                classString + '.prototype');
          } else {
            throw new TypeError('Unexpected: ' + thisToString);
          }
        }
        return originalMethod.apply(this, arguments);
      }
      defProp(proto, name, {value: replacement});
    }
    return mutableProtoPatcher;
  }


  function repair_MUTABLE_DATE_PROTO() {
    // Note: coordinate this list with maintenance of whitelist.js
    ['setYear',
     'setTime',
     'setFullYear',
     'setUTCFullYear',
     'setMonth',
     'setUTCMonth',
     'setDate',
     'setUTCDate',
     'setHours',
     'setUTCHours',
     'setMinutes',
     'setUTCMinutes',
     'setSeconds',
     'setUTCSeconds',
     'setMilliseconds',
     'setUTCMilliseconds'].forEach(makeMutableProtoPatcher(Date, 'Date'));
  }

  function repair_MUTABLE_WEAKMAP_PROTO() {
    // Note: coordinate this list with maintanence of whitelist.js
    ['set',
     'delete'].forEach(makeMutableProtoPatcher(WeakMap, 'WeakMap'));
  }


  function repair_NEED_TO_WRAP_FOREACH() {
    (function() {
      var forEach = Array.prototype.forEach;
      defProp(Array.prototype, 'forEach', {
        value: function forEachWrapper(callbackfn, opt_thisArg) {
          return apply.call(forEach, this, arguments);
        }
      });
    })();
  }


  function repair_NEEDS_DUMMY_SETTER() {
    (function() {
      var defProp = Object.defineProperty;
      var gopd = Object.getOwnPropertyDescriptor;
      var freeze = Object.freeze;
      var complained = false;

      defProp(Object, 'defineProperty', {
        value: function(base, name, desc) {
          function dummySetter(newValue) {
            if (name === 'ident___') {
              // The setter for ident___ seems to be called during
              // the built-in freeze, which indicates an
              // undiagnosed bug. By the logic of initSES, it should
              // be impossible to call the ident___ setter.
              // TODO(erights): isolate and report this.
              if (!complained) {
                log('Undiagnosed call to setter for ident___');
                complained = true;
              }
              //
              // If the following debugger line is uncommented, then
              // under the Chrome debugger, this crashes the page.
              // TODO(erights): isolate and report this.
              //
              //debugger;
            } else {
              throw new TypeError('Cannot set ".' + name + '"');
            }
          }
          freeze(dummySetter.prototype);
          freeze(dummySetter);

          var oldDesc = gopd(base, name);
          var testBase = {};
          if (oldDesc) {
            defProp(testBase, name, oldDesc);
          }
          defProp(testBase, name, desc);
          var fullDesc = gopd(testBase, name);

          if ('get' in fullDesc && fullDesc.set === void 0) {
            fullDesc.set = dummySetter;
          }
          return defProp(base, name, fullDesc);
        }
      });
    })();
  }


  function repair_ACCESSORS_INHERIT_AS_OWN() {
    (function(){
      // restrict these
      var defProp = Object.defineProperty;
      var freeze = Object.freeze;
      var seal = Object.seal;

      // preserve illusion
      var gopn = Object.getOwnPropertyNames;
      var gopd = Object.getOwnPropertyDescriptor;

      var complaint = 'Workaround for ' +
        'https://bugzilla.mozilla.org/show_bug.cgi?id=637994 ' +
        ' prohibits enumerable non-configurable accessor properties.';

      function isBadAccessor(derived, name) {
        var desc = gopd(derived, name);
        if (!desc || !('get' in desc)) { return false; }
        var base = getPrototypeOf(derived);
        if (!base) { return false; }
        var superDesc = gopd(base, name);
        if (!superDesc || !('get' in superDesc)) { return false; }
        return (desc.get &&
                !desc.configurable && !superDesc.configurable &&
                desc.get === superDesc.get &&
                desc.set === superDesc.set &&
                desc.enumerable === superDesc.enumerable);
      }

      defProp(Object, 'defineProperty', {
        value: function definePropertyWrapper(base, name, desc) {
          var oldDesc = gopd(base, name);
          var testBase = {};
          if (oldDesc && !isBadAccessor(base, name)) {
            defProp(testBase, name, oldDesc);
          }
          defProp(testBase, name, desc);
          var fullDesc = gopd(testBase, name);

          if ('get' in fullDesc &&
              fullDesc.enumerable &&
              !fullDesc.configurable) {
            log(complaint);
            throw new TypeError(complaint);
          }
          return defProp(base, name, fullDesc);
        }
      });

      function ensureSealable(base) {
        gopn(base).forEach(function(name) {
          var desc = gopd(base, name);
          if ('get' in desc && desc.enumerable) {
            if (!desc.configurable) {
              log('New symptom: "' + name + '" already non-configurable');
            }
            log(complaint);
            throw new TypeError(complaint);
          }
        });
      }

      defProp(Object, 'freeze', {
        value: function freezeWrapper(base) {
          ensureSealable(base);
          return freeze(base);
        }
      });

      defProp(Object, 'seal', {
        value: function sealWrapper(base) {
          ensureSealable(base);
          return seal(base);
        }
      });

      defProp(Object.prototype, 'hasOwnProperty', {
        value: function hasOwnPropertyWrapper(name) {
          return hop.call(this, name) && !isBadAccessor(this, name);
        }
      });

      defProp(Object, 'getOwnPropertyDescriptor', {
        value: function getOwnPropertyDescriptorWrapper(base, name) {
          if (isBadAccessor(base, name)) { return void 0; }
          return gopd(base, name);
        }
      });

      defProp(Object, 'getOwnPropertyNames', {
        value: function getOwnPropertyNamesWrapper(base) {
          return gopn(base).filter(function(name) {
            return !isBadAccessor(base, name);
          });
        }
      });

    })();
  }

  function repair_SORT_LEAKS_GLOBAL() {
   (function(){
      var unsafeSort = Array.prototype.sort;
      unsafeSort.call = call;
      function sortWrapper(opt_comparefn) {
        function comparefnWrapper(x, y) {
          return opt_comparefn(x, y);
        }
        if (arguments.length === 0) {
          return unsafeSort.call(this);
        } else {
          return unsafeSort.call(this, comparefnWrapper);
        }
      }
      defProp(Array.prototype, 'sort', { value: sortWrapper });
    })();
  }

  function repair_REPLACE_LEAKS_GLOBAL() {
    (function(){
      var unsafeReplace = String.prototype.replace;
      unsafeReplace.call = call;
      function replaceWrapper(searchValue, replaceValue) {
        var safeReplaceValue = replaceValue;
        function replaceValueWrapper(m1, m2, m3) {
          return replaceValue(m1, m2, m3);
        }
        if (typeof replaceValue === 'function') {
          safeReplaceValue = replaceValueWrapper;
        }
        return unsafeReplace.call(this, searchValue, safeReplaceValue);
      }
      defProp(String.prototype, 'replace', { value: replaceWrapper });
    })();
  }


  var kludges = [
    {
      description: 'Global object leaks through built-in methods',
      test: test_GLOBAL_LEAKS,
      repair: void 0,
      canRepairSafely: false,
      urls: ['https://bugs.webkit.org/show_bug.cgi?id=51097',
             'https://bugs.webkit.org/show_bug.cgi?id=58338',
             'http://code.google.com/p/v8/issues/detail?id=1437'],
      sections: ['15.2.4.4'],
      tests: ['S15.2.4.4_A14']
    },
    {
      description: 'Object.freeze is missing',
      test: test_MISSING_FREEZE_ETC,
      repair: repair_MISSING_FREEZE_ETC,
      canRepairSafely: false,
      urls: ['https://bugs.webkit.org/show_bug.cgi?id=55736'],
      sections: ['15.2.3.9'],
      tests: []
    },
    {
      description: 'Phantom callee on strict functions',
      test: test_MISSING_CALLEE_DESCRIPTOR,
      repair: repair_MISSING_CALLEE_DESCRIPTOR,
      canRepairSafely: true,
      urls: ['https://bugs.webkit.org/show_bug.cgi?id=55537'],
      sections: ['15.2.3.4'],
      tests: []
    },
    {
      description: 'Cannot delete ambient mutable RegExp.leftContext',
      test: test_REGEXP_CANT_BE_NEUTERED,
      repair: repair_REGEXP_CANT_BE_NEUTERED,
      canRepairSafely: true,
      urls: ['https://bugzilla.mozilla.org/show_bug.cgi?id=591846',
             'http://wiki.ecmascript.org/doku.php?id=' +
             'conventions:make_non-standard_properties_configurable'],
      sections: [],
      tests: []
    },
    {
      description: 'RegExp.exec leaks match globally',
      test: test_REGEXP_TEST_EXEC_UNSAFE,
      repair: repair_REGEXP_TEST_EXEC_UNSAFE,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1393',
             'http://code.google.com/p/chromium/issues/detail?id=75740',
             'https://bugzilla.mozilla.org/show_bug.cgi?id=635017',
             'http://code.google.com/p/google-caja/issues/detail?id=528'],
      sections: ['15.10.6.2'],
      tests: ['S15.10.6.2_A12']
    },
    {
      description: 'Function.prototype.bind is missing',
      test: test_MISSING_BIND,
      repair: repair_MISSING_BIND,
      canRepairSafely: true,
      urls: ['https://bugs.webkit.org/show_bug.cgi?id=26382'],
      sections: ['15.3.4.5'],
      tests: []
    },
    {
      description: 'Date.prototype is a global communication channel',
      test: test_MUTABLE_DATE_PROTO,
      repair: repair_MUTABLE_DATE_PROTO,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/google-caja/issues/detail?id=1362'],
      sections: ['15.9.5'],
      tests: []
    },
    {
      description: 'WeakMap.prototype is a global communication channel',
      test: test_MUTABLE_WEAKMAP_PROTO,
      repair: repair_MUTABLE_WEAKMAP_PROTO,
      canRepairSafely: true,
      urls: ['https://bugzilla.mozilla.org/show_bug.cgi?id=656828'],
      sections: [],
      tests: []
    },
    {
      description: 'Array forEach cannot be frozen while in progress',
      test: test_NEED_TO_WRAP_FOREACH,
      repair: repair_NEED_TO_WRAP_FOREACH,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1447'],
      sections: ['15.4.4.18'],
      tests: ['S15.4.4.18_A1', 'S15.4.4.18_A2']
    },
    {
      description: 'Workaround undiagnosed need for dummy setter',
      test: test_NEEDS_DUMMY_SETTER,
      repair: repair_NEEDS_DUMMY_SETTER,
      canRepairSafely: true,
      urls: [],
      sections: [],
      tests: []
    },
    {
      description: 'Accessor properties inherit as own properties',
      test: test_ACCESSORS_INHERIT_AS_OWN,
      repair: repair_ACCESSORS_INHERIT_AS_OWN,
      canRepairSafely: true,
      urls: ['https://bugzilla.mozilla.org/show_bug.cgi?id=637994'],
      sections: [],
      tests: []
    },
    {
      description: 'Array sort leaks global',
      test: test_SORT_LEAKS_GLOBAL,
      repair: repair_SORT_LEAKS_GLOBAL,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1360'],
      sections: ['15.4.4.11'],
      tests: ['S15.4.4.11_A8']
    },
    {
      description: 'String replace leaks global',
      test: test_REPLACE_LEAKS_GLOBAL,
      repair: repair_REPLACE_LEAKS_GLOBAL,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1360'],
      sections: ['15.5.4.11'],
      tests: ['S15.5.4.11_A12']
    },
    {
      description: 'Built in functions leak "caller"',
      test: test_BUILTIN_LEAKS_CALLER,
      repair: void 0,
      canRepairSafely: false,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1548',
             'https://bugzilla.mozilla.org/show_bug.cgi?id=591846',
             'http://wiki.ecmascript.org/doku.php?id=' +
             'conventions:make_non-standard_properties_configurable'],
      sections: [],
      tests: []
    },
    {
      description: 'Built in functions leak "arguments"',
      test: test_BUILTIN_LEAKS_ARGUMENTS,
      repair: void 0,
      canRepairSafely: false,
      urls: ['http://code.google.com/p/v8/issues/detail?id=1548',
             'https://bugzilla.mozilla.org/show_bug.cgi?id=591846',
             'http://wiki.ecmascript.org/doku.php?id=' +
             'conventions:make_non-standard_properties_configurable'],
      sections: [],
      tests: []
    },
    {
      description: 'Bound functions leak "caller"',
      test: test_BOUND_FUNCTION_LEAKS_CALLER,
      repair: repair_MISSING_BIND,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=893',
             'https://bugs.webkit.org/show_bug.cgi?id=63398'],
      sections: ['15.3.4.5'],
      tests: ['S15.3.4.5_A1']
    },
    {
      description: 'Bound functions leak "arguments"',
      test: test_BOUND_FUNCTION_LEAKS_ARGUMENTS,
      repair: repair_MISSING_BIND,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=893',
             'https://bugs.webkit.org/show_bug.cgi?id=63398'],
      sections: ['15.3.4.5'],
      tests: ['S15.3.4.5_A2']
    },
    {
      description: 'JSON.parse confused by "__proto__"',
      test: test_JSON_PARSE_PROTO_CONFUSION,
      repair: void 0,
      canRepairSafely: true,
      urls: ['http://code.google.com/p/v8/issues/detail?id=621',
             'http://code.google.com/p/v8/issues/detail?id=1310'],
      sections: ['15.12.2'],
      tests: ['S15.12.2_A1']
    }
  ];


  // first run all the tests before repairing anything
  // then repair all repairable failed tests
  // then run all the tests again, in case some repairs break other tests

  var beforeFailures = kludges.map(function(kludge) {
    return kludge.test();
  });
  var repairs = [];
  kludges.forEach(function(kludge, i) {
    if (beforeFailures[i]) {
      var repair = kludge.repair;
      if (repair && repairs.lastIndexOf(repair) === -1) {
        repair();
        // Same repair might fix multiple problems, but run at most once.
        repairs.push(repair);
      }
    }
  });
  var afterFailures = kludges.map(function(kludge) {
    return kludge.test();
  });

  kludges.forEach(function(kludge, i) {
    var status = '';
    if (beforeFailures[i]) { // failed before
      if (afterFailures[i]) { // failed after
        if (kludge.repair) {
          status = 'Repair failed';
        } else {
          status = 'Not repaired';
        }
      } else {
        if (kludge.repair) {
          status = 'Repaired';
        } else {
          status = 'Accidentally repaired';
        }
      }
    } else { // succeeded before
      if (afterFailures[i]) { // failed after
        status = 'Broken by other attempted repairs';
      } else { // succeeded after
        // nothing to see here, move along
        return;
      }
    }
    log(i + ': ' + kludge.description + '. ' +
        status + '. ' +
        (kludge.canRepairSafely ? '' : 'This platform is not SES-safe. ') +
        // TODO(erights): select most relevant URL based on platform
        (kludge.urls[0] ? 'See ' + kludge.urls[0] : ''));
  });

  // TODO(erights): If we arrive here with the platform still in a
  // non-SES-safe state, we should indicate that somehow so that our
  // client (such as SES) can decide to abort. We should *not* simply
  // throw an exception, because that limits the utility of this
  // module for non-SES uses.

})(this);
// Copyright (C) 2011 Google Inc.
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
 *
 * <p>The API implemented here is approximately the API as implemented
 * in FF6.0a1 and agreed to by MarkM, Andreas Gal, and Dave Herman,
 * rather than the offially approved proposal page. TODO(erights):
 * upgrade the ecmascript WeakMap proposal page to explain this API
 * change and present to EcmaScript committee for their approval.
 *
 * <p>The first difference between the emulation here and that in
 * FF6.0a1 is the presence of non enumerable {@code get___, has___,
 * set___, and delete___} methods on WeakMap instances to represent
 * what would be the hidden internal properties of a primitive
 * implementation. Whereas the FF6.0a1 WeakMap.prototype methods
 * require their {@code this} to be a genuine WeakMap instance (i.e.,
 * an object of {@code [[Class]]} "WeakMap}), since there is nothing
 * unforgeable about the pseudo-internal method names used here,
 * nothing prevents these emulated prototype methods from being
 * applied to non-WeakMaps with pseudo-internal methods of the same
 * names.
 *
 * <p>Another difference is that our emulated {@code
 * WeakMap.prototype} is not itself a WeakMap. A problem with the
 * current FF6.0a1 API is that WeakMap.prototype is itself a WeakMap
 * providing ambient mutability and an ambient communications
 * channel. Thus, if a WeakMap is already present and has this
 * problem, repairES5.js wraps it in a safe wrappper in order to
 * prevent access to this channel. (See
 * PATCH_MUTABLE_FROZEN_WEAKMAP_PROTO in repairES5.js).
 */
var WeakMap;

/**
 * If this is a full <a href=
 * "http://code.google.com/p/es-lab/wiki/SecureableES5"
 * >secureable ES5</a> platform and the ES-Harmony {@code WeakMap} is
 * absent, install an approximate emulation.
 *
 * <p>If this is almost a secureable ES5 platform, then WeakMap.js
 * should be run after repairES5.js.
 *
 * <p>See {@code WeakMap} for documentation of the garbage collection
 * properties of this WeakMap emulation.
 */
(function() {
  "use strict";

  if (typeof WeakMap === 'function') { return; }

  var hop = Object.prototype.hasOwnProperty;
  var gopn = Object.getOwnPropertyNames;
  var defProp = Object.defineProperty;

  /**
   * Holds the orginal static properties of the Object constructor,
   * after repairES5 fixes these if necessary to be a more complete
   * secureable ES5 environment, but before installing the following
   * WeakMap emulation overrides and before any untrusted code runs.
   */
  var originalProps = {};
  gopn(Object).forEach(function(name) {
    originalProps[name] = Object[name];
  });

  var NO_IDENT = 'noident:0';

  /**
   * Gets a value which is either NO_IDENT or uniquely identifies the
   * key object, for use in making maps keyed by this key object.
   *
   * <p>Two keys that are <a href=
   * "http://wiki.ecmascript.org/doku.php?id=harmony:egal">egal</a>
   * MUST have the same {@code identity}. Two keys that are not egal
   * MUST either have different identities, or at least one of their
   * identities MUST be {@code NO_IDENT}.
   *
   * An identity is either a string or a const function returning a
   * mostly-unique string. The identity of an object is always either
   * NO_IDENT or such a function. The egal-identity of the function
   * itself is used to resolve collisions on the string returned by
   * the function. If the key is not an object (i.e., a primitive,
   * null, or undefined), then identity(key) throws a TypeError.
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
   * <li>Preventing <i>identity theft</i>, where one object is created
   *     falsely claiming to have the identity of another object.
   * </ul>
   * We do so by
   * <ul>
   * <li>Making the hidden property non-enumerable, so we need not
   *     worry about for-in loops or {@code Object.keys},
   * <li>Making the hidden property an accessor property,
   *     where the hidden property's getter is the identity, and the
   *     value the getter returns is the mostly unique string.
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
   *     operations each reveal the presence of the hidden
   *     property. The property access operations also reveal the
   *     randomness provided by {@code Math.random}. This is not
   *     currently an issue but may become one if SES otherwise seeks
   *     to hide {@code Math.random}.
   * </ul>
   * These are not easily fixed because they are primitive operations
   * which cannot be monkey patched. However, because we're
   * representing the precious identity by the identity of the
   * property's getter rather than the value gotten, this identity
   * itself cannot leak or be installed by the above non-transparent
   * operations.
   */
  function identity(key) {
    var name;
    function identGetter() { return name; }
    if (key !== Object(key)) {
      throw new TypeError('Not an object: ' + key);
    }
    var desc = originalProps.getOwnPropertyDescriptor(key, 'ident___');
    if (desc) { return desc.get; }
    if (!originalProps.isExtensible(key)) { return NO_IDENT; }

    name = 'hash:' + Math.random();
    // If the following two lines a swapped, Safari WebKit Nightly
    // Version 5.0.5 (5533.21.1, r87697) crashes.
    // See https://bugs.webkit.org/show_bug.cgi?id=61758
    originalProps.freeze(identGetter.prototype);
    originalProps.freeze(identGetter);

    defProp(key, 'ident___', {
      get: identGetter,
      set: undefined,
      enumerable: false,
      configurable: false
    });
    return identGetter;
  }

  /**
   * Monkey patch operations that would make their first argument
   * non-extensible.
   *
   * <p>The monkey patched versions throw a TypeError if their first
   * argument is not an object, so it should only be used on functions
   * that should throw a TypeError if their first arg is not an
   * object.
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
    value: function fakeGetOwnPropertyNames(obj) {
      var result = gopn(obj);
      var i = result.indexOf('ident___');
      if (i >= 0) { result.splice(i, 1); }
      return result;
    }
  });

  defProp(Object, 'getOwnPropertyDescriptor', {
    value: function fakeGetOwnPropertyDescriptor(obj, name) {
      if (name === 'ident___') { return undefined; }
      return originalProps.getOwnPropertyDescriptor(obj, name);
    }
  });

  if ('getPropertyNames' in Object) {
    // Not in ES5 but in whitelist as expected for ES-Harmony
    defProp(Object, 'getPropertyNames', {
      value: function fakeGetPropertyNames(obj) {
        var result = originalProps.getPropertyNames(obj);
        var i = result.indexOf('ident___');
        if (i >= 0) { result.splice(i, 1); }
        return result;
      }
    });
  }

  if ('getPropertyDescriptor' in Object) {
    // Not in ES5 but in whitelist as expected for ES-Harmony
    defProp(Object, 'getPropertyDescriptor', {
      value: function fakeGetPropertyDescriptor(obj, name) {
        if (name === 'ident___') { return undefined; }
        return originalProps.getPropertyDescriptor(obj, name);
      }
    });
  }

  defProp(Object, 'create', {
    value: function fakeCreate(parent, pdmap) {
      var result = originalProps.create(parent);
      identity(result);
      if (pdmap) {
        originalProps.defineProperties(result, pdmap);
      }
      return result;
    }
  });

  function constFunc(func) {
    Object.freeze(func.prototype);
    return Object.freeze(func);
  }

  WeakMap = function WeakMap() {
    var identities = {};
    var values = {};

    function find(key) {
      var id = identity(key);
      var name;
      if (typeof id === 'string') {
        name = id;
        id = key;
      } else {
        name = id();
      }
      var opt_ids = identities[name];
      var i = opt_ids ? opt_ids.indexOf(id) : -1;
      // Using original freeze is safe since this record can't escape.
      return originalProps.freeze({
        name: name,
        id: id,
        opt_ids: opt_ids,
        i: i
      });
    }

    function get___(key, opt_default) {
      var f = find(key);
      return (f.i >= 0) ? values[f.name][f.i] : opt_default;
    }

    function has___(key) {
      return find(key).i >= 0;
    }

    function set___(key, value) {
      var f = find(key);
      var ids = f.opt_ids || (identities[f.name] = []);
      var vals = values[f.name] || (values[f.name] = []);
      var i = (f.i >= 0) ? f.i : ids.length;
      ids[i] = f.id;
      vals[i] = value;
    }

    function delete___(key) {
      var f = find(key);
      if (f.i < 0) { return false; }
      var ids = f.opt_ids;
      var last = ids.length - 1;
      if (last === 0) {
        delete identities[f.name];
        delete values[f.name];
      } else {
        var vals = values[f.name];
        ids[f.i] = ids[last];
        vals[f.i] = vals[last];
        ids.splice(last);
        vals.splice(last);
      }
      return true;
    }

    return Object.create(WeakMap.prototype, {
      get___: { value: constFunc(get___) },
      has___: { value: constFunc(has___) },
      set___: { value: constFunc(set___) },
      delete___: { value: constFunc(delete___) }
    });
  };
  WeakMap.prototype = Object.create(Object.prototype, {
    get: {
      /**
       * Return the value most recently associated with key, or
       * opt_default if none.
       */
      value: function get(key, opt_default) {
        return this.get___(key, opt_default);
      },
      writable: true,
      configurable: true
    },

    has: {
      /**
       * Is there a value associated with key in this WeakMap?
       */
      value: function has(key) {
        return this.has___(key);
      },
      writable: true,
      configurable: true
    },

    set: {
      /**
       * Associate value with key in this WeakMap, overwriting any
       * previous association if present.
       */
      value: function set(key, value) {
        this.set___(key, value);
      },
      writable: true,
      configurable: true
    },

    'delete': {
      /**
       * Remove any association for key in this WeakMap, returning
       * whether there was one.
       *
       * <p>Note that the boolean return here does not work like the
       * {@code delete} operator. The {@code delete} operator returns
       * whether the deletion succeeds at bringing about a state in
       * which the deleted property is absent. The {@code delete}
       * operator therefore returns true if the property was already
       * absent, whereas this {@code delete} method returns false if
       * the association was already absent.
       */
      value: function remove(key) {
        return this.delete___(key);
      },
      writable: true,
      configurable: true
    }
  });

})();
// Copyright (C) 2011 Google Inc.
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
 * @fileoverview Exports "whitelist", a recursively defined JSON
 * record enumerating all the naming paths in the ES5.1 spec, those
 * de-facto extensions that we judge to be safe, and SES and Dr. SES
 * extensions provided by the SES runtime.
 *
 * <p>Each JSON record enumerates the disposition of the properties on
 * some corresponding primordial object, with the root record
 * representing the global object. For each such record, the values
 * associated with its property names can be
 * <ul>
 * <li>Another record, in which case this property is simply
 *     whitelisted and that next record represents the disposition of
 *     the object which is its value. For example, {@code "Object"}
 *     leads to another record explaining what properties {@code
 *     "Object"} may have and how each such property, if present,
 *     and its value should be tamed.
 * <li>true, in which case this property is simply whitelisted. The
 *     value associated with that property is still traversed and
 *     tamed, but only according to the taming of the objects that
 *     object inherits from. For example, {@code "Object.freeze"} leads
 *     to true, meaning that the {@code "freeze"} property of {@code
 *     Object} should be whitelisted and the value of the property (a
 *     function) should be further tamed only according to the
 *     markings of the other objects it inherits from, like {@code
 *     "Function.prototype"} and {@code "Object.prototype").
 * <li>"*", in which case this property on this object is whitelisted,
 *     as is this property as inherited by all objects that inherit
 *     from this object. The values associated with all such properties
 *     are still traversed and tamed, but only according to the taming
 *     of the objects that object inherits from. For example, {@code
 *     "Object.prototype.constructor"} leads to "*", meaning that we
 *     whitelist the {@code "constructor"} property on {@code
 *     Object.prototype} and on every object that inherits from {@code
 *     Object.prototype} that does not have a conflicting mark. Each
 *     of these is tamed as if with true, so that the value of the
 *     property is further tamed according to what other objects it
 *     inherits from.
 * <li>"skip", in which case this property on this object is simply
 *     whitelisted, as is this property as inherited by all objects
 *     that inherit from this object, but we avoid taming the value
 *     associated with that property. For example, as of this writing
 *     {@code "Function.prototype.caller"} leads to "skip" because
 *     some current browser bugs prevent us from removing or even
 *     traversing this property on some platforms of interest.
 * </ul>
 *
 * The "skip" markings are workarounds for browser bugs or other
 * temporary problems. For each of these, there should be an
 * explanatory comment explaining why or a bug citation
 * (TODO(erights)). Any of these whose comments say "fatal" need to be
 * fixed before SES might be considered safe. Ideally, we can retire
 * all "skip" entries by the time SES is ready for secure production
 * use.
 *
 * The members of the whitelist are either
 * <ul>
 * <li>(uncommented) defined by the ES5.1 normative standard text,
 * <li>(questionable) provides a source of non-determinism, in
 *     violation of pure object-capability rules, but allowed anyway
 *     since we've given up on restricting JavaScript to a
 *     deterministic subset.
 * <li>(ES5 Appendix B) common elements of de facto JavaScript
 *     described by the non-normative Appendix B.
 * <li>(Harmless whatwg) extensions documented at
 *     <a href="http://wiki.whatwg.org/wiki/Web_ECMAScript"
 *     >http://wiki.whatwg.org/wiki/Web_ECMAScript</a> that seem to be
 *     harmless. Note that the RegExp constructor extensions on that
 *     page are <b>not harmless</b> and so must not be whitelisted.
 * <li>(ES-Harmony proposal) accepted as "proposal" status for
 *     EcmaScript-Harmony.
 * <li>(Marked as "skip") See above.
 * </ul>
 *
 * <p>With the above encoding, there are some sensible whitelists we
 * cannot express, such as marking a property both with "*" and a JSON
 * record. This is an expedient decision based only on not having
 * encountered such a need. Should we need this extra expressiveness,
 * we'll need to refactor to enable a different encoding.
 *
 * <p>We factor out {@code true} and {@code "skip"} into the variables
 * {@code t} and {@code s} just to get a bit better compression from
 * simple minifiers.
 */
var whitelist;

(function() {
  "use strict";

  var t = true;
  var s = 'skip';
  whitelist = {
    cajaVM: {                        // Caja support
      log: t,
      def: t,
      compile: t,
      compileModule: t,              // experimental
      eval: t,
      Function: t
    },
    WeakMap: {       // ES-Harmony proposal as currently implemented by FF6.0a1
      prototype: {
        // Note: coordinate this list with maintenance of repairES5.js
        get: t,
        set: t,
        has: t,
        'delete': t
      }
    },
    Proxy: {                         // ES-Harmony proposal
      create: t,
      createFunction: t
    },
    escape: t,                       // ES5 Appendix B
    unescape: t,                     // ES5 Appendix B
    Object: {
      getPropertyDescriptor: t,      // ES-Harmony proposal
      getPropertyNames: t,           // ES-Harmony proposal
      is: t,                         // ES-Harmony proposal
      prototype: {
        constructor: '*',
        toString: '*',
        toLocaleString: '*',
        valueOf: t,
        hasOwnProperty: t,
        isPrototypeOf: t,
        propertyIsEnumerable: t
      },
      getPrototypeOf: t,
      getOwnPropertyDescriptor: t,
      getOwnPropertyNames: t,
      create: t,
      defineProperty: t,
      defineProperties: t,
      seal: t,
      freeze: t,
      preventExtensions: t,
      isSealed: t,
      isFrozen: t,
      isExtensible: t,
      keys: t
    },
    NaN: t,
    Infinity: t,
    undefined: t,
    // eval: t,                      // Whitelisting under separate control
                                     // by TAME_GLOBAL_EVAL in startSES.js
    parseInt: t,
    parseFloat: t,
    isNaN: t,
    isFinite: t,
    decodeURI: t,
    decodeURIComponent: t,
    encodeURI: t,
    encodeURIComponent: t,
    Function: {
      prototype: {
        apply: t,
        call: t,
        bind: t,
        prototype: '*',
        length: '*',
        caller: s,                 // when not poison, could be fatal
        arguments: s,              // when not poison, could be fatal
        arity: s,                  // non-std, deprecated in favor of length
        name: s                    // non-std
      }
    },
    Array: {
      prototype: {
        concat: t,
        join: t,
        pop: t,
        push: t,
        reverse: t,
        shift: t,
        slice: t,
        sort: t,
        splice: t,
        unshift: t,
        indexOf: t,
        lastIndexOf: t,
        every: t,
        some: t,
        forEach: t,
        map: t,
        filter: t,
        reduce: t,
        reduceRight: t,
        length: s                    // can't be redefined on Mozilla
      },
      isArray: t
    },
    String: {
      prototype: {
        substr: t,                   // ES5 Appendix B
        anchor: t,                   // Harmless whatwg
        big: t,                      // Harmless whatwg
        blink: t,                    // Harmless whatwg
        bold: t,                     // Harmless whatwg
        fixed: t,                    // Harmless whatwg
        fontcolor: t,                // Harmless whatwg
        fontsize: t,                 // Harmless whatwg
        italics: t,                  // Harmless whatwg
        link: t,                     // Harmless whatwg
        small: t,                    // Harmless whatwg
        strike: t,                   // Harmless whatwg
        sub: t,                      // Harmless whatwg
        sup: t,                      // Harmless whatwg
        trimLeft: t,                 // non-standard
        trimRight: t,                // non-standard
        valueOf: t,
        charAt: t,
        charCodeAt: t,
        concat: t,
        indexOf: t,
        lastIndexOf: t,
        localeCompare: t,
        match: t,
        replace: t,
        search: t,
        slice: t,
        split: t,
        substring: t,
        toLowerCase: t,
        toLocaleLowerCase: t,
        toUpperCase: t,
        toLocaleUpperCase: t,
        trim: t,
        length: s                  // can't be redefined on Mozilla
      },
      fromCharCode: t
    },
    Boolean: {
      prototype: {
        valueOf: t
      }
    },
    Number: {
      prototype: {
        valueOf: t,
        toFixed: t,
        toExponential: t,
        toPrecision: t
      },
      MAX_VALUE: t,
      MIN_VALUE: t,
      NaN: t,
      NEGATIVE_INFINITY: t,
      POSITIVE_INFINITY: t
    },
    Math: {
      E: t,
      LN10: t,
      LN2: t,
      LOG2E: t,
      LOG10E: t,
      PI: t,
      SQRT1_2: t,
      SQRT2: t,

      abs: t,
      acos: t,
      asin: t,
      atan: t,
      atan2: t,
      ceil: t,
      cos: t,
      exp: t,
      floor: t,
      log: t,
      max: t,
      min: t,
      pow: t,
      random: t,                     // questionable
      round: t,
      sin: t,
      sqrt: t,
      tan: t
    },
    Date: {                          // no-arg Date constructor is questionable
      prototype: {
        // Note: coordinate this list with maintanence of repairES5.js
        getYear: t,                  // ES5 Appendix B
        setYear: t,                  // ES5 Appendix B
        toGMTString: t,              // ES5 Appendix B
        toDateString: t,
        toTimeString: t,
        toLocaleString: t,
        toLocaleDateString: t,
        toLocaleTimeString: t,
        getTime: t,
        getFullYear: t,
        getUTCFullYear: t,
        getMonth: t,
        getUTCMonth: t,
        getDate: t,
        getUTCDate: t,
        getDay: t,
        getUTCDay: t,
        getHours: t,
        getUTCHours: t,
        getMinutes: t,
        getUTCMinutes: t,
        getSeconds: t,
        getUTCSeconds: t,
        getMilliseconds: t,
        getUTCMilliseconds: t,
        getTimezoneOffset: t,
        setTime: t,
        setFullYear: t,
        setUTCFullYear: t,
        setMonth: t,
        setUTCMonth: t,
        setDate: t,
        setUTCDate: t,
        setHours: t,
        setUTCHours: t,
        setMinutes: t,
        setUTCMinutes: t,
        setSeconds: t,
        setUTCSeconds: t,
        setMilliseconds: t,
        setUTCMilliseconds: t,
        toUTCString: t,
        toISOString: t,
        toJSON: t
      },
      parse: t,
      UTC: t,
      now: t                         // questionable
    },
    RegExp: {
      prototype: {
        exec: t,
        test: t,
        source: s,
        global: s,
        ignoreCase: s,
        multiline: s,
        lastIndex: s,
        sticky: s                    // non-std
      }
    },
    Error: {
      prototype: {
        name: '*',
        message: '*'
      }
    },
    EvalError: {
      prototype: t
    },
    RangeError: {
      prototype: t
    },
    ReferenceError: {
      prototype: t
    },
    SyntaxError: {
      prototype: t
    },
    TypeError: {
      prototype: t
    },
    URIError: {
      prototype: t
    },
    JSON: {
      parse: t,
      stringify: t
    }
  };
})();
// Copyright (C) 2011 Google Inc.
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
 * @fileoverview export an "atLeastFreeVarNames" function for internal
 * use by the SES-on-ES5 implementation, which enumerates at least the
 * identifiers which occur freely in a source text string.
 */


/**
 * Calling atLeastFreeVarNames on a {@code programSrc} string
 * argument, the result should include at least all the free variable
 * names of {@code programSrc} as own properties.
 *
 * <p>Assuming a programSrc that parses as a strict Program,
 * atLeastFreeVarNames(programSrc) returns a Record whose enumerable
 * own property names must include the names of all the free variables
 * occuring in programSrc. It can include as many other strings as is
 * convenient so long as it includes these. The value of each of these
 * properties should be {@code true}.
 *
 * <p>TODO(erights): On platforms that support Proxies (currently only
 * FF4 and later), we should stop using atLeastFreeVarNames, since a
 * {@code with(aProxy) {...}} should reliably intercept all free
 * variable accesses without needing any prior scan.
 */
var atLeastFreeVarNames;
(function() {
  "use strict";

  /////////////// KLUDGE SWITCHES ///////////////

  /**
   * Currently we use this to limit the input text to ascii only
   * without backslash-u escapes, in order to simply our identifier
   * gathering.
   *
   * <p>This is only a temporary development hack. TODO(erights): fix.
   */
  function LIMIT_SRC(programSrc) {
    if ((/[^\u0000-\u007f]/).test(programSrc)) {
      throw new EvalError('Non-ascii text not yet supported');
    }
    if ((/\\u/).test(programSrc)) {
      throw new EvalError('Backslash-u escape encoded text not yet supported');
    }
  }

  /**
   * Return a regexp that can be used repeatedly to scan for the next
   * identifier.
   *
   * <p>The current implementation is safe only because of the above
   * LIMIT_SRC. To do this right takes quite a lot of unicode
   * machinery. See the "Identifier" production at
   * http://es-lab.googlecode.com/svn/trunk/src/parser/es5parser.ojs
   * which depends on
   * http://es-lab.googlecode.com/svn/trunk/src/parser/unicode.js
   *
   * <p>This is only a temporary development hack. TODO(erights): fix.
   */
  function SHOULD_MATCH_IDENTIFIER() { return (/(\w|\$)+/g); }


  //////////////// END KLUDGE SWITCHES ///////////

  atLeastFreeVarNames = function atLeastFreeVarNames(programSrc) {
    programSrc = String(programSrc);
    LIMIT_SRC(programSrc);
    // Now that we've temporarily limited our attention to ascii...
    var regexp = SHOULD_MATCH_IDENTIFIER();
    var result = Object.create(null);
    var a;
    while ((a = regexp.exec(programSrc))) {
      // Note that we could have avoided the while loop by doing
      // programSrc.match(regexp), except that then we'd need
      // temporary storage proportional to the total number of
      // apparent identifiers, rather than the total number of
      // apparent unique identifiers.
      var name = a[0];
      result[name] = true;
    }
    return result;
  };

})();
// Copyright (C) 2011 Google Inc.
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
 * @fileoverview Make this frame SES-safe or die trying.
 */

/**
 * The global {@code eval} function available to script code, which
 * may or not be made safe.
 *
 * <p>The original global binding of {@code eval} is not
 * SES-safe. {@code cajaVM.eval} is a safe wrapper around this
 * original eval, enforcing SES language restrictions.
 *
 * <p>If TAME_GLOBAL_EVAL is true, both the global {@code eval}
 * variable, and the pseudo-global {@code "eval"} property of root,
 * are set to the safe wrapper. If TAME_GLOBAL_EVAL is false, in order
 * to work around a bug in the Chrome debugger, then the global {@code
 * eval} is unaltered and no {@code "eval"} property is available on
 * root. In either case, SES-evaled-code and SES-script-code can both
 * access the safe eval wrapper as {@code cajaVM.eval}.
 *
 * <p>By making the safe eval available on root only when we also make
 * it be the genuine global eval, we preserve the property that
 * SES-evaled-code differs from SES-script-code only by having a
 * subset of the same variables in globalish scope. This is a
 * nice-to-have that makes explanation easier rather than a hard
 * requirement. With this property, any SES-evaled-code that does not
 * fail to access a global variable (or to test whether it could)
 * should operate the same way when run as SES-script-code.
 *
 * <p>See doc-comment on cajaVM for the restriction on this API needed
 * to operate under Caja translation on old browsers.
 */
var eval;

/**
 * The global {@code Function} constructor is always replaced with a
 * safe wrapper, which is also made available as the {@code
 * "Function"} pseudo-global on root.
 *
 * <p>Both the original Function constructor and this safe wrapper
 * point at the original {@code Function.prototype}, so {@code
 * instanceof} works fine with the wrapper. {@code
 * Function.prototype.constructor} is set to point at the safe
 * wrapper, so that only it, and not the unsafe original, is
 * accessible.
 *
 * <p>See doc-comment on cajaVM for the restriction on this API needed
 * to operate under Caja translation on old browsers.
 */
var Function;

/**
 * A new global exported by SES, intended to become a mostly
 * compatible API between server-side Caja translation for older
 * browsers and client-side SES verification for newer browsers.
 *
 * <p>Under server-side Caja translation for old pre-ES5 browsers, the
 * synchronous interface of the evaluation APIs (currently {@code
 * eval, Function, cajaVM.{compile, compileModule, eval, Function}})
 * cannot reasonably be provided. Instead, under translation we expect
 * <ul>
 * <li>Not to have a binding for the pseudo-global {@code "eval"} on root,
 *     just as we would not if TAME_GLOBAL_EVAL is false.
 * <li>The global {@code eval} seen by scripts is either unaltered (to
 *     work around the Chrome debugger bug if TAME_GLOBAL_EVAL is
 *     false), or is replaced by a function that throws an appropriate
 *     EvalError diagnostic (if TAME_GLOBAL_EVAL is true).
 * <li>The global {@code Function} constructor, both as seen by script
 *     code and evaled code, to throw an appropriate diagnostic.
 * <li>The {@code Q} API to always be available, to handle
 *     asyncronous, promise, and remote requests.
 * <li>The evaluating methods on {@code cajaVM} -- currently {@code
 *     compile, compileModule, eval, and Function} -- to be remote
 *     promises for their normal interfaces, which therefore must be
 *     invoked with {@code Q.post}.
 * <li>Since {@code Q.post} can be used for asynchronously invoking
 *     non-promises, invocations like
 *     {@code Q.post(cajaVM, 'eval', ['2+3'])}, for example,
 *     will return a promise for a 5. This will work both under Caja
 *     translation and (TODO(erights)) under SES verification when
 *     {@code Q} is also installed, and so is the only portable
 *     evaluating API that SES code should use during this transition
 *     period.
 * <li>TODO(erights): {code Q.post(cajaVM, 'compileModule',
 *     [moduleSrc]} should eventually pre-load the transitive
 *     synchronous dependencies of moduleSrc before resolving the
 *     promise for its result. It currently does not, instead
 *     requiring its client to do so manually.
 * </ul>
 */
var cajaVM;

/**
 * <p>{@code startSES} should be called before any other potentially
 * dangerous script is executed in this frame.
 *
 * <p>If {@code startSES} succeeds, the evaluation operations on
 * {@code cajaVM}, the global {@code Function} contructor, and perhaps
 * the {@code eval} function (see doc-comment on {@code eval} and
 * {@code cajaVM}) will only load code according to the <i>loader
 * isolation</i> rules of the object-capability model, suitable for
 * loading untrusted code. If all other (trusted) code executed
 * directly in this frame (i.e., other than through these safe
 * evaluation operations) takes care to uphold object-capability
 * rules, then untrusted code loaded via these safe evaluation
 * operations will be constrained by those rules. TODO(erights):
 * explain concretely what the trusted code must do or avoid doing to
 * uphold object-capability rules.
 *
 * <p>On a pre-ES5 platform, this script will fail cleanly, leaving
 * the frame intact. Otherwise, if this script fails, it may leave
 * this frame in an unusable state. All following description assumes
 * this script succeeds and that the browser conforms to the ES5
 * spec. The ES5 spec allows browsers to implement more than is
 * specified as long as certain invariants are maintained. We further
 * assume that these extensions are not maliciously designed to obey
 * the letter of these invariants while subverting the intent of the
 * spec. In other words, even on an ES5 conformant browser, we do not
 * presume to defend ourselves from a browser that is out to get us.
 *
 * @param global ::Record(any) Assumed to be the real global object
 *        for this frame. Since startSES will allow global variable
 *        references that appear at the top level of the whitelist,
 *        our safety depends on these variables being frozen as a side
 *        effect of freezing the corresponding properties of
 *        <tt>global</tt>. These properties are also duplicated onto
 *        the virtual global objects which are provided as the
 *        <tt>this</tt> binding for the safe evaluation calls --
 *        emulating the safe subset of the normal global object.
 * @param whitelist ::Record(Permit) where Permit = true | "*" |
 *        "skip" | Record(Permit).  Describes the subset of naming
 *        paths starting from the root that should be accessible. The
 *        <i>accessible primordials</i> are all values found by
 *        navigating these paths starting from this root. All
 *        non-whitelisted properties of accessible primordials are
 *        deleted, and then the root and all accessible primordials
 *        are frozen with the whitelisted properties frozen as data
 *        properties. TODO(erights): fix the code and documentation to
 *        also support confined-ES5, suitable for confining
 *        potentially offensive code but not supporting defensive
 *        code, where we skip this last freezing step. With
 *        confined-ES5, each frame is considered a separate protection
 *        domain rather that each individual object.
 * @param atLeastFreeVarNames ::F([string], Record(true))
 *        Given the sourceText for a strict Program,
 *        atLeastFreeVarNames(sourceText) returns a Record whose
 *        enumerable own property names must include the names of all the
 *        free variables occuring in sourceText. It can include as
 *        many other strings as is convenient so long as it includes
 *        these. The value of each of these properties should be
 *        {@code true}. TODO(erights): On platforms with Proxies
 *        (currently only Firefox 4 and after), use {@code
 *        with(aProxy) {...}} to intercept free variables rather than
 *        atLeastFreeVarNames.
 */
function startSES(global, whitelist, atLeastFreeVarNames) {
  "use strict";


  /////////////// KLUDGE SWITCHES ///////////////

  /////////////////////////////////
  // The following are only the minimal kludges needed for the current
  // Firefox or the current Chrome Beta. At the time of
  // this writing, these are Firefox 4.0 and Chrome 12.0.742.5 dev
  // As these move forward, kludges can be removed until we simply
  // rely on ES5.

  /**
   * Workaround for http://code.google.com/p/v8/issues/detail?id=1321
   * and https://bugs.webkit.org/show_bug.cgi?id=58338
   *
   * <p>This switch simply reflects that not all almost-ES5 browsers
   * yet implement strict mode.
   *
   * <p>This kludge is <b>not</b> safety preserving. By proceeding
   * without a full strict mode implementation, many of the security
   * properties SES relies on, like non-leakage of the global object,
   * are lost.
   *
   * <p>See also https://bugzilla.mozilla.org/show_bug.cgi?id=482298
   * TODO(erights): verify that all the open bugs this one depends do
   * not matter for SES security.
   */
  //var REQUIRE_STRICT = true;
  var REQUIRE_STRICT = false;

  /**
   * <p>TODO(erights): isolate and report this.
   *
   * <p>Workaround for Chrome debugger's own use of 'eval'
   *
   * <p>This kludge is safety preserving but not semantics
   * preserving. When TAME_GLOBAL_EVAL is false, no synchronous 'eval'
   * is available as a pseudo-global to untrusted (eval) code, and the
   * 'eval' available as a global to trusted (script) code is the
   * original 'eval', and so is not safe.
   */
  //var TAME_GLOBAL_EVAL = true;
  var TAME_GLOBAL_EVAL = false;


  //////////////// END KLUDGE SWITCHES ///////////


  var dirty = true;

  var hop = Object.prototype.hasOwnProperty;

  function fail(str) {
    debugger;
    throw new EvalError(str);
  }

  if (typeof WeakMap === 'undefined') {
    fail('No built-in WeakMaps, so WeakMap.js must be loaded first');
  }

  if (REQUIRE_STRICT && (function() { return this; })()) {
    fail('Requires at least ES5 support');
  }

  /**
   * Code being eval'ed sees <tt>root</tt> as its <tt>this</tt>, as if
   * <tt>root</tt> were the global object.
   *
   * <p>Root's properties are exactly the whitelisted global variable
   * references. These properties, both as they appear on the global
   * object and on this root object, are frozen and so cannot
   * diverge. This preserves the illusion.
   */
  var root = Object.create(null);

  (function() {

    /**
     * The unsafe* variables hold precious values that must not escape
     * to untrusted code. When {@code eval} is invoked via {@code
     * unsafeEval}, this is a call to the indirect eval function, not
     * the direct eval operator.
     */
    var unsafeEval = eval;
    var UnsafeFunction = Function;

    /**
     * Fails if {@code programSrc} does not parse as a strict Program
     * production, or, almost equivalently, as a FunctionBody
     * production.
     *
     * <p>We use Crock's trick of simply passing {@code programSrc} to
     * the original {@code Function} constructor, which will throw a
     * SyntaxError if it does not parse as a FunctionBody. We used to
     * use <a href=
 * "http://code.google.com/p/es-lab/source/browse/trunk/src/ses/startSES.js#152"
     * >Ankur's trick</a> which is more correct, in that it will throw
     * if {@code programSrc} does not parse as a Program production,
     * which is the relevant question. However, the difference --
     * whether return statements are accepted -- does not matter for
     * our purposes. And testing reveals that Crock's trick executes
     * over 100x faster on V8.
     */
    function verifyStrictProgram(programSrc) {
      UnsafeFunction('"use strict";' + programSrc);
    }

    /**
     * Fails if {@code exprSource} does not parse as a strict
     * Expression production.
     *
     * <p>To verify that exprSrc parses as a strict Expression, we
     * verify that (when followed by ";") it parses as a strict
     * Program, and that when surrounded with parens it still parses
     * as a strict Program. We place a newline before the terminal
     * token so that a "//" comment cannot suppress the close paren.
     */
    function verifyStrictExpression(exprSrc) {
      verifyStrictProgram(exprSrc + ';');
      verifyStrictProgram('( ' + exprSrc + '\n);');
    }

    /**
     * For all the own properties of {@code from}, copy their
     * descriptors to {@code virtualGlobal}, except that the property
     * added to {@code virtualGlobal} is unconditionally
     * non-enumerable and (for the moment) configurable.
     *
     * <p>By copying descriptors rather than values, any accessor
     * properties of {@code env} become accessors of {@code
     * virtualGlobal} with the same getter and setter. If these do not
     * use their {@code this} value, then the original and any copied
     * properties are effectively joined. (If the getter/setter do use
     * their {@code this}, when compiled (verified untrusted) code
     * accesses these with virtualGlobal as the base, their {@code
     * this} will be bound to the virtualGlobal rather than {@code
     * env}.)
     *
     * <p>We make these configurable so that {@code virtualGlobal} can
     * be further configured before being frozen. We make these
     * non-enumerable in order to emulate the normal behavior of
     * built-in properties of typical global objects, such as the
     * browser's {@code window} object.
     */
    function initGlobalProperties(from, virtualGlobal) {
      Object.getOwnPropertyNames(from).forEach(function(name) {
        var desc = Object.getOwnPropertyDescriptor(from, name);
        desc.enumerable = false;
        desc.configurable = true;
        Object.defineProperty(virtualGlobal, name, desc);
      });
    }

    /**
     * Make a frozen virtual global object whose properties are the
     * union of the whitelisted globals and the own properties of
     * {@code env}.
     *
     * <p>If there is a collision, the property from {@code env}
     * shadows the whitelisted global. We shadow by overwriting rather
     * than inheritance so that shadowing makes the original binding
     * inaccessible.
     */
    function makeVirtualGlobal(env) {
      var virtualGlobal = Object.create(null);
      initGlobalProperties(root, virtualGlobal);
      initGlobalProperties(env, virtualGlobal);
      return Object.freeze(virtualGlobal);
    }

    /**
     * Make a frozen scope object which inherits from
     * {@code virtualGlobal}, for use by {@code with} to prevent
     * access to any {@code freeNames} other than those found on the.
     * {@code virtualGlobal}.
     */
    function makeScopeObject(virtualGlobal, freeNames) {
      var scopeObject = Object.create(virtualGlobal);
      Object.keys(freeNames).forEach(function(name) {
        if (!(name in virtualGlobal)) {
          Object.defineProperty(scopeObject, name, {
            get: function() {
              throw new ReferenceError('"' + name + '" not in scope');
            },
            set: function(ignored) {
              throw new TypeError('Cannot set "' + name + '"');
            }
          });
        }
      });
      return Object.freeze(scopeObject);
    }


    /**
     * Compile {@code exprSrc} as a strict expression into a function
     * of an environment {@code env}, that when called evaluates
     * {@code exprSrc} in a virtual global environment consisting only
     * of the whitelisted globals and a snapshot of the own properties
     * of {@code env}.
     *
     * <p>When SES {@code compile} is provided primitively, it should
     * accept a Program and return a function that evaluates it to the
     * Program's completion value. Unfortunately, this is not
     * practical as a library without some non-standard support from
     * the platform such as a parser API that provides an AST.
     *
     * <p>Thanks to Mike Samuel and Ankur Taly for this trick of using
     * {@code with} together with RegExp matching to intercept free
     * variable access without parsing.
     *
     * <p>TODO(erights): Switch to Erik Corry's suggestion that we
     * bring each of these variables into scope by generating a
     * shadowing declaration, rather than using "with".
     *
     * <p>TODO(erights): Find out if any platforms have any way to
     * associate a file name and line number with eval'ed text, and
     * arrange to pass these through compile and all its relevant
     * callers.
     */
    function compile(exprSrc) {
      if (dirty) { fail('Initial cleaning failed'); }
      verifyStrictExpression(exprSrc);
      var freeNames = atLeastFreeVarNames(exprSrc);

      /**
       * Notice that the source text placed around exprSrc
       * <ul>
       * <li>brings no variable names into scope, avoiding any
       *     non-hygienic name capture issues, and
       * <li>does not introduce any newlines preceding exprSrc, so
       *     that all line number which a debugger might report are
       *     accurate wrt the original source text. And except for the
       *     first line, all the column numbers are accurate too.
       */
      var wrapperSrc =
        '(function() { ' +
        // non-strict code, where this === scopeObject
        '  with (this) { ' +
        '    return function() { ' +
        '      "use strict"; ' +
        '      return ( ' +
        // strict code, where this === virtualGlobal
        '        ' + exprSrc + '\n' +
        '      );\n' +
        '    };\n' +
        '  }\n' +
        '})';
      var wrapper = unsafeEval(wrapperSrc);
      return function(env) {
        var virtualGlobal = makeVirtualGlobal(env);
        var scopeObject = makeScopeObject(virtualGlobal, freeNames);
        return wrapper.call(scopeObject).call(virtualGlobal);
      };
    }

    var directivePattern = (/^['"](?:\w|\s)*['"]$/m);

    /**
     * TODO(erights): Examine Ihab's question at
     * http://codereview.appspot.com/4249052/diff/37002/src/com/google/caja/ses/startSES.js#newcode467
     */
    var requirePattern = (/^(?:\w*\s*(?:\w|\$|\.)*\s*=\s*)?\s*require\s*\(\s*['"]((?:\w|\$|\.|\/)+)['"]\s*\)$/m);

    /**
     * As an experiment, recognize a stereotyped prelude of the
     * CommonJS module system.
     */
    function getRequirements(modSrc) {
      var result = [];
      var stmts = modSrc.split(';');
      var stmt;
      var i = 0, ilen = stmts.length;
      for (; i < ilen; i++) {
        stmt = stmts[i].trim();
        if (stmt !== '') {
          if (!directivePattern.test(stmt)) { break; }
        }
      }
      for (; i < ilen; i++) {
        stmt = stmts[i].trim();
        if (stmt !== '') {
          var m = requirePattern.exec(stmt);
          if (!m) { break; }
          result.push(m[1]);
        }
      }
      return Object.freeze(result);
    }

    /**
     * A module source is actually any valid FunctionBody, and thus any valid
     * Program.
     *
     * <p>In addition, in case the module source happens to begin with
     * a streotyped prelude of the CommonJS module system, the
     * function resulting from module compilation has an additional
     * {@code "requirements"} property whose value is a list of the
     * module names being required by that prelude. These requirements
     * are the module's "immediate synchronous dependencies".
     *
     * <p>This {@code "requirements"} property is adequate to
     * bootstrap support for a CommonJS module system, since a loader
     * can first load and compile the transitive closure of an initial
     * module's synchronous depencies before actually executing any of
     * these module functions.
     *
     * <p>With a similarly lightweight RegExp, we should be able to
     * similarly recognize the {@code "load"} syntax of <a href=
     * "http://wiki.ecmascript.org/doku.php?id=strawman:simple_modules#syntax"
     * >Sam and Dave's module proposal for ES-Harmony</a>. However,
     * since browsers do not currently accept this syntax,
     * {@code getRequirements} above would also have to extract these
     * from the text to be compiled.
     */
    function compileModule(modSrc) {
      var moduleMaker = compile('(function() {' + modSrc + '}).call(this)');
      moduleMaker.requirements = getRequirements(modSrc);
      Object.freeze(moduleMaker.prototype);
      return Object.freeze(moduleMaker);
    }

    /**
     * A safe form of the {@code Function} constructor, which
     * constructs strict functions that can only refer freely to the
     * whitelisted globals.
     *
     * <p>The returned function is strict whether or not it declares
     * itself to be.
     */
    function FakeFunction(var_args) {
      var params = [].slice.call(arguments, 0);
      var body = params.pop();
      body = String(body || '');
      params = params.join(',');
      var exprSrc = '(function(' + params + '\n){' + body + '})';
      return compile(exprSrc)({});
    }
    FakeFunction.prototype = UnsafeFunction.prototype;
    FakeFunction.prototype.constructor = FakeFunction;
    global.Function = FakeFunction;

    /**
     * A safe form of the indirect {@code eval} function, which
     * evaluates {@code src} as strict code that can only refer freely
     * to the whitelisted globals.
     *
     * <p>Given our parserless methods of verifying untrusted sources,
     * we unfortunately have no practical way to obtain the completion
     * value of a safely evaluated Program. Instead, we adopt a
     * compromise based on the following observation. All Expressions
     * are valid Programs, and all Programs are valid
     * FunctionBodys. If {@code src} parses as a strict expression,
     * then we evaluate it as an expression it and correctly return its
     * completion value, since that is simply the value of the
     * expression.
     *
     * <p>Otherwise, we evaluate {@code src} as a FunctionBody and
     * return what that would return from its implicit enclosing
     * function. If {@code src} is simply a Program, then it would not
     * have an explicit {@code return} statement, and so we fail to
     * return its completion value. This is sufficient for using
     * {@code eval} to emulate script tags, since script tags also
     * lose the completion value.
     *
     * <p>When SES {@code eval} is provided primitively, it should
     * accept a Program and evaluate it to the Program's completion
     * value. Unfortunately, this is not practical as a library
     * without some non-standard support from the platform such as an
     * parser API that provides an AST.
     */
    function fakeEval(src) {
      try {
        verifyStrictExpression(src);
      } catch (x) {
        src = '(function() {' + src + '\n}).call(this)';
      }
      return compile(src)({});
    }

    if (TAME_GLOBAL_EVAL) {
      //
      global.eval = fakeEval;
    }

    var defended = WeakMap();
    /**
     * To define a defended object is to freeze it and all objects
     * transitively reachable from it via transitive reflective
     * property and prototype traversal.
     */
    function def(node) {
      var defending = WeakMap();
      var defendingList = [];
      function recur(val) {
        if (val !== Object(val) || defended.get(val) || defending.get(val)) {
          return;
        }
        defending.set(val, true);
        defendingList.push(val);
        Object.freeze(val);
        recur(Object.getPrototypeOf(val));
        Object.getOwnPropertyNames(val).forEach(function(p) {
          if (typeof val === 'function' &&
              (p === 'caller' || p === 'arguments')) {
            return;
          }
          var desc = Object.getOwnPropertyDescriptor(val, p);
          recur(desc.value);
          recur(desc.get);
          recur(desc.set);
        });
      }
      recur(node);
      defendingList.forEach(function(obj) {
        defended.set(obj, true);
      });
      return node;
    }

    global.cajaVM = {
      log: function(str) {
        if (typeof console !== 'undefined' && 'log' in console) {
          // We no longer test (typeof console.log === 'function') since,
          // on IE9 and IE10preview, in violation of the ES5 spec, it
          // is callable but has typeof "object". TODO(erights):
          // report to MS.
          console.log(str);
        }
      },
      def: def,
      compile: compile,
      compileModule: compileModule,
      eval: fakeEval,
      Function: FakeFunction
    };

  })();

  var cantNeuter = [];

  /**
   * Read the current value of base[name], and freeze that property as
   * a data property to ensure that all further reads of that same
   * property from that base produce the same value.
   *
   * <p>The algorithms in startSES traverse the graph of primordials
   * multiple times. These algorithms rely on all these traversals
   * seeing the same graph. By freezing these as data properties the
   * first time they are read, we ensure that all traversals see the
   * same graph.
   *
   * <p>The frozen property should preserve the enumerability of the
   * original property.
   */
  function read(base, name) {
    var desc = Object.getOwnPropertyDescriptor(base, name);
    if (!desc) { return undefined; }
    if ('value' in desc && !desc.writable && !desc.configurable) {
      return desc.value;
    }

    var result = base[name];
    try {
      Object.defineProperty(base, name, {
        value: result, writable: false, configurable: false
      });
    } catch (ex) {
      cantNeuter.push({base: base, name: name, err: ex});
    }
    return result;
  }

  /**
   * Initialize accessible global variables and {@code root}.
   *
   * For each of the whitelisted globals, we {@code read} its value,
   * freeze that global property as a data property, and mirror that
   * property with a frozen data property of the same name and value
   * on {@code root}, but always non-enumerable. We make these
   * non-enumerable since ES5.1 specifies that all these properties
   * are non-enumerable on the global object.
   */
  Object.keys(whitelist).forEach(function(name) {
    var desc = Object.getOwnPropertyDescriptor(global, name);
    if (desc) {
      var permit = whitelist[name];
      if (permit) {
        var value = read(global, name);
        Object.defineProperty(root, name, {
          value: value,
          writable: true,
          enumerable: false,
          configurable: false
        });
      }
    }
  });
  if (TAME_GLOBAL_EVAL) {
    Object.defineProperty(root, 'eval', {
      value: cajaVM.eval,
      writable: true,
      enumerable: false,
      configurable: false
    });
  }

  /**
   * The whiteTable should map from each path-accessible primordial
   * object to the permit object that describes how it should be
   * cleaned.
   *
   * <p>To ensure that each subsequent traversal obtains the same
   * values, these paths become paths of frozen data properties. See
   * the doc-comment on {@code read}.
   *
   * We initialize the whiteTable only so that {@code getPermit} can
   * process "*" and "skip" inheritance using the whitelist, by
   * walking actual superclass chains.
   */
  var whiteTable = WeakMap();
  function register(value, permit) {
    if (value !== Object(value)) { return; }
    if (typeof permit !== 'object') {
      return;
    }
    var oldPermit = whiteTable.get(value);
    if (oldPermit) {
      fail('primordial reachable through multiple paths');
    }
    whiteTable.set(value, permit);
    Object.keys(permit).forEach(function(name) {
      if (permit[name] !== 'skip') {
        var sub = read(value, name);
        register(sub, permit[name]);
      }
    });
  }
  register(root, whitelist);

  /**
   * Should the property named {@code name} be whitelisted on the
   * {@code base} object, and if so, with what Permit?
   *
   * <p>If it should be permitted, return the Permit (where Permit =
   * true | "*" | "skip" | Record(Permit)), all of which are
   * truthy. If it should not be permitted, return false.
   */
  function getPermit(base, name) {
    var permit = whiteTable.get(base);
    if (permit) {
      if (permit[name]) { return permit[name]; }
    }
    while (true) {
      base = Object.getPrototypeOf(base);
      if (base === null) { return false; }
      permit = whiteTable.get(base);
      if (permit && hop.call(permit, name)) {
        var result = permit[name];
        if (result === '*' || result === 'skip') {
          return result;
        } else {
          return false;
        }
      }
    }
  }

  var cleaning = WeakMap();

  var skipped = [];
  var goodDeletions = [];
  var badDeletions = [];

  /**
   * Assumes all super objects are otherwise accessible and so will be
   * independently cleaned.
   */
  function clean(value, prefix) {
    if (value !== Object(value)) { return; }
    if (cleaning.get(value)) { return; }
    cleaning.set(value, true);
    Object.getOwnPropertyNames(value).forEach(function(name) {
      var path = prefix + (prefix ? '.' : '') + name;
      var p = getPermit(value, name);
      if (p) {
        if (p === 'skip') {
          skipped.push(path);
        } else {
          var sub = read(value, name);
          clean(sub, path);
        }
      } else {
        // Strict delete throws on failure, which we can't count on yet
        var success;
        try {
          success = delete value[name];
        } catch (x) {
          success = false;
        }
        if (success) {
          goodDeletions.push(path);
        } else {
          badDeletions.push(path);
        }
      }
    });
    Object.freeze(value);
  }
  clean(root, '');

  function reportDiagnosis(desc, problemList) {
    if (problemList.length === 0) { return false; }
    cajaVM.log(desc + ': ' + problemList.sort().join(' '));
    return true;
  }

  //reportDiagnosis('Skipped', skipped);
  reportDiagnosis('Deleted', goodDeletions);

  if (cantNeuter.length >= 1) {
    var complaint = cantNeuter.map(function(p) {
      var desc = Object.getOwnPropertyDescriptor(p.base, p.name);
      if (!desc) {
        return '  Missing ' + p.name;
      }
      return p.name + '(' + p.err + '): ' +
        Object.getOwnPropertyNames(desc).map(function(attrName) {
          var v = desc[attrName];
          if (v === Object(v)) { v = 'a ' + typeof v; }
          return attrName + ': ' + v;
        }).join(', ');

    });
    reportDiagnosis('Cannot neuter', complaint);
  }

  if (reportDiagnosis('Cannot delete', badDeletions)) {
    throw new Error('Consult JS console log for deletion failures');
  }

  // We succeeded. Enable safe Function, eval, and compile to work.
  cajaVM.log('success');
  dirty = false;
}
// Copyright (C) 2011 Google Inc.
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
 * @fileoverview Call startSES to turn this frame into a SES
 * environment following object-capability rules.
 */

(function(global) {
  "use strict";

  startSES(global, whitelist, atLeastFreeVarNames);
})(this);
