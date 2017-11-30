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

const H = require('highland');
const writeDescriptor = require('./writeDescriptor.js');
const util = require('./util.js');

function writePMTs() {
  var pmtToSections = x => {
    if (x.type && x.type === 'ProgramMapTable') {
      var sections = {
        type: 'ProgramMapTablePayload',
        pid: x.pid,
        tableID: x.tableID,
        sectionSyntaxIndicator: 1,
        privateBit: 0,
        tableIDExtension: x.programNumber,
        versionNumber: x.versionNumber,
        currentNextIndicator: x.currentNextIndicator,
        payloads: []
      };
      var currentPayload = Buffer.alloc(1012);
      currentPayload.writeUInt16BE(0xe000 | x.pcrPid, 0);
      var pos = 4;
      for ( let pi of x.programInfo ) {
        repeat: try {
          pos += writeDescriptor(pi, currentPayload, pos);
        } catch (e) {
          if (e.name === 'RangeError') {
            currentPayload.writeUInt16BE(0xf000 | ((pos - 4) & 0x03ff), 2);
            sections.payloads.push(currentPayload.slice(0, pos));
            currentPayload = Buffer.alloc(1012);
            currentPayload.writeUInt16BE(0xe000 | x.pcrPid, 0);
            pos = 4;
            break repeat;
          } else {
            console.error(e);
          }
        }
      } // end program info for-loop
      currentPayload.writeUInt16BE(0xf000 | ((pos - 4) & 0x03ff), 2);

      for ( let el in x.programElements ) {
        var esStreamInfo = x.programElements[el];
        againAgain: try {
          currentPayload.writeUInt8(
            util.streamTypeNameID[esStreamInfo.streamType], pos);
          currentPayload.writeUInt16BE(
            0xe000 | (esStreamInfo.elementaryPID & 0x1fff), pos + 1);
          let localPos = pos + 5;
          for ( let esi of esStreamInfo.esInfo ) {
            localPos += writeDescriptor(esi, currentPayload, localPos);
          }
          currentPayload.writeUInt16BE(
            0xf000 | ((localPos - (pos + 5)) & 0x03ff), pos + 3);
          pos = localPos;
        } catch (e) {
          if (e.name === 'RangeError') {
            sections.payloads.push(currentPayload.slice(0, pos));
            currentPayload = Buffer.alloc(1012);
            currentPayload.writeUInt16BE(0xe000 | x.pcrPid, 0);
            currentPayload.writeUInt16BE(0xe000, 2); // No more program info
            pos = 4;
            break againAgain;
          } else {
            console.error(e);
          }
        }
      } // end progrma elements for-loop
      sections.payloads.push(currentPayload.slice(0, pos));
      return sections;
    } else {
      return x;
    }
  };
  return H.pipeline(
    H.map(pmtToSections),
    util.psiDistributor('ProgramMapTable'));
}

module.exports = writePMTs;
