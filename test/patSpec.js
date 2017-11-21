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
// const tesladon = require('../index.js');
// const H = require('highland');
const getRandomInt = require('./testUtil.js').getRandomInt;
const getRandomBoolean = require('./testUtil.js').getRandomBoolean;


function makePAT() {
  var pat = {
    type : 'ProgramAssocationTable',
    pid : 0,
    pointerField : 0,
    tableID : 0,
    sectionSyntaxHeader : 1,
    privateBit : 0,
    sectionLength : getRandomInt(0, 0x3fd),
    transportStreamIdentifier : getRandomInt(0, 0xffff),
    versionNumber : getRandomInt(0, 0x1f),
    currentNextIndicator : getRandomBoolean(),
    sectionNumber : 0,
    lastSectionNumber : 0
  };
  return pat;
}

test('PAT is written OK to TS packet', t => {
  var p = makePAT();
  t.ok(p);
  t.end();
});
