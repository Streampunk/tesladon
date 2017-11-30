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

// TODO make a random PMT and test with lots of random values.

const test = require('tape');
const tesladon = require('../index.js');
const H = require('highland');
// const getRandomInt = require('./testUtil.js').getRandomInt;
// const getRandomBoolean = require('./testUtil.js').getRandomBoolean;

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

const testPMT = {
  type: 'ProgramMapTable',
  pid: 4671,
  tableID: 'TS_program_map_section',
  programNumber: 4671,
  versionNumber: 28,
  currentNextIndicator: 1,
  pcrPid: 620,
  programInfo: [],
  programElements: {
    620: {
      type: 'ElementaryStreamInfo',
      streamType: 'ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream',
      elementaryPID: 620,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 1
      }]
    },
    621: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 11172-3 Audio',
      elementaryPID: 621,
      esInfo: [{
        type: 'ISO639LanguageDescriptor',
        descriptorTag: 10,
        descriptorLength: 4,
        languages: [{
          iso639LanguageCode: 'eng',
          audioType: 'Undefined'
        }]
      }, {
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 2
      }]
    },
    622: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 11172-3 Audio',
      elementaryPID: 622,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 6
      }, {
        type: 'ISO639LanguageDescriptor',
        descriptorTag: 10,
        descriptorLength: 4,
        languages: [{
          iso639LanguageCode: 'eng',
          audioType: 'Visual impaired commentary'
        } ]
      }]
    },
    623: {
      type: 'ElementaryStreamInfo',
      streamType: 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 PES packets containing private data',
      elementaryPID: 623,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 5
      }, {
        type: 'DVBSubtitlingDescriptor',
        descriptorTag: 89,
        descriptorLength: 8,
        languages: [{
          iso639LanguageCode: 'eng',
          subtitlingType: 16,
          compositionPageID: 1,
          ancillaryPageID: 1
        }]
      }]
    },
    650: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 13818-6 type B',
      elementaryPID: 650,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 101
      }]
    },
    651: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 13818-6 type B',
      elementaryPID: 651,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 102
      }]
    },
    652: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 13818-6 type B',
      elementaryPID: 652,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 103
      }]
    },
    1013: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 13818-6 type B',
      elementaryPID: 1013,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 110
      }, {
        type: 'DVBDataBroadcastIDDescriptor',
        descriptorTag: 102,
        descriptorLength: 12,
        dataBroadcastID: 262,
        idSelectorByte: Buffer.from([1,1,0,6,1,4,0,1,111,110])
      },{
        type: 'DSMCCCarouselIdentifierDescriptor',
        descriptorTag: 19,
        descriptorLength: 5,
        carouselID: 1,
        privateData: Buffer.from([0])
      }]
    },
    1021: {
      type: 'ElementaryStreamInfo',
      streamType: 'ISO/IEC 13818-6 type B',
      elementaryPID: 1021,
      esInfo: [{
        type: 'DVBStreamIdentifierDescriptor',
        descriptorTag: 82,
        descriptorLength: 1,
        componentTag: 111
      }]
    }
  }
};

test('TS packets from PMT', t => {
  H([testPMT])
    .through(tesladon.writePMTs())
    .errors(t.fail)
    .toArray(pa => {
      t.equal(pa.length, 1, 'only creates one packet for the test payload.');
      let p = pa[0];
      t.equal(p.type, 'TSPacket', 'makes a TS packet.');
      t.equal(p.pid, testPMT.pid, `with the expected PID of ${testPMT.pid}.`);
      t.equal(p.payloadUnitStartIndicator, true, 'has the payload start unit indicator set.');
      t.equal(p.payload.length, 184, 'has expected payload length of 184.');
      let sectionLength = p.payload.readUInt16BE(2) & 0x3ff;
      t.equal(sectionLength, 128, 'has section length of 128.');
      t.ok(p.payload.slice(4 + sectionLength).every(x => x === 0xff),
        'packet is filled with 0xff.');
      t.end();
    });
});

test('Roundtrip PMT value', t => {
  H([examplePAT, testPMT])
    .through(tesladon.writePMTs())
    // .doto(H.log)
    .through(tesladon.readPMTs())
    .filter(x => x.type === 'ProgramMapTable')
    .errors(t.fail)
    .each(pmt => {
      for ( let elpid in pmt.programElements ) {
        var el = pmt.programElements[elpid];
        t.deepEqual(el, testPMT.programElements[elpid],
          `elementary stream info matches for ${elpid}.`);
      }
      t.deepEqual(pmt, testPMT, 'PMT values roundtrip OK.');
    })
    .done(() => { t.end(); });
});
