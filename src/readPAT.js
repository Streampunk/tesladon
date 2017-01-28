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

function readPAT(filter) {
  var makePAT = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type === 'TSPacket' && x.pid === 0) {
        var patOffset = 1 + x.payload.readUInt8(0);
        var tableHeader = x.payload.readUInt16BE(patOffset + 1);
        var pat = {
          type : 'ProgramAssocationTable',
          pid : 0,
          pointerField : patOffset - 1,
          tableID : x.payload.readUInt8(patOffset),
          sectionSyntaxHeader : (tableHeader & 0X8000) !== 0,
          privateBit : (tableHeader & 0x4000) !== 0,
          sectionLength : tableHeader & 0x3ff,
          transportStreamIdentifier : x.payload.readUInt16BE(patOffset + 3),
          versionNumber : x.payload.readUInt8(patOffset + 5) & 0x3c / 2 | 0,
          currentNextIndicator : (x.payload.readUInt8(patOffset + 5) & 0x01) !== 0,
          sectionNumber : x.payload.readUInt8(patOffset + 6),
          lastSectionNumber : x.payload.readUInt8(patOffset + 7)
        };
        patOffset += 8;
        while (patOffset < pat.sectionLength + 4) {
          var programNum = x.payload.readUInt16BE(patOffset);
          var programMapPID = x.payload.readUInt16BE(patOffset + 2) & 0x1fff;
          if (!pat.table) pat.table = {};
          pat.table[programMapPID] = {
            programNum : programNum,
            programMapPID : programMapPID
          };
          patOffset += 4;
        }
        pat.CRC = x.payload.readUInt32BE(patOffset);
        if (!filter) push(null, x);
        push(null, pat);
      } else {
        push(null, x);
      }
      next();
    }
  }
  return H.pipeline(H.consume(makePAT));
}

module.exports = readPAT;
