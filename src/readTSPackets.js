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

var H = require('highland');
var readTimeStamp = require('./util.js').readTimeStamp;

function readTSPackets() {
  var packetMap = x => {
    var header = x.readUInt32BE(0);
    var packet = {
      type : 'TSPacket',
      packetSync : (header & 0xff000000) >> 24,
      transportErrorIndicator : (header & 0x800000) !== 0,
      payloadUnitStartIndicator : (header & 0x400000) !== 0,
      transportPriority : (header & 0x200000) !== 0,
      pid : (header & 0x1fff00) >>> 8,
      scramblingControl : (header & 0xc0) >>> 6,
      adaptationFieldControl : (header & 0x30) >>> 4,
      continuityCounter : (header & 0xf)
    };
    if ((packet.adaptationFieldControl & 0x2) !== 0) {
      var adaptationLength = x.readUInt8(4);
      if (adaptationLength === 0) {
        packet.adaptationField = {
          type : 'AdaptationField',
          adaptationFieldLength : 0
        };
      } else {
        var flags = x.readUInt8(5);
        packet.adaptationField = {
          type : 'AdaptationField',
          adaptationFieldLength : adaptationLength,
          discontinuityIndicator : (flags & 0x80) !== 0,
          randomAccessIndicator : (flags & 0x40) !== 0,
          elementaryStreamPriorityIndicator : (flags & 0x20) !== 0,
          pcrFlag : (flags & 0x10) !== 0,
          opcrFlag : (flags & 0x08) !== 0,
          splicingPointFlag : (flags & 0x04) !== 0,
          transportPrivateDataFlag : (flags & 0x02) !== 0,
          adaptationFieldExtensionFlag : (flags & 0x01) !== 0
        };
      }
      var adaptationPosition = 6;
      if (packet.adaptationField.pcrFlag === true) {
        var pcrBase = x.readUInt32BE(adaptationPosition);
        var pcrExtension = x.readUInt16BE(adaptationPosition + 4);
        pcrBase = pcrBase * 2 + (((pcrExtension & 0x8000) !== 0) ? 1 : 0);
        pcrExtension = pcrExtension & 0x1ff;
        packet.adaptationField.pcr = pcrBase * 300 + pcrExtension;
        adaptationPosition += 6;
      }
      if (packet.adaptationField.opcrFlag === true) {
        var opcrBase = x.readUInt32BE(adaptationPosition);
        var opcrExtension = x.readUInt16BE(adaptationPosition + 4);
        opcrBase = opcrBase * 2 + (((opcrExtension & 0x8000) !== 0) ? 1 : 0);
        opcrExtension = opcrExtension & 0x1ff;
        packet.adaptationField.opcr = opcrBase * 300 + opcrExtension;
        adaptationPosition += 6;
      }
      if (packet.adaptationField.splicingPointFlag === true) {
        packet.adaptationField.spliceCountdown = x.readUInt8(adaptationPosition);
        adaptationPosition++;
      }
      if (packet.adaptationField.transportPrivateDataFlag === true) {
        var transportPrivateDataLength = x.readUInt8(adaptationPosition);
        adaptationPosition++;
        packet.adaptationField.transportPrivateData =
          x.slice(adaptationPosition, adaptationPosition + transportPrivateDataLength);
        adaptationPosition += transportPrivateDataLength;
      }
      if (packet.adaptationField.adaptationFieldExtensionFlag === true) {
        // console.log(x, adaptationPosition, packet);
        var adaptExtFlags = x.readUInt8(adaptationPosition + 1);
        packet.adaptationField.adaptationFieldExtension = {
          adaptationExtensionLength : x.readUInt8(adaptationPosition),
          legalTimeWindowFlag : (adaptExtFlags & 0x80) !== 0,
          piecewiseRateFlag : (adaptExtFlags & 0x40) !== 0,
          seamlessSpliceFlag : (adaptExtFlags & 0x20) !== 0
        };
        adaptationPosition += 2;
        if (packet.adaptationField.adaptationFieldExtension.legalTimeWindowFlag === true) {
          var ltw = x.readUInt16BE(adaptationPosition);
          packet.adaptationField.adaptationFieldExtension.legalTimeWindowValidFlag =
            (ltw & 0x8000) !== 0;
          packet.adaptationField.adaptationFieldExtension.legalTimeWindowOffset =
            ltw & 0x7fff;
          adaptationPosition += 2;
        }
        if (packet.adaptationField.adaptationFieldExtension.piecewiseRateFlag === true) {
          var pw = x.readUIntBE(adaptationPosition, 3);
          packet.adaptationField.adaptationFieldExtension.piecewiseRate =
            pw & 0x3fffff;
          adaptationPosition += 3;
        }
        if (packet.adaptationField.adaptationFieldExtension.seamlessSpliceFlag === true) {
          packet.adaptationField.adaptationFieldExtension.spliceType =
            x.readUInt8(adaptationPosition) / 16 | 0;
          packet.adaptationField.adaptationFieldExtension.dtsNextAccessUnit =
            readTimeStamp(x, adaptationPosition);
          adaptationPosition += 5;
        }
      }
    }
    if ((packet.adaptationFieldControl & 0x01) !== 0) {
      packet.payload = (packet.adaptationField) ?
        x.slice(5 + packet.adaptationField.adaptationFieldLength) :
        x.slice(4);
    }
    return packet;
  };
  return H.pipeline(H.map(packetMap));
}

module.exports = readTSPackets;
