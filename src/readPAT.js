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
const psiCollector = require('./util.js').psiCollector;

function readPAT(filter = true) {
  var makePAT = x => {
    if (x.type === 'PSISections' && x.pid === 0) {
      if (x.sections.length <= 0)
        throw new Error('Cannot process a PAT section array with no sections!');
      var pat = {
        type: 'ProgramAssociationTable',
        pid: 0,
        tableID: x.sections[0].tableID,
        // sectionSyntaxIndicator: 1, These need to be written in PATPayload
        // privateBit: 0,
        transportStreamID: x.sections[0].tableIDExtension,
        versionNumber: x.sections[0].versionNumber,
        currentNextIndicator: x.sections[0].currentNextIndicator,
        sectionCount: x.sections[0].lastSectionNumber + 1,
        table: {}
      };
      var tableData = Buffer.concat(x.sections.map(s => s.payload));
      for ( var p = 0 ; p < tableData.length; p += 4) {
        pat.table[tableData.readUInt16BE(p)] =
          tableData.readUInt16BE(p + 2) & 0x1fff;
      }
      if (pat.table[0]) pat.networkID = pat.table[0];
      return filter ? H([pat]) : H([x, pat]);
    } else {
      return H([x]);
    }
  };
  return H.pipeline(
    psiCollector(0, filter),
    H.flatMap(makePAT) );
}

module.exports = readPAT;
