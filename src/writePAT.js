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
var crc = require('./util.js').crc;

function writePAT() {
  var contCounter = 0;
  var patToPacket = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type && x.type === 'ProgramAssocationTable') {
        var tsp = {
          type : 'TSPacket',
          packetSync : 0x47,
          transportErrorIndicator : false,
          payloadUnitStartIndicator : true,
          transportPriority : false,
          pid : 0,
          scramblingControl : 0,
          adaptationFieldControl : 1,
          continuityCounter : contCounter,
          payload : Buffer.allocUnsafe(184)
        };
        var tspp = tsp.payload;
        tspp.writeUInt8(x.pointerField, 0);
        var patOffset = 1;
        while (patOffset <= x.pointerField) {
          tspp.writeUInt8(0xff, patOffset++);
        }
        tspp.writeUInt8(x.tableID, patOffset++);
        var tableHeader = (x.sectionSyntaxHeader ? 0x8000 : 0) | 0x3000 |
          (x.sectionLength & 0x03ff);
        tspp.writeUInt16BE(tableHeader, patOffset);
        patOffset += 2;
        tspp.writeUInt16BE(x.transportStreamIdentifier, patOffset);
        patOffset += 2;
        var verCurNext = 0xc0 | ((x.versionNumber & 0x1f) << 1) |
          (x.currentNextIndicator ? 1 : 0);
        tspp.writeUInt8(verCurNext, patOffset++);
        tspp.writeUInt8(x.sectionNumber, patOffset++);
        tspp.writeUInt8(x.lastSectionNumber, patOffset++);
        Object.keys(x.table).forEach(k => {
          var entry = x.table[k];
          tspp.writeUInt16BE(entry.programNum, patOffset);
          tspp.writeUInt16BE(0xe000 | (entry.programMapPID & 0x1fff), patOffset + 2);
          patOffset += 4;
        });
        var crc32 = crc(tspp.slice(x.pointerField + 1, patOffset));
        if (crc32 !== x.CRC)
           console.error("Calculated CRC and existing CRC differ.");
        tspp.writeUInt32BE(crc32, patOffset);
        patOffset += 4;
        for ( var y = patOffset ; y < tspp.length ; y++ ) {
          tspp.writeUInt8(0xff, y);
        }
        contCounter = (contCounter + 1) % 16;
        push(null, tsp);
      } else {
        push(null, x);
      }
      next();
    }
  }
  return H.pipeline(H.consume(patToPacket));
}

module.exports = writePAT;
// 00 00 b0 0d b3 c8 c1 00 00 00 01 e1 00
// 00 00 b0 0d b3 c8 c1 00 00 00 01 e1 00
