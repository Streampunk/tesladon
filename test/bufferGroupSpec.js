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

const test = require('tape');
const H = require('highland');
const bufferGroup = require('../index.js').bufferGroup;

var testBytes = Buffer.alloc(188*42);
for ( var i = 0 ; i < 188*42 ; i++ ) {
  testBytes[i] = i % 188;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

test('Splits into 188 chunks', t => {
  var count = 0;
  H([testBytes])
    .through(bufferGroup(188))
    .errors(t.fail)
    .each(x => {
      t.deepEqual(x, testBytes.slice(0, 188), `group ${count++} is 0 -> 188.`);
    })
    .done(() => {
      t.equal(count, 42, 'has 188 groups.');
      t.end();
    });
});

test('Divided test bytes produces same result', t => {
  for ( var x = 0 ; x < 10 ; x++ ) {
    var splitPoint = getRandomInt(0, 188*42);
    var count = 0;
    H([testBytes.slice(0, splitPoint), testBytes.slice(splitPoint)])
      .through(bufferGroup(188))
      .errors(t.fail)
      .each(x => {
        t.deepEqual(x, testBytes.slice(0, 188), `group ${count++} with split point ${splitPoint} is 0 -> 188.`);
      })
      .done(() => {
        t.equal(count, 42, 'has 188 groups.');
      });
  }
  t.end();
});

test('Lots of short buffers still works OK', t => {
  var count = 0;
  H([testBytes.slice(0, 1000), testBytes.slice(1000, 1042),
    testBytes.slice(1042, 1066), testBytes.slice(1066, 1129),
    testBytes.slice(1129)])
    .through(bufferGroup(188))
    .errors(t.fail)
    .each(x => {
      t.deepEqual(x, testBytes.slice(0, 188), `group ${count++} is 0 -> 188.`);
    })
    .done(() => {
      t.equal(count, 42, 'has 188 groups.');
      t.end();
    });
});
