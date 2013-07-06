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
 * @fileoverview Call {@code ses.startSES} to turn this frame into a
 * SES environment following object-capability rules.
 *
 * <p>Assumes ES5 plus WeakMap. Compatible with ES5-strict or
 * anticipated ES6.
 *
 * @author Mark S. Miller
 * @requires this
 * @overrides ses, hookupSESPlusModule
 */

(function hookupSESPlusModule(global) {
  "use strict";

  try {
    if (!ses.ok()) {
      return;
    }

    ses.startSES(global,
                 ses.whitelist,
                 ses.limitSrcCharset,
                 ses.atLeastFreeVarNames,
                 ses.ejectorsGuardsTrademarks);
  } catch (err) {
    ses.updateMaxSeverity(ses.severities.NOT_SUPPORTED);
    ses.logger.error('hookupSESPlus failed with: ', err);
  } finally {
    // Balanced by beginStartup in logger.js
    ses.logger.endStartup();
  }
})(this);
