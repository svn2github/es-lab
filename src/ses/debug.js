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
 * @fileoverview An optional part of the SES initialization process
 * that saves potentially valuable debugging aids on the side before
 * startSES.js would remove these, and adds a debugging API which uses
 * these without compromising SES security.
 *
 * <p>NOTE: The currently exposed debugging API is far from
 * settled. This module is currently in an exploratory phase.
 *
 * <p>Meant to be run sometime after repairs are done and a working
 * WeakMap is available, but before startSES.js. initSES.js includes
 * this. initSESPlus.js does not.
 *
 * //provides ses.UnsafeError, ses.getCWStack
 * @author Mark S. Miller
 * @requires WeakMap
 * @overrides Error, ses, debugModule
 */

var Error;
var ses;

(function debugModule() {
   "use strict";


   /**
    * Save away the original Error constructor as ses.UnsafeError and
    * make it otheriwse unreachable. Replace it with a reachable
    * wrapping constructor with the same standard behavior.
    *
    * <p>When followed by the rest of SES initialization, the
    * UnsafeError we save off here is exempt from whitelist-based
    * extra property removal and primordial freezing. Thus, we can
    * use any platform specific APIs defined on Error for privileged
    * debugging operations, unless explicitly turned off below.
    */
   var UnsafeError = Error;
   ses.UnsafeError = Error;
   function FakeError(message) {
     return UnsafeError(message);
   }
   FakeError.prototype = UnsafeError.prototype;
   FakeError.prototype.constructor = FakeError;

   Error = FakeError;

   /**
    * Should be a function of an argument object (normally an error
    * instance) that returns the stack trace associated with argument
    * in Causeway format.
    *
    * <p>See http://wiki.erights.org/wiki/Causeway_Platform_Developer
    *
    * <p>Currently, there is no one portable technique for doing
    * this. So instead, each platform specific branch of the if below
    * should assign something useful to getCWStack.
    */
   ses.getCWStack = function uselessGetCWStack(err) { return void 0; };

   if ('captureStackTrace' in UnsafeError) {
     (function() {
     // Assuming http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
       // So this section is v8 specific.

       UnsafeError.prepareStackTrace = function(err, sst) {
         ssts.set(err, sst);
         return void 0;
       };

       var unsafeCaptureStackTrace = UnsafeError.captureStackTrace;

       // TODO(erights): This seems to be write only. Can this be made
       // safe enough to expose to untrusted code?
       UnsafeError.captureStackTrace = function(obj, opt_MyError) {
         var wasFrozen = Object.isFrozen(obj);
         var stackDesc = Object.getOwnPropertyDescriptor(obj, 'stack');
         try {
           var result = unsafeCaptureStackTrace(obj, opt_MyError);
           var ignore = obj.stack;
           return result;
         } finally {
           if (wasFrozen && !Object.isFrozen(obj)) {
             if (stackDesc) {
               Object.defineProperty(obj, 'stack', stackDesc);
             } else {
               delete obj.stack;
             }
             Object.freeze(obj);
           }
         }
       };

       var ssts = WeakMap(); // error -> sst

       /**
        * Returns a stack in Causeway format.
        *
        * <p>Based on
        * http://code.google.com/p/causeway/source/browse/trunk/src/js/com/teleometry/causeway/purchase_example/workers/makeCausewayLogger.js
        */
       function getCWStack(err) {
         var sst = ssts.get(err);
         if (sst === void 0 && err instanceof Error) {
           // We hope it triggers prepareStackTrace
           var ignore = err.stack;
           sst = ssts.get(err);
         }
         if (sst === void 0) { return void 0; }

         return { calls: sst.map(function(frame) {
           return {
             name: '' + (frame.getFunctionName() ||
                         frame.getMethodName() || '?'),
             source: '' + (frame.getFileName() || '?'),
             span: [ [ frame.getLineNumber(), frame.getColumnNumber() ] ]
           };
         })};
       };
       ses.getCWStack = getCWStack;
     })();
   }

   /**
    * Turn a Causeway stack into a v8-like stack traceback string.
    */
   function stackString(cwStack) {
     if (!cwStack) { return void 0; }
     var calls = cwStack.calls;

     var result = calls.map(function(call) {

       var spanString = call.span.map(function(subSpan) {
         return subSpan.join(':');
       }).join('::');
       if (spanString) { spanString = ':' + spanString; }

       return '  at ' + call.name + ' (' + call.source + spanString + ')';

     });
     return result.join('\n');
   };
   ses.stackString = stackString;

   /**
    * Return the v8-like stack traceback string associated with err.
    */
   function getStack(err) {
     if (err !== Object(err)) { return void 0; }
     var cwStack = ses.getCWStack(err);
     if (!cwStack) { return void 0; }
     var result = ses.stackString(cwStack);
     if (err instanceof Error) { result = err + '\n' + result; }
     return result;
   };
   ses.getStack = getStack;

 })();