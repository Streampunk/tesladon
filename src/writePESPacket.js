/* Copyright 2016 Streampunk Media Ltd.

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

function writeTimeStamp (ts, base, buffer, offset) {
  buffer.writeUInt8(base | (ts / 536870912|0) | 0x0001, offset);
  buffer.writeUInt16BE(((ts / 16384|0) & 0xfffe) | 0x01, offset + 1);
  buffer.writeUInt16BE((ts * 2|0) & 0xfffe) | 0x01, offset + 3);
}

function writePESPackets() {
  var continuityCounters = {};
  var pesWriter = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type === 'PESPacket') {
        var bytePos = 0;
        var counter = continuityCounters[x.pid];
        if (typeof counter === 'undefined') counter = 0;
        var headerPacket = {
          type : 'TSPacket',
          packetSync : 0x47,
          transportErrorIndicator : false,
          payloadUnitStartIndicator : true,
          transportPriority : false,
          pid : x.pid,
          scramblingControl : 0,
          adaptationFieldControl : 1,
          continuityCounter : counter++,
          payload : new Buffer(184)
        };
        headerPacket.payload.writeUIntBE(1, 0, 3);
        headerPacket.payload.writeUInt8(x.streamID, 3);
        headerPacket.payload.writeUInt16BE(x.pesPacketLength, 4);
        headerPacket.payload.writeUInt16BE(
          (x.scramblingControl & 0x03) << 12 |
          ((x.priority === true) ? 0x0800 : 0) |
          ((x.dataAlignmentIndicator === true) ? 0x0400 : 0) |
          ((x.copyright === true) ? 0x0200 : 0) |
          ((x.originalOrCopy === true) ? 0x0100 : 0) |
          (x.ptsDtsIndicator & 0x03) << 6 |
          ((x.escrFlag === true) ? 0x0020 : 0) |
          ((x.esRateFlag === true) ? 0x0010 : 0) |
          ((x.dsmTrickModeFlag === true) ? 0x0008 : 0) |
          ((x.additionalCopyInfoFlag === true) ? 0x0004 : 0) |
          ((x.crcFlag === true) ? 0x0002 : 0) |
          ((x.extensionFlag === true) ? 0x0001 : 0), 6);
        headerPacket.payload.writeUInt8(x.headerDataLength, 8);
        switch (x.ptsDtsIndicator) {
          case 2:
            writeTimeStamp(0x20, x.pts, headerPacket.payload, 9);
            break;
          case 3:
            writeTimeStamp(0x30, x.pts, headerPacket.payload, 9);
            writeTimeStamp(0x10, x.dts, headerPacket.payload, 14);
            break;
          default:
            break;
        }
        var data = (x.payloads.length === 1) ? x.payloads[0] :
          Buffer.concat(x.payloads);
        // TODO if PES size < single TS packet with header, this is wrong?
        var dataPos = data.slice(0, 184 - 9 - x.headerDataLength);
        push(null, headerPacket);
        while (dataPos < data.length - 184) {
          var nextPacket = {
            type : 'TSPacket',
            packetSync : 0x47,
            transportErrorIndicator : false,
            payloadUnitStartIndicator : false,
            transportPriority : false,
            pid : x.pid,
            scramblingControl : 0,
            adaptationFieldControl : 1,
            continuityCounter : counter++,
            payload : data.slice(dataPos, dataPos + 184)
          });
          dataPos += 184;
          push(null, nextPacket);
        };
        var finalPacket = {
          type : 'TSPacket',
          packetSync : 0x47,
          transportErrorIndicator : false,
          payloadUnitStartIndicator : false,
          transportPriority : false,
          pid : x.pid,
          scramblingControl : 0,
          adaptationFieldControl : 3,
          continuityCounter : counter++,
          adaptationField : {
            type : 'AdaptationField',
            adaptationFieldLength : 183 - (data.length - dataPos),
            discontinuityIndicator : false,
            randomAccessIndicator : false,
            elementaryStreamPriorityIndicator : false,
            pcrFlag : false,
            opcrFlag : false,
            splicingPointFlag : false,
            transportPrivateDataFlag : false,
            adaptationFieldExtensionFlag : false
          },
          payload : data.slice(dataPos)
        });
        push(null, finalPacket);
        continuityCounters[x.pid] = counter;
      } else {
        push(null, x);
      }
      next();
    }
  };
  return H.pipeline(H.consume(pesWriter));
}
