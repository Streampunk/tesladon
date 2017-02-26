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

var readTimeStamp = require('../src/util.js').readTimeStamp;
var writeTimeStamp = require('../src/util.js').writeTimeStamp;
var tsTimeToPTPTime = require('../src/util.js').tsTimeToPTPTime;
var ptpTimeToTsTime = require('../src/util.js').ptpTimeToTsTime;
var test = require('tape');

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function checkOnes(b, o) {
  return ((b.readUInt8(o) & 0x01) === 1) &&
    ((b.readUInt8(o + 2) & 0x01) === 1) &&
    ((b.readUInt8(o + 4) & 0x01) === 1);
}

test('Check the zero value', t => {
  var b = Buffer.alloc(5);
  writeTimeStamp(0, 0, b, 0);
  t.equal(readTimeStamp(b, 0), 0, 'Roundtrips OK.');
  t.ok(checkOnes(b), 'has reserved values set to 1.')
  t.end();
});

test('Check the max value', t => {
  var b = Buffer.alloc(5);
  var max = 0x1ffffffff;
  writeTimeStamp(max, 0, b, 0);
  t.equal(readTimeStamp(b, 0), max, 'roundtrips OK.');
  t.ok(checkOnes(b), 'has reserved values set to 1.')
  t.end();
});

test('Rolls over the max value plus one', t => {
  var b = Buffer.alloc(5);
  var max = 0x200000000;
  writeTimeStamp(max, 0, b, 0);
  t.equal(readTimeStamp(b, 0), 0, 'rollovers OK.');
  t.ok(checkOnes(b), 'has reserved values set to 1.')
  t.end();
});

test('Rolls over the max value plus two', t => {
  var b = Buffer.alloc(5);
  var max = 0x200000001;
  writeTimeStamp(max, 0, b, 0);
  t.equal(readTimeStamp(b, 0), 1, 'rollovers OK.');
  t.ok(checkOnes(b), 'has reserved values set to 1.')
  t.end();
});

test('Is OK across 15 bit boundary', t => {
  for ( var x = 32765 ; x < 32770 ; x++ ) {
    var b = Buffer.alloc(5);
    writeTimeStamp(x, 0, b, 0);
    t.equal(readTimeStamp(b, 0), x, `roundtrips OK at ${x}.`);
    t.ok(checkOnes(b), 'has reserved values set to 1.');
  };
  t.end();
});

test('Is OK across 30 bit boundary', t => {
  for ( var x = 0x3ffffffc ; x < 0x40000004 ; x++ ) {
    var b = Buffer.alloc(5);
    writeTimeStamp(x, 0, b, 0);
    t.equal(readTimeStamp(b, 0), x, `roundtrips OK at ${x}.`);
    t.ok(checkOnes(b), 'has reserved values set to 1.');
  };
  t.end();
});

test('Is OK for 1000 random values', t => {
  for ( var x = 0 ; x < 1000 ; x++ ) {
    var b = Buffer.alloc(5);
    var n = getRandomInt(0, 0x200000000);
    writeTimeStamp(n, 0, b, 0);
    t.equal(readTimeStamp(b, 0), n, `roundtrips OK for random value ${n}.`);
    t.ok(checkOnes(b), 'has reserved values set to 1.');
  };
  t.end();
});

var roundTime = x => ptpTimeToTsTime(tsTimeToPTPTime(x));
const tsDay = Math.pow(2, 33);

test('Check TS to PTP timestamp edge values', t => {
  t.equal(roundTime(0), 0, "zero roundtrips OK.");
  t.equal(roundTime(tsDay), 0, "2**33 wraps around to 0.");
  t.equal(roundTime(tsDay - 1), tsDay - 1, "maximum value is preserved.");
  t.equal(roundTime(tsDay + 1), 1, "maximum value plus one wraps around.");
  t.equal(roundTime(tsDay * 2), 0, "double wrap around.");
  t.end();
});

test('Timestamps roundtrip at 1000 random values', t => {
  for ( var x = 0 ; x < 1000 ; x++ ) {
    var ts = Math.floor((Math.random() * tsDay));
    var ptp = tsTimeToPTPTime(ts);
    t.ok(Array.isArray(ptp) && ptp.length === 2, 'PTP is an array length 2.');
    t.ok(typeof ptp[0] === 'number' && typeof ptp[1] === 'number', 'elements are numbers.');
    t.ok(ptp[0] > (Date.now() / 1000 - 100000), 'seconds part is recent.');
    t.ok(ptp[1] < 1000000000, 'part seconds is less than a second.');
    t.equal(ptpTimeToTsTime(ptp), ts, `roundtrip of value ${ts} OK.`);
  };
  t.end();
});
