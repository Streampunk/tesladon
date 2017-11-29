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

// TODO Read all descriptor types.

module.exports = b => {
  var length = b.readUInt8(1);
  var result = null;
  var fields = [];
  var pos = 0;
  switch (b.readUInt8(0)) {
  case 2: // Video stream descriptor
    fields.push(b.readUInt8(2));
    result = {
      type : 'VideoStreamDescriptor',
      descriptorTag : 2,
      descriptorLength : length,
      multipleFrameRateFlag : (fields[0] & 0x80) !== 0,
      frameRateCode : (fields[0] & 0x78) >>> 3,
      mpeg1OnlyFlag : (fields[0] & 0x04) !== 0,
      constraintParameterFlag : (fields[0] & 0x02) !== 0,
      stillPictureFlag : (fields[0] & 0x01) !== 0
    };
    if (result.mpeg1OnlyFlag === true) {
      result.profileAndLevelIndication = b.readUInt8(3);
      result.chromaFormat = (b.readUInt8(4) & 0xc0) >>> 6;
      result.frameRateExtensionFlag = (b.readUInt8(4) & 0x20) !== 0;
    }
    break;
  case 3:
    fields.push(b.readUInt8(2));
    result = {
      type : 'AudioStreamDescriptor',
      descriptorTag : 3,
      descriptorLength : length,
      freeFormatFlag : (fields[0] & 0x80) !== 0,
      ID : (fields[0] & 0x40) !== 0,
      layer : (fields[0] & 0x30) >>> 4,
      variableRateAudioIndicator : (fields[0] & 0x08) !== 0
    };
    break;
  case 4: // Hierarchy descriptor
    result = backstop(b, 'HierarchyDescriptorRaw');
    break;
  case 5: // registration descriptor
    result = backstop(b, 'RegistrationDescriptorRaw');
    break;
  case 7: // targetBackgroudGridDescriptor
    result = backstop(b, 'TargetBackgroundGridDescriptorRaw');
    break;
  case 8: // videoWindowDescriptor
    result = backstop(b, 'VideoWindowDescriptorRaw');
    break;
  case 9: // CA descriptor
    result = backstop(b, 'CADescriptorRaw');
    break;
  case 10: // ISO_639_langauage descriptor
    result = {
      type : 'ISO639LanguageDescriptor',
      descriptorTag : 10,
      descriptorLength : length,
    };
    result.languages = [];
    while (pos < length) {
      result.languages.push({
        iso639LanguageCode : b.slice(pos + 2, pos + 5).toString('utf8'),
        audioType : util.audioTypeIDName[b.readUInt8(pos + 5)]
      });
      pos += 4;
    }
    break;
  case 11: // systemClockDescriptor
    result = backstop(b, 'SystemClockDescriptorRaw');
    break;
  case 12: // multiplexBufferUtilizationDescriptor
    result = backstop(b, 'MultiplexBufferUtilizationDescriptorRaw');
    break;
  case 13: // copyright`descriptor
    result = backstop(b, 'CopyrightDescriptorRaw');
    break;
  case 14: // maximum Bitrate descriptor
    result = {
      type : 'MaximumBitrateDescriptor',
      descriptorTag : 14,
      descriptorLength : length,
      maximumBitrate : (b.readUInt32BE(2) & 0x3fffffff) * 50
    }; // Note: value in descriptor is units of 50bytes/sec
    break;
  case 15: //`private data indicator descriptor
    result = backstop(b, 'PrivateDataIndicatorDescriptorRaw');
    break;
  case 16: // smoothing buffer descriptor
    result = backstop(b, 'SmoothingBufferDescriptorRaw');
    break;
  case 17: // STD descriptor
    result = backstop(b, 'STDDescriptorRaw');
    break;
  case 18: // IBP descriptor
    fields.push(b.readUInt16BE(2));
    result = {
      type : 'IBPDescriptor',
      descriptorTag : 18,
      descriptorLength : length,
      closedGopFlag : (fields[0] & 0x8000) !== 0,
      identicalGopFlag : (fields[0] & 0x4000) !== 0,
      maxGopLength : fields[0] & 0x3fff
    };
    break;
  case 19:
    result = {
      type: 'DSMCCCarouselIdentifierDescriptor',
      descriptorTag : 19,
      descriptorLength : length,
      carouselID : b.readUInt32BE(2),
      privateData: b.slice(6, 2 + length)
    };
    break;
  case 27: // MPEG-4 video descriptor
    result = {
      type : 'MPEG4VideoDescriptor',
      descriptorTag : 27,
      descriptorLength : length,
      MPEG4VisualProfileAndLevel : b.readUInt8(2)
    };
    break;
  case 28: // MPEG-4 audio descriptor
    result = {
      type : 'MPEG4AudioDescriptor',
      descriptorTag : 28,
      descriptorLength : length,
      MPEG4AudioProfileAndLevel : b.readUInt8(2)
    };
    break;
  case 29: // IOD descriptor
    result = backstop(b, 'IODDescriptorRaw');
    break;
  case 30: // SL descriptor
    result = backstop(b, 'SLDescriptorRaw');
    break;
  case 31: // FMC descriptor
    result = backstop(b, 'FMCDescriptorRaw');
    break;
  case 32: // external ES ID descriptor
    result = backstop(b, 'ExternalEsIDDescriptorRaw');
    break;
  case 33: // MuxCode descriptor
    result = backstop(b, 'MuxCodeDescriptorRaw');
    break;
  case 34: // FmxBufferSize descriptor
    result = backstop(b, 'FmxBufferSizeDescriptorRaw');
    break;
  case 35: // MultiplexBuffer descriptor
    result = backstop(b, 'MultiplexBufferDescriptorRaw');
    break;
  case 36: // ContentLabeling descriptor
    result = backstop(b, 'ContentLabelingDescriptorRaw');
    break;
  case 37: // MetadataPointer descriptor
    result = backstop(b, 'MetadataPointerDescriptorRaw');
    break;
  case 38: // Metadata descriptor
    result = backstop(b, 'MetadataDescriptorRaw');
    break;
  case 39: // metadata STD descriptor
    result = backstop(b, 'MetadatSTDDescriptorRaw');
    break;
  case 40: // AVC video descriptor
    fields.push(b.readUInt8(3));
    fields.push(b.readUInt8(5));
    result = {
      type : 'AVCVideoDescriptor',
      descriptorTag : 40,
      descriptorLength : length,
      profileIDC : b.readUInt8(2),
      constraintFlag0 : (fields[0] & 0x80) !== 0,
      constraintFlag1 : (fields[0] & 0x40) !== 0,
      constraintFlag2 : (fields[0] & 0x20) !== 0,
      avcCompatibleFlag : (fields[0] & 0x1f),
      levelIDC : b.readUInt8(4),
      avcStillPresent : (fields[1] & 0x80) !== 0,
      avc24HourPictureFlag : (fields[1] & 0x40) !== 0
    };
    break;
  case 41: // IPMP descriptor
    result = backstop(b, 'IPMPDescriptorRaw');
    break;
  case 42: // AVC timing and HRD descriptor
    result = backstop(b, 'AVCTimingAndHRDDescriptorRaw');
    break;
  case 43: // MPEG-2 AAC audio descriptor
    result = {
      type : 'MPEG2AACAudioDescriptor',
      descriptorTag : 43,
      descriptorLength : length,
      mpeg2AACProfile : b.readUInt8(2),
      mpeg2AACChannelConfiguration : b.readUInt8(3),
      mpeg2AACAdditionalInformation : b.readUInt8(4)
    };
    break;
  case 44: // FlexMuxTiming descriptor
    result = backstop(b, 'FlexMuxTimingDescriptorRaw');
    break;
  case 82: // DVB - stream identifier descriptor
    result = {
      type : 'DVBStreamIdentifierDescriptor',
      descriptorTag: 82,
      descriptorLength : length,
      componentTag: b.readUInt8(2)
    };
    break;
  case 89: // DVB - subtitling descriptorTag
    result = {
      type: 'DVBSubtitlingDescriptor',
      descriptorTag: 89,
      descriptorLength: length,
      languages: []
    };
    while (pos < length) {
      result.languages.push({
        iso639LanguageCode : b.slice(pos + 2, pos + 5).toString('utf8'),
        subtitlingType : b.readUInt8(pos + 5),
        compositionPageID : b.readUInt16BE(pos + 6),
        ancillaryPageID : b.readUInt16BE(pos + 8)
      });
      pos += 8;
    }
    break;
  case 102:
    result = {
      type: 'DVBDataBroadcastIDDescriptor',
      descriptorTag: 102,
      descriptorLength: length,
      dataBroadcastID: b.readUInt16BE(2),
      idSelectorByte: b.slice(4, 2 + length)
    };
    break;
  default:
    result = backstop(b, 'UnknownDescriptor');
    break;
  }
  return { descriptor : result, remaining : b.slice(length + 2) };
};

function backstop(b, type) {
  var length = b.readUInt8(1);
  return {
    type : type,
    descriptorTag : b.readUInt8(0),
    descriptorLength : length,
    value : b.slice(2, 2 + length)
  };
}
