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
var readTimeStamp = require('./Util.js').readTimeStamp;

function readPESPackets(filter) {
  var pesBuilder = {};
  var pesMaker = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type === 'TSPacket') {
        if (x.payloadUnitStartIndicator === true) {
          if (x.payload.readUIntBE(0, 3) !== 1) {
            console.error('Expected PES packet at payload start indicator.');
            return push(null, x);
          }
          var pesOptional = x.payload.readUInt16BE(6);
          var pesPacket = {
            type : 'PESPacket',
            pid : x.pid,
            streamID : x.payload.readUInt8(3),
            pesPacketLength : x.payload.readUInt16BE(4),
            scramblingControl : (pesOptional & 0x3000) >>> 12,
            priority : (pesOptional & 0x0800) !== 0,
            dataAlignmentIndicator : (pesOptional & 0x0400) !== 0,
            copyright : (pesOptional & 0x0200) !== 0,
            originalOrCopy : (pesOptional & 0x0100) !== 0,
            ptsDtsIndicator : (pesOptional & 0x00c0) >> 6,
            escrFlag : (pesOptional & 0x0020) !== 0,
            esRateFlag : (pesOptional & 0x0010) !== 0,
            dsmTrickModeFlag : (pesOptional & 0x0008) !== 0,
            additionalCopyInfoFlag : (pesOptional & 0x0004) !== 0,
            crcFlag : (pesOptional & 0x0002) !== 0,
            extensionFlag : (pesOptional & 0x00001) !== 0,
            pesHeaderLength : x.payload.readUInt8(8)
          };
          switch (pesPacket.ptsDtsIndicator) {
            case 2:
              pesPacket.pts = readTimeStamp(x.payload, 9);
              break;
            case 3:
              pesPacket.pts = readTimeStamp(x.payload, 9);
              pesPacket.dts = readTimeStamp(x.payload, 14);
            default:
              break;
          }
          pesPacket.payloads = [ x.payload.slice(9 + pesPacket.pesHeaderLength) ];
          if (pesBuilder[x.pid]) {
            var finishedPacket = pesBuilder[x.pid];
            pesBuilder[x.pid] = pesPacket;
            push(null, finishedPacket);
          } else {
            pesBuilder[x.pid] = pesPacket;
          }
        } else {
          if (pesBuilder[x.pid]) {
            pesBuilder[x.pid].payloads.push(x.payload);
          };
        }
        if (!filter) push(null, x);
      } else {
        push(null, x);
      }
      next();
    }
  }
  return H.pipeline(H.consume(pesMaker));
}

module.exports = readPESPackets;
