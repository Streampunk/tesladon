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
var util = require('./util.js');

const rowsPerSection = 253;

function writePAT() {
  var patToSections = x => {
    if (x.type === 'ProgramAssociationTable') {
      var sections = {
        type: 'ProgramAssociationTablePayload',
        pid: 0,
        tableID: x.tableID,
        sectionSyntaxIndicator: 1,
        privateBit: 0,
        tableIDExtension: x.transportStreamID,
        versionNumber: x.versionNumber,
        currentNextIndicator: x.currentNextIndicator,
        payloads: []
      };
      var itemNo = 0;
      var currentPayload = null;
      if (x.networkID) {
        x.table[0] = x.networkID;
      }
      for ( var i in x.table ) {
        if (itemNo % rowsPerSection === 0) {
          currentPayload = new Buffer(4 * rowsPerSection);
          sections.payloads.push(currentPayload);
        }
        currentPayload.writeUInt16BE(i, (itemNo % rowsPerSection) * 4);
        currentPayload.writeUInt16BE(x.table[i] | 0xe000, (itemNo++ % rowsPerSection) * 4 + 2);
      }
      sections.payloads[sections.payloads.length - 1] =
        itemNo % rowsPerSection === 0 ?
          currentPayload :
          currentPayload.slice(0, (itemNo % rowsPerSection) * 4);
      return sections;
    } else {
      return x;
    }
  };
  return H.pipeline(
    H.map(patToSections),
    util.psiDistributor('ProgramAssociationTable', 0));
}

module.exports = writePAT;
