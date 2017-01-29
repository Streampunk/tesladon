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
var writeDescriptor = require('./writeDescriptor.js');

function writePMTs() {
  var contCounter = 0;
  var pmtToPacket = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type && x.type === 'ProgramMapTable') {
        var tsp = {
          type : 'TSPacket',
          packetSync : 0x47,
          transportErrorIndicator : false,
          payloadUnitStartIndicator : true,
          transportPriority : false,
          pid : x.pid,
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
        tssp.writeUInt16BE(x.programNum, pmtOffset);
        pmtOffset += 2;
        var verCurNext = 0xc0 | ((x.versionNumber & 0x1f) << 1) |
          (x.currentNextIndicator ? 1 : 0);
        tspp.writeUInt8(verCurNext, patOffset++);
        tspp.writeUInt8(x.sectionNumber, patOffset++);
        tspp.writeUInt8(x.lastSectionNumber, patOffset++);
        tspp.writeUInt16BE(0xe0 | (x.pcrPid & 0x1fff), pmtOffset);
        pmtOffset += 2;
        tspp.writeUInt16BE(0xf0 | (x.programInfoLength & 0x3ff), pmtOffset);
        pmtOffset += 2;

        x.programInfo.forEach(p => {
          var written = writeDescriptor(p, tspp, pmtOffset);
          pmtOffset += written;
        });
        if (x.esStreamInfo) {
          Object.keys(x.esStreamInfo).forEach(k => {
            var e = x.esStreamInfo[k];
            tspp.writeUInt8(e.streamType, pmtOffset++);
            tspp.writeUInt16BE(0xe000 | (e.elementaryPid & 0x1ff), pmtOffset);
            pmtOffset += 2;
            tspp.writeUInt16BE(0xf000 | (e.esInfoLength & 0x3ff), pmtOffset);
            pmtOffset += 2;
            e.esInfo.forEach(i => {
              var written = writeDescriptor(i, tspp, pmtOffset);
              pmtOffset += written;
            });
          });;
        }
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
  return H.pipeline(H.consume(pmtToPacket));
}

module.exports = writePMTs;
