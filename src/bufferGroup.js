/* Copyright 2016 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var H = require('highland');

function bufferGroup (g) {
  var remaining = null;
  var group = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
        push(null, x);
    } else {
      var bufs = [];
      var pointer = 0;
      if (remaining) {
        push(null, Buffer.concat([remaining, x.slice(0, g - remaining.length)], 188));
        pointer = g - remaining.length;
      }
      while (pointer < x.length - g) {
        push(null, x.slice(pointer, pointer + g));
        pointer += g;
      }
      if (pointer < x.length)
        remaining = x.slice(pointer);
      else remaining = null;
      next();
    }
  }
  return H.pipeline(H.consume(group))
}

module.exports = bufferGroup;
