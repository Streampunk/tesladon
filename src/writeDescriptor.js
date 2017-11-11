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

// TODO Write all descriptor types.

module.exports = (d, b, o) => {
  var s = o;
  if (d.type.endsWith('Raw')) { // For descriptors not yet parsed - backstop
    b.writeUInt8(d.descriptorTag, o++);
    b.writeUInt8(d.descriptorLength, o++);
    o += b.value.copy(b, o);
    return s - o;
  }
  switch (d.type) {
  case 'VideoStreamDescritpor':
    b.writeUInt8(2, o++);
    b.writeUInt8(d.mpeg1OnlyFlag ? 3 : 1, o++);
    var fields = (d.multipleFrameRateFlag ? 0x80 : 0x00) |
        ((d.frameRateCode & 0x0f) << 3) |
        (d.frameRateCode ? 0x04 : 0x00) |
        (d.constraintParameterFlag ? 0x02 : 0x00) |
        (d.stillPictureFlag ? 0x01 : 0x00);
    b.writeUInt8(fields, o++);
    if (d.mpeg1OnlyFlag === true) {
      b.writeUInt8(d.profileAndLevelIndication, o++);
      b.writeUInt8(((d.chromaFormat & 0x03) << 6) |
          (b.frameRateExtensionFlag ? 0x20 : 0x00) | 0x1f, o++);
    }
    break;
  case 'AudioStreamDescriptor':
    b.writeUInt8(3, o++);
    b.writeUInt8(1, o++);
    var fields = (d.freeFormatFlag ? 0x08 : 0x00) |
        (d.ID ? 0x40 : 0x00) |
        ((d.layer & 0x03) << 4) |
        (d.variableRateAudioIndicator ? 0x08 : 0x00) | 0x07;
    b.writeUInt8(fields, o++);
    break;
  case 'ISO639LanguageDescriptor':
    b.writeUInt8(10, o++);
    b.writeUInt8(d.descriptorLength, o++);
    d.languages.forEach(l => {
      o += Buffer.from(l.iso639LanguageCode, 'utf8').copy(b, o);
      b.writeUInt8(l.audioType, o++);
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
    b.writeUInt16BE((d.closedGopFlag ? 0x80 : 0x00) |
        (d.identicalGopFlag ? 0x40 : 0x00) |
        (d.maxGopLength & 0x3fff), o);
    o += 2;
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
    b.writeUInt8(d.profileIDC. o++);
    var fields1 = (d.constraintFlag1 ? 0x80 : 0x00) |
        (d.constraintFlag2 ? 0x40 : 0x00) |
        (d.constraintFlag3 ? 0x20 : 0x00) |
        (d.avcCompatibleFlag & 0x1f);
    b.writeUInt8(fields1, o++);
    b.writeUInt8(d.levelIDC, o++);
    var fields3 = (d.avcStillPresent ? 0x80 : 0x00) |
        (d.avc24HourPictureFlag ? 0x40 : 0x00) | 0x3f;
    b.writeUInt8(fields3, o++);
    break;
  case 'MPEG2AACAudioDescriptor':
    b.writeUInt8(43, o++);
    b.writeUInt8(3, o++);
    b.writeUInt8(d.mpeg2AACProfile, o++);
    b.writeUInt8(d.mpeg2AACChannelConfiguration, o++);
    b.writeUInt8(d.mpeg2AACAdditionalInformation, o++);
    break;
  default:
    break;
  }
  return o - s;
};
