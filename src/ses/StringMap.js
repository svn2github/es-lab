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
 * @fileoverview Implements StringMap - a map api for strings.
 *
 * @author Mark S. Miller
 * @author Jasvir Nagra
 * @requires ses
 * @overrides StringMap
 */

var StringMap;

(function() {
   'use strict';

   var create = Object.create;
   var freeze = Object.freeze;
   function constFunc(func) {
     func.prototype = null;
     return freeze(func);
   }

   function assertString(x) {
     if ('string' !== typeof(x)) {
       throw new TypeError('Not a string: ' + x);
     }
     return x;
   }

   var createNull;

   if (typeof ses === 'undefined' ||
       !ses.ok() ||
       ses.es5ProblemReports.FREEZING_BREAKS_PROTOTYPES.beforeFailure) {

     // Object.create(null) may be broken; fall back to ES3-style implementation
     // (safe because we suffix keys anyway).
     createNull = function() { return {}; };
   } else {
     createNull = function() { return Object.create(null); };
   }

   StringMap = function StringMap() {

     var objAsMap = createNull();

     return freeze({
       get: constFunc(function(key) {
         return objAsMap[assertString(key) + '$'];
       }),
       set: constFunc(function(key, value) {
         objAsMap[assertString(key) + '$'] = value;
       }),
       has: constFunc(function(key) {
         return (assertString(key) + '$') in objAsMap;
       }),
       'delete': constFunc(function(key) {
         return delete objAsMap[assertString(key) + '$'];
       })
     });
   };

 })();
