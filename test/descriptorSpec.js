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
const readDescriptor = require('../src/readDescriptor.js');
const writeDescriptor = require('../src/writeDescriptor.js');
const getRandomInt = require('./testUtil.js').getRandomInt;
const getRandomBoolean = require('./testUtil.js').getRandomBoolean;

function testDescriptor(desc, tag, bytes) {
  test(`Roundtrip a ${desc.type}`, t => {
    var b = Buffer.alloc(getRandomInt(2, 4) * bytes);
    t.equal(writeDescriptor(desc, b, 0), bytes, `expected number of bytes ${bytes} written.`);
    t.equal(b.readUInt8(0), tag, `expected tag of ${tag} written.`);
    t.equal(b.readUInt8(1), bytes - 2, `expected length of ${bytes} written.`);
    desc.descriptorTag = tag;
    desc.descriptorLength = bytes - 2;
    var result = readDescriptor(b);
    t.equal(b.length - result.remaining.length, bytes,
      `remaining length of ${result.remaining.length} equals total descriptor length ${bytes}.`);
    t.deepEqual(result.descriptor, desc, `descriptor ${desc.type} roundtrips OK.`);
    t.end();
  });
}

testDescriptor({
  type : 'VideoStreamDescriptor',
  multipleFrameRateFlag : getRandomBoolean(),
  frameRateCode : getRandomInt(0, 0x0f),
  mpeg1OnlyFlag : true,
  constraintParameterFlag : getRandomBoolean(),
  stillPictureFlag : getRandomBoolean(),
  profileAndLevelIndication : getRandomInt(0, 0xff),
  chromaFormat: getRandomInt(0, 3),
  frameRateExtensionFlag: getRandomBoolean()
}, 2, 5);

testDescriptor({
  type : 'AudioStreamDescriptor',
  freeFormatFlag : getRandomBoolean(),
  ID : getRandomBoolean(),
  layer : getRandomInt(0, 3),
  variableRateAudioIndicator : getRandomBoolean()
}, 3, 3);

testDescriptor({
  type : 'ISO639LanguageDescriptor',
  languages : [{
    iso639LanguageCode: 'eng',
    audioType: 'Clean effects',
  }, {
    iso639LanguageCode: 'fre',
    audioType: 'Visual impaired commentary'
  }]
}, 10, 10);

testDescriptor({
  type : 'MaximumBitrateDescriptor',
  maximumBitrate : getRandomInt(0, 0x3fffffff) * 50
}, 14, 6);

testDescriptor({
  type : 'IBPDescriptor',
  closedGopFlag : getRandomBoolean(),
  identicalGopFlag : getRandomBoolean(),
  maxGopLength : getRandomInt(0, 0x3fff)
}, 18, 4);

testDescriptor({
  type: 'DSMCCCarouselIdentifierDescriptor',
  carouselID: getRandomInt(0, 0xffffffff),
  privateData: Buffer.from([getRandomInt(0, 0xff),
    getRandomInt(0, 0xff), getRandomInt(0, 0xff)])
}, 19, 9);

testDescriptor({
  type : 'MPEG4VideoDescriptor',
  MPEG4VisualProfileAndLevel : getRandomInt(0, 0xff)
}, 27, 3);

testDescriptor({
  type : 'MPEG4AudioDescriptor',
  MPEG4AudioProfileAndLevel : getRandomInt(0, 0xff)
}, 28, 3);

testDescriptor({
  type : 'AVCVideoDescriptor',
  profileIDC : getRandomInt(0, 0xff),
  constraintFlag0 : getRandomBoolean(),
  constraintFlag1 : getRandomBoolean(),
  constraintFlag2 : getRandomBoolean(),
  avcCompatibleFlag : getRandomInt(0, 0x1f),
  levelIDC : getRandomInt(0, 0xff),
  avcStillPresent : getRandomBoolean(),
  avc24HourPictureFlag : getRandomBoolean()
}, 40, 6);

testDescriptor({
  type : 'MPEG2AACAudioDescriptor',
  mpeg2AACProfile : getRandomInt(0, 0xff),
  mpeg2AACChannelConfiguration : getRandomInt(0, 0xff),
  mpeg2AACAdditionalInformation : getRandomInt(0, 0xff)
}, 43, 5);

testDescriptor({
  type : 'DVBStreamIdentifierDescriptor',
  componentTag : getRandomInt(0, 0xff)
}, 82, 3);

testDescriptor({
  type: 'DVBSubtitlingDescriptor',
  languages : [{
    iso639LanguageCode: 'eng',
    subtitlingType : getRandomInt(0, 0xff),
    compositionPageID : getRandomInt(0, 0xffff),
    ancillaryPageID : getRandomInt(0, 0xffff)
  }, {
    iso639LanguageCode: 'fre',
    subtitlingType : getRandomInt(0, 0xff),
    compositionPageID : getRandomInt(0, 0xffff),
    ancillaryPageID : getRandomInt(0, 0xffff)
  }]
}, 89, 18);

testDescriptor({
  type : 'DVBDataBroadcastIDDescriptor',
  dataBroadcastID : getRandomInt(0, 0xffff),
  idSelectorByte : Buffer.from([getRandomInt(0, 0xff),
    getRandomInt(0, 0xff), getRandomInt(0, 0xff), getRandomInt(0, 0xff)])
}, 102, 8);

var unknownValue = {
  type: 'UnknownDescriptor',
  descriptorTag: getRandomInt(0, 0xff),
  value: Buffer.alloc(getRandomInt(0, 254), getRandomInt(0, 0xff))
};

testDescriptor(unknownValue,
  unknownValue.descriptorTag, unknownValue.value.length + 2);
