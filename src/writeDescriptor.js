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

const util = require('./util.js');

// TODO Write all descriptor types.

module.exports = (d, b, o) => {
  var s = o;
  var fields = [];
  if (d.type.endsWith('Raw')) { // For descriptors not yet parsed - backstop
    b.writeUInt8(d.descriptorTag, o++);
    b.writeUInt8(d.descriptorLength, o++);
    o += b.value.copy(b, o);
    return s - o;
  }
  switch (d.type) {
  case 'VideoStreamDescriptor':
    b.writeUInt8(2, o++);
    b.writeUInt8(d.mpeg1OnlyFlag ? 3 : 1, o++);
    fields.push((d.multipleFrameRateFlag ? 0x80 : 0x00) |
        ((d.frameRateCode & 0x0f) << 3) |
        (d.frameRateCode ? 0x04 : 0x00) |
        (d.constraintParameterFlag ? 0x02 : 0x00) |
        (d.stillPictureFlag ? 0x01 : 0x00));
    b.writeUInt8(fields[0], o++);
    if (d.mpeg1OnlyFlag === true) {
      b.writeUInt8(d.profileAndLevelIndication, o++);
      b.writeUInt8(((d.chromaFormat & 0x03) << 6) |
          (d.frameRateExtensionFlag ? 0x20 : 0x00) | 0x1f, o++);
    }
    break;
  case 'AudioStreamDescriptor':
    b.writeUInt8(3, o++);
    b.writeUInt8(1, o++);
    fields.push((d.freeFormatFlag ? 0x80 : 0x00) |
        (d.ID ? 0x40 : 0x00) |
        ((d.layer & 0x03) << 4) |
        (d.variableRateAudioIndicator ? 0x08 : 0x00) | 0x07);
    b.writeUInt8(fields, o++);
    break;
  case 'ISO639LanguageDescriptor':
    b.writeUInt8(10, o++);
    b.writeUInt8(d.languages.length * 4, o++);
    d.languages.forEach(l => {
      o += Buffer.from(l.iso639LanguageCode, 'utf8').copy(b, o);
      b.writeUInt8(util.audioTypeNameID[l.audioType], o++);
    });
    break;
  case 'MaximumBitrateDescriptor':
    b.writeUInt8(14, o++);
    b.writeUInt8(4, o++);
    b.writeUInt32BE((d.maximumBitrate / 50|0) & 0x3fffffff, o);
    o += 4;
    break;
  case 'IBPDescriptor':
    b.writeUInt8(18, o++);
    b.writeUInt8(2, o++);
    b.writeUInt16BE((d.closedGopFlag ? 0x8000 : 0x0000) |
        (d.identicalGopFlag ? 0x4000 : 0x0000) |
        (d.maxGopLength & 0x3fff), o);
    o += 2;
    break;
  case 'DSMCCCarouselIdentifierDescriptor':
    b.writeUInt8(19, o++);
    b.writeUInt8(4 + d.privateData.length, o++);
    b.writeUInt32BE(d.carouselID, o);
    d.privateData.copy(b, o + 4);
    o += 4 + d.privateData.length;
    break;
  case 'MPEG4VideoDescriptor':
    b.writeUInt8(27, o++);
    b.writeUInt8(1, o++);
    b.writeUInt8(d.MPEG4VisualProfileAndLevel, o++);
    break;
  case 'MPEG4AudioDescriptor':
    b.writeUInt8(28, o++);
    b.writeUInt8(1, o++);
    b.writeUInt8(d.MPEG4AudioProfileAndLevel, o++);
    break;
  case 'AVCVideoDescriptor':
    b.writeUInt8(40, o++);
    b.writeUInt8(4, o++);
    b.writeUInt8(d.profileIDC, o++);
    b.writeUInt8((d.constraintFlag0 ? 0x80 : 0x00) |
        (d.constraintFlag1 ? 0x40 : 0x00) |
        (d.constraintFlag2 ? 0x20 : 0x00) |
        (d.avcCompatibleFlag & 0x1f), o++);
    b.writeUInt8(d.levelIDC, o++);
    b.writeUInt8((d.avcStillPresent ? 0x80 : 0x00) |
        (d.avc24HourPictureFlag ? 0x40 : 0x00) | 0x3f, o++);
    break;
  case 'MPEG2AACAudioDescriptor':
    b.writeUInt8(43, o++);
    b.writeUInt8(3, o++);
    b.writeUInt8(d.mpeg2AACProfile, o++);
    b.writeUInt8(d.mpeg2AACChannelConfiguration, o++);
    b.writeUInt8(d.mpeg2AACAdditionalInformation, o++);
    break;
  case 'DVBStreamIdentifierDescriptor':
    b.writeUInt8(82, o++);
    b.writeUInt8(1, o++);
    b.writeUInt8(d.componentTag, o++);
    break;
  case 'DVBSubtitlingDescriptor':
    b.writeUInt8(89, o++);
    b.writeUInt8(d.languages.length * 8, o++);
    for ( let l of d.languages ) {
      Buffer.from(l.iso639LanguageCode, 'utf8').copy(b, o);
      b.writeUInt8(l.subtitlingType, o + 3);
      b.writeUInt16BE(l.compositionPageID, o + 4);
      b.writeUInt16BE(l.ancillaryPageID, o + 6);
      o += 8;
    }
    break;
  case 'DVBDataBroadcastIDDescriptor':
    b.writeUInt8(102, o++);
    b.writeUInt8(2 + d.idSelectorByte.length, o++);
    b.writeUInt16BE(d.dataBroadcastID, o);
    d.idSelectorByte.copy(b, o + 2);
    o += 2 + d.idSelectorByte.length;
    break;
  case 'UnknownDescriptor':
    b.writeUInt8(d.descriptorTag, o++);
    b.writeUInt8(d.value.length, o++);
    o += d.value.copy(b, o);
    break;
  default:
    break;
  }
  return o - s;
};
