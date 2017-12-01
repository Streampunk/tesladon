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
const readDescriptor = require('./readDescriptor.js');
const util = require('./util.js');

function genny () {
  var push = null;
  var next = null;
  var fn = (hpush, hnext) => {
    push = hpush;
    next = hnext;
  };
  return {
    stream : H(fn),
    push : x => { push(null, x); next(); },
    end : () => { push(null, H.nil); }
  };
}

function readPMTs (filter = true) {
  var pmtStreams = {};
  var setupStreams = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      Object.values(pmtStreams).forEach(s => { s.end(); });
      push (null, x);
    } else {
      if (x.type === 'ProgramAssociationTable') {
        Object.values(x.table).filter(pid => // add filters for known PMTs
          pmtStreams[pid] === undefined)
          .forEach(pid => {
            pmtStreams[pid] = genny();
            pmtStreams[pid].stream
              .through(util.psiCollector(pid))
              .map(makePMT)
              .errors(e => { push(e); })
              .each(pmt => {
                push(null, pmt);
              });
          });
        push(null, x);
        next();
      } else {
        if (x.type === 'TSPacket' && pmtStreams[x.pid]) {
          pmtStreams[x.pid].push(x);
          if (!filter) push(null, x);
        } else {
          push(null, x);
        }
        next();
      }

    }
  };

  var makePMT = x => {
    var pmt = {
      type : 'ProgramMapTable',
      pid : x.pid,
      tableID : x.sections[0].tableID,
      programNumber : x.sections[0].tableIDExtension,
      versionNumber : x.sections[0].versionNumber,
      currentNextIndicator : x.sections[0].currentNextIndicator,
      pcrPid: x.sections[0].payload.readUInt16BE(0) & 0x1fff,
      programInfo: [],
      programElements: {}
    };
    pmt.programInfo = x.sections.map(s => {
      let programInfoLength = s.payload.readUInt16BE(2) & 0x03ff;
      let remaining = s.payload.slice(4, programInfoLength + 4);
      let progDescriptors = [];
      while (remaining.lenth > 2) {
        let nextDescriptor = readDescriptor(remaining);
        progDescriptors.push(nextDescriptor.descriptor);
        remaining = nextDescriptor.remaining;
      }
      return progDescriptors;
    });
    pmt.programInfo = Array.prototype.concat(...pmt.programInfo);
    var programInfoOffsets =
      x.sections.map(s => ({
        offset: (s.payload.readUInt16BE(2) & 0x03ff) + 4,
        section: s }) );
    for ( let item of programInfoOffsets ) {
      let pos = item.offset;
      while ( pos < item.section.payload.length ) {
        let esStreamInfo = {
          type: 'ElementaryStreamInfo',
          streamType: util.streamTypeIDName[item.section.payload.readUInt8(pos)],
          elementaryPID: item.section.payload.readUInt16BE(pos + 1) & 0x1fff,
          esInfo: []
        };
        let esInfoLength = item.section.payload.readUInt16BE(pos + 3) & 0x3ff;
        pos += 5;
        let remaining = item.section.payload.slice(pos, pos + esInfoLength);
        while (remaining.length > 2) {
          let nextDescriptor = readDescriptor(remaining);
          esStreamInfo.esInfo.push(nextDescriptor.descriptor);
          remaining = nextDescriptor.remaining;
        }
        pos += esInfoLength;
        pmt.programElements[esStreamInfo.elementaryPID] = esStreamInfo;
      }
    }
    return pmt;
  };
  return H.pipeline(H.consume(setupStreams));
}

module.exports = readPMTs;
