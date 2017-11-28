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
const tesladon = require('../index.js');
const H = require('highland');
const getRandomInt = require('./testUtil.js').getRandomInt;
const getRandomBoolean = require('./testUtil.js').getRandomBoolean;
const assert = require('assert');

const examplePAT = {
  type: 'ProgramAssociationTable',
  pid: 0,
  tableID: 'program_association_section',
  transportStreamID: 4100,
  versionNumber: 2,
  currentNextIndicator: 1,
  table:
   { '0': 16,
     '4164': 4164,
     '4228': 4228,
     '4351': 4351,
     '4415': 4415,
     '4479': 4479,
     '4671': 4671 },
  networkID: 16 };

const testPacket = {
  type: 'TSPacket',
  packetSync: 0x47,
  pid: 0,
  transportErrorIndicator: false,
  payloadUnitStartIndicator: true,
  transportPriority: false,
  adaptationFieldControl: 1,
  scramblingControl: 0,
  continuityCounter: 0,
  payload: Buffer.from([
    0x00, 0x00, 0xb0, 0x0d, 0xb3, 0xc8, 0xc1,
    0x00, 0x00, 0x00, 0x01, 0xe1, 0x00,
    0x58, 0x13, 0xbf, 0x6a])
};

function makePAT() {
  var pat = {
    type : 'ProgramAssociationTable',
    pid : 0,
    tableID : 'program_association_section',
    transportStreamID : getRandomInt(0, 0xffff),
    versionNumber : getRandomInt(0, 0x1f),
    currentNextIndicator : getRandomBoolean() ? 0 : 1,
    networkID : 42,
    table: {}
  };
  var entries = getRandomInt(0, 1018);
  var nextProgramNo = getRandomInt(1, 0xffff);
  var nextPID = getRandomInt(0x0010, 0x1ffe);
  var pids = { };
  for ( let x = 0 ; x < entries ; x++) {
    while (pat.table[nextProgramNo] || pids[nextPID]) {
      nextProgramNo = getRandomInt(1, 0xffff);
      nextPID = getRandomInt(0x0010, 0x1ffe);
    }
    pat.table[nextProgramNo] = nextPID;
    pids[nextPID] = true;
  }
  return pat;
}

test('Roundtrip example PAT', t => {
  H([examplePAT])
    .through(tesladon.writePAT())
    .doto(x => {
      t.equal(x.type, 'TSPacket', 'makes a TS packet in the middle.');
      t.equal(x.payloadUnitStartIndicator, true,
        'packet is marked as a payload start.');
      t.equal(x.pid, 0, 'packet has PAT reserved PID number of 0.');
    })
    .through(tesladon.readPAT())
    .doto(x => {
      t.deepEqual(x, examplePAT, 'roundtrip PAT equals input PAT.');
    })
    .errors(t.fail)
    .done(() => { t.end(); });
});

for ( var z = 0 ; z < 100 ; z++ ) {
  test(`Roundtrip random PAT ${z}`, t => {
    var randomPAT = makePAT();
    randomPAT.table[0] = randomPAT.networkID;
    H([randomPAT])
      //.doto(H.log)
      .through(tesladon.writePAT())
      .doto(x => {
        // H.log(x);
        t.equal(x.type, 'TSPacket', 'makes a TS packet in the middle.');
        t.equal(x.pid, 0, 'packet has PAT reserved PID number of 0.');
      })
      .through(tesladon.readPAT())
      .doto(x => {
        try {
          assert.deepEqual(x, randomPAT);
          t.deepEqual(x, randomPAT, 'roundtrip PAT equals input PAT.');
        } catch (e) {
          t.fail('Elements do not match.');
        }
      })
      .errors(t.fail)
      .done(() => { t.end(); });
  });
}

test('From test TS packet to PAT', t => {
  H([testPacket])
    .doto(H.log)
    .through(tesladon.readPAT())
    .errors(t.fail)
    .each(p => {
      t.deepEqual(p, {
        type: 'ProgramAssociationTable',
        pid: 0,
        tableID: 'program_association_section',
        transportStreamID: 46024,
        versionNumber: 0,
        currentNextIndicator: 1,
        table: { '1': 256 } }, 'creates the expected PAT table.');
    })
    .done(() => { t.end(); });
});
