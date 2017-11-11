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
var writeTimeStamp = require('./util.js').writeTimeStamp;

// var efs = Buffer.alloc(184, 0xff);

function writePESPackets() {
  var continuityCounters = {};
  var pesWriter = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type === 'PESPacket') {
        // var bytePos = 0;
        var counter = continuityCounters[x.pid];
        if (typeof counter === 'undefined') counter = 0;

        counter = counter % 16;
        var hpp = Buffer.allocUnsafe(x.pesHeaderLength + 9);
        hpp.writeUIntBE(1, 0, 3);
        hpp.writeUInt8(x.streamID, 3);
        hpp.writeUInt16BE(x.pesPacketLength, 4);
        hpp.writeUInt16BE(
          0x8000 |
          (x.scramblingControl & 0x03) << 12 |
          ((x.priority === true) ? 0x0800 : 0x0000) |
          ((x.dataAlignmentIndicator === true) ? 0x0400 : 0x0000) |
          ((x.copyright === true) ? 0x0200 : 0x0000) |
          ((x.originalOrCopy === true) ? 0x0100 : 0x0000) |
          (x.ptsDtsIndicator & 0x03) << 6 |
          ((x.escrFlag === true) ? 0x0020 : 0x0000) |
          ((x.esRateFlag === true) ? 0x0010 : 0x0000) |
          ((x.dsmTrickModeFlag === true) ? 0x0008 : 0x0000) |
          ((x.additionalCopyInfoFlag === true) ? 0x0004 : 0x0000) |
          ((x.crcFlag === true) ? 0x0002 : 0x0000) |
          ((x.extensionFlag === true) ? 0x0001 : 0x0000), 6);
        hpp.writeUInt8(x.pesHeaderLength, 8);
        switch (x.ptsDtsIndicator) {
        case 2:
          writeTimeStamp(x.pts, 0x20, hpp, 9);
          break;
        case 3:
          writeTimeStamp(x.pts, 0x30, hpp, 9);
          writeTimeStamp(x.dts, 0x10, hpp, 14);
          break;
        default:
          break;
        }
        var data = (x.payloads.length === 1) ? x.payloads[0] :
          Buffer.concat(x.payloads);
        var dataPos = 0;
        // while (dataPos < 184) hpp.writeUInt8(0xff, dataPos++);
        // push(null, headerPacket);
        var payloadStart = true;
        var available = 184 - hpp.length;
        console.log('***', x.payloads.map(x => x.length), available);
        while (dataPos < (data.length - available)) {
          var nextPacket = {
            type : 'TSPacket',
            packetSync : 0x47,
            transportErrorIndicator : false,
            payloadUnitStartIndicator : payloadStart,
            transportPriority : false,
            pid : x.pid,
            scramblingControl : 0,
            adaptationFieldControl : 1,
            continuityCounter : counter++,
            payload : payloadStart ? Buffer.concat(
              [hpp, data.slice(0, available)]) :
              data.slice(dataPos, dataPos + 184)
          };
          counter = counter % 16;
          dataPos += available;
          push(null, nextPacket);
          payloadStart = false;
          available = 184;
        }
        if (data.length - dataPos > 0) {
          var adaptationLength = 183 - (payloadStart ?
            (data.length - dataPos) + hpp.length :
            (data.length - dataPos));
          var finalPacket = {
            type : 'TSPacket',
            packetSync : 0x47,
            transportErrorIndicator : false,
            payloadUnitStartIndicator : payloadStart,
            transportPriority : false,
            pid : x.pid,
            scramblingControl : 0,
            adaptationFieldControl : 3,
            continuityCounter : counter++,
            adaptationField : {
              type : 'AdaptationField',
              adaptationFieldLength : adaptationLength,
              discontinuityIndicator : false,
              randomAccessIndicator : false,
              elementaryStreamPriorityIndicator : false,
              pcrFlag : false,
              opcrFlag : false,
              splicingPointFlag : false,
              transportPrivateDataFlag : false,
              adaptationFieldExtensionFlag : false
            },
            payload : payloadStart ?
              Buffer.concat([hpp, data]) : data.slice(dataPos)
          };
          push(null, finalPacket);
        }
        continuityCounters[x.pid] = counter % 16;
      } else {
        push(null, x);
      }
      next();
    }
  };
  return H.pipeline(H.consume(pesWriter));
}

module.exports = writePESPackets;
