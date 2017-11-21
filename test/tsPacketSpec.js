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
// const fs = require('fs');
const getRandomInt = require('./testUtil.js').getRandomInt;
const getRandomBoolean = require('./testUtil.js').getRandomBoolean;
const assert = require('assert');

function makeRandomPacket () {
  var p = {
    type : 'TSPacket',
    packetSync : 0x47,
    transportErrorIndicator : getRandomBoolean(),
    payloadUnitStartIndicator : getRandomBoolean(),
    transportPriority : getRandomBoolean(),
    pid : getRandomInt(0, 8192),
    scramblingControl : getRandomInt(0, 4),
    adaptationFieldControl : getRandomInt(0, 4),
    continuityCounter : getRandomInt(0, 16)
  };
  if (p.adaptationFieldControl & 0x02) {
    p.adaptationField = {
      type: 'AdaptationField',
      adaptationFieldLength: 1,
      discontinuityIndicator: getRandomBoolean(),
      randomAccessIndicator: getRandomBoolean(),
      elementaryStreamPriorityIndicator: getRandomBoolean(),
      pcrFlag: getRandomBoolean(),
      opcrFlag: getRandomBoolean(),
      splicingPointFlag: getRandomBoolean(),
      transportPrivateDataFlag: getRandomBoolean(),
      adaptationFieldExtensionFlag: getRandomBoolean()
    };
    if (p.adaptationField.pcrFlag) {
      p.adaptationField.pcr = getRandomInt(0, 0x25800000000);
      p.adaptationField.adaptationFieldLength += 6;
    }
    if (p.adaptationField.opcrFlag) {
      p.adaptationField.opcr = getRandomInt(0, 0x25800000000);
      p.adaptationField.adaptationFieldLength += 6;
    }
    if (p.adaptationField.splicingPointFlag) {
      p.adaptationField.spliceCountdown = getRandomInt(-128, 128);
      p.adaptationField.adaptationFieldLength += 1;
    }
    if (p.adaptationField.transportPrivateDataFlag) {
      let transportPrivateDataLength = getRandomInt(0, 158);
      p.adaptationField.transportPrivateData =
        Buffer.alloc(transportPrivateDataLength, 0x7f);
      p.adaptationField.adaptationFieldLength += transportPrivateDataLength + 1;
    }
    if (p.adaptationField.adaptationFieldExtensionFlag) {
      let afe = {
        type: 'AdaptationFieldExtension',
        adaptationExtensionLength: 1,
        legalTimeWindowFlag: getRandomBoolean(),
        piecewiseRateFlag: getRandomBoolean(),
        seamlessSpliceFlag: getRandomBoolean()
      };
      if (afe.legalTimeWindowFlag) {
        afe.legalTimeWindowValidFlag = getRandomBoolean();
        afe.legalTimeWindowOffset = getRandomInt(0, 32768);
        afe.adaptationExtensionLength += 2;
      }
      if (afe.piecewiseRateFlag) {
        afe.piecewiseRate = getRandomInt(0, 0x3fffff);
        afe.adaptationExtensionLength += 3;
      }
      if (afe.seamlessSpliceFlag) {
        afe.spliceType = getRandomInt(0, 16);
        afe.dtsNextAccessUnit = getRandomInt(0, 0x200000000);
        afe.adaptationExtensionLength += 5;
      }
      p.adaptationField.adaptationFieldExtension = afe;
      p.adaptationField.adaptationFieldLength += afe.adaptationExtensionLength + 1;
    }
  }
  if (p.adaptationFieldControl & 0x01) {
    p.payload = Buffer.alloc(184 -
      (p.adaptationField ? p.adaptationField.adaptationFieldLength + 1 : 0), 42);
    p.payload[0] = 43;
    // console.log('>>>', p.payload.length, p.payload);
  }
  return p;
}

// const emptyPayload = Buffer.alloc(184, 0xff);

/* test('Check the roundtrip of TS packets', t => {
  var packetBytes = null;
  var count = 0;
  H(fs.createReadStream(__dirname + '/sd.ts'))
    .pipe(tesladon.bufferGroup(188))
    .doto(x => { packetBytes = x; })
    .pipe(tesladon.readTSPackets())
    .pipe(tesladon.writeTSPackets())
    .doto(x => { t.ok(x.equals(packetBytes), `packet ${count++} is equal.`); })
    .done(() => {
      t.equal(count, 5577, 'correct number of packets processed.');
      t.end();
    });
}); */

test('Roundtrip random TS packets', t => {
  var packets = [];
  for ( let x = 0 ; x < 1000 ; x++ ) {
    packets.push(makeRandomPacket());
  }
  H(packets)
    .through(tesladon.writeTSPackets())
    .through(tesladon.readTSPackets())
    .errors(t.fail)
    .toArray(a => {
      t.equal(a.length, 1000, 'array has 1000 elements as expected.');
      for ( let x = 0 ; x < 1000 ; x++ ) {
        t.deepEqual(a[x], packets[x], `packets ${x} match.`);
        try {
          assert.deepEqual(a[x].payload, packets[x].payload);
        } catch (e) {
          console.log(a[x].payload.length, a[x].payload.slice(-50));
          console.log(packets[x].payload.length, packets[x].payload.slice(-50));
        }
      }
      t.end();
    });
});

test('TS packet does not start with sync byte', t => {
  var packet = makeRandomPacket();
  H([packet])
    .through(tesladon.writeTSPackets())
    .map(b => {
      t.equal(b[0], 0x47, 'first in packet is sync byte.');
      b[0] = 42;
      return b;
    })
    .through(tesladon.readTSPackets())
    .pull((err, x) => {
      t.ok(err, `throws for packet without the sync byte with message: ${err}.`);
      t.notOk(x, 'does not have a value.');
      t.end();
    });
});
