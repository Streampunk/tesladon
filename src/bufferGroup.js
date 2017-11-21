/* Copyright 2017 Streampunk Media Ltd.

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

const H = require('highland');

function bufferGroup (g) {
  var remaining = [];
  var group = x => {
    var bufs = [];
    var pointer = 0;
    if (remaining.length > 0) {
      let remainingSize = remaining.reduce((x, y) => x + y.length, 0);
      if (remainingSize + x.length >= g) {
        remaining.push(x.slice(0, g - remainingSize));
        bufs.push(Buffer.concat(remaining, 188));
        pointer = g - remainingSize;
        remaining = [];
      }
    }
    while (pointer <= x.length - g) {
      bufs.push(x.slice(pointer, pointer + g));
      pointer += g;
    }
    if (pointer < x.length)
      remaining.push(x.slice(pointer));
    return H(bufs);
  };
  return H.pipeline(H.flatMap(group));
}

module.exports = bufferGroup;
