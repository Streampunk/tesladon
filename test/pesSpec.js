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
const getRandomInt = require('./testUtil.js').getRandomInt;
const getRandomBoolean = require('./testUtil.js').getRandomBoolean;
const H = require('highland');
const util = require('../src/util.js');

function makePES (maxLength = 0x20000, random = true) {
  var ptsDtsIndicator = getRandomInt(0, 3);
  if (ptsDtsIndicator > 0) ptsDtsIndicator++;
  var pes = {
    type : 'PESPacket',
    pid : getRandomInt(0, 0x1fff),
    streamID : util.streamIDName[getRandomInt(0, 0x100)],
    pesPacketLength : random ? getRandomInt(0, maxLength + 1) : maxLength,
    scramblingControl : getRandomInt(0, 4),
    priority : getRandomBoolean(),
    dataAlignmentIndicator : getRandomBoolean(),
    copyright : getRandomBoolean(),
    originalOrCopy : getRandomBoolean(),
    ptsDtsIndicator : ptsDtsIndicator,
    escrFlag : false,
    esRateFlag : false,
    dsmTrickModeFlag : false,
    additionalCopyInfoFlag : false,
    crcFlag : false,
    extensionFlag : false,
    payloads : []
  };
  switch (ptsDtsIndicator) {
  case 2:
    pes.pts = getRandomInt(0, 0x200000000);
    break;
  case 3:
    pes.pts = getRandomInt(0, 0x200000000);
    pes.dts = getRandomInt(0, 0x200000000);
    break;
  default:
    break;
  }
  var pos = 0;
  var value = 0;
  while (pos < pes.pesPacketLength) {
    var buf = Buffer.alloc(getRandomInt(0, pes.pesPacketLength / 4), 42);
    buf = buf.slice(0, pes.pesPacketLength - pos);
    for ( let i = 0 ; i < buf.length ; i++ ) {
      buf[i] = value++ % 0x100;
    }
    pes.payloads.push(buf);
    pos += buf.length;
  }
  if (pes.pesPacketLength > 0xffff) {
    pes.pesPacketLength = 0;
    pes.streamID = 'video_stream_number_0xb';
  }
  return pes;
}

function testPES (pes, s) {
  test(`The conversion of PES packets size ${s} to TS packets`, t => {
    H([pes])
      //.doto(H.log)
      .through(tesladon.writePESPackets())
      .errors(t.fail)
      .toArray(tspa => {
        // H.log(tspa);
        t.ok(tspa.length >= 1, 'PES packet must create at least one TS packet.');
        t.ok(tspa.every(x => x.pid === pes.pid),
          `every TS packet has pid ${pes.pid}.`);
        t.equal(tspa[0].payloadUnitStartIndicator, true,
          'first TS packet is marked with payload start indicator.');
        t.ok(tspa.slice(1).every(x => x.payloadUnitStartIndicator === false),
          'every subsequemt TS packet is not a payload start.');
        t.ok(tspa.slice(0, -1).every(x => x.adaptationFieldControl === 1),
          'all initial packets are payload only.');
        var lastPacket = tspa.slice(-1)[0];
        t.ok(lastPacket.adaptationFieldControl === 3 || (!lastPacket.adaptationField),
          'last packet has adapatation field and padded payload.');
        if (lastPacket.adaptationField) {
          t.equal(lastPacket.adaptationField.adaptationFieldLength + 1 +
            lastPacket.payload.length, 184, 'total TS packet payloads is 184.');
        }
        var cont = true;
        for ( let i = 1 ; i < tspa.length; i++ ) {
          cont = tspa[i].payload[0] === (tspa[i - 1].payload.slice(-1)[0] + 1) & 0xff;
          if (!cont) break;
        }
        t.ok(cont, 'payloads are contiguous.');
        t.end();
      });
  });
}

// Iterate around the adaptation boundary pop
for ( let s = 160 ; s < 190 ; s++ ) {
  testPES(makePES(s, false), s);
}

for ( let s = 0 ; s < 100 ; s++ ) {
  testPES(makePES(), s);
} 

function roundtripPES (inPes, s) {
  test(`Roundtrip random PES packet ${s} length ${inPes.pesPacketLength}`, t => {
    H([inPes, inPes])
      .through(tesladon.writePESPackets())
      .through(tesladon.readPESPackets())
      .errors(t.fail)
      .each(outPes => {
        t.notEqual(outPes, inPes, 'created a different object.');
        Object.keys(inPes)
          .filter(k => k !== 'payloads')
          .forEach(k => {
            t.equal(outPes[k], inPes[k], `values are equal for key ${k}.`);
          });
        t.equal(
          outPes.payloads.reduce((x, y) => x + y.length, 0),
          inPes.payloads.reduce((x, y) => x + y.length, 0),
          'payloads are the same length.');
        t.deepEqual(
          Buffer.concat(outPes.payloads),
          Buffer.concat(inPes.payloads),
          'payloads match.');
      })
      .done(() => { t.end(); });
  });
}

for ( let s = 0 ; s < 10 ; s++)
  roundtripPES(makePES(), s);

for ( let s = 160 ; s < 190 ; s++ ) {
  roundtripPES(makePES(s, false), s);
}
