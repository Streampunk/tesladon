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

function readTimeStamp (buffer, offset) {
  // console.log('>>>',((buffer.readUInt8(offset) & 0x0e) * 536870912) +
  //   ((buffer.readUInt16BE(offset + 1) & 0xfffe) * 16384) +
  //   (buffer.readUInt16BE(offset + 3) / 2|0));
  return ((buffer.readUInt8(offset) & 0x0e) * 536870912) + // << 29
    ((buffer.readUInt16BE(offset + 1) & 0xfffe) * 16384) + // << 14
    (buffer.readUInt16BE(offset + 3)  / 2|0); // >> 1
}

function writeTimeStamp (ts, base, buffer, offset) {
  if (typeof ts !== 'number') {
    throw new TypeError(`Timestamp must be a number and provided value is ${typeof ts}.`);
  }
  if (ts < 0 || ts > 0x1ffffffff) {
    throw new RangeError(`Timestamp value ${ts} is out of range 0 to 0x1ffffffff.`);
  }
  buffer.writeUInt8((base & 0xf0) | ((ts / 536870912|0) & 0x0e) | 0x0001, offset);
  buffer.writeUInt16BE(((ts / 16384|0) & 0xfffe) | 0x01, offset + 1);
  buffer.writeUInt16BE(((ts * 2 | 0) & 0xfffe) | 0x01, offset + 3);
}

const tsDay = Math.pow(2, 33);
const tsDaysMS = Math.pow(2, 33) / 90;

function tsTimeToPTPTime (t) {
  if (typeof t !== 'number') {
    throw new TypeError(`Timestamp must be a number and provided value is ${typeof t}.`);
  }
  var epochTSDays = (Date.now() / tsDaysMS) | 0;
  var ticksSinceEpoch = tsDay * epochTSDays + t;
  var secondsSinceEpoch = ticksSinceEpoch / 90000;
  var roundedSeconds = secondsSinceEpoch | 0;
  return [ roundedSeconds, (secondsSinceEpoch - roundedSeconds) * 1000000000|0 ];
}

function ptpTimeToTsTime (p) {
  if (!Array.isArray(p) || p.length !== 2 || p.find(x => typeof x !== 'number')) {
    throw new TypeError(`PTP timestamp must be an array of numbers length 2, not ${typeof p}.`);
  }
  var baseTicksSinceEpoch = p[0] * 90000;
  var ticksInSecond = ((p[1] / 1000000000) * 90000 + 0.5 ) |0;
  var totalTicks = baseTicksSinceEpoch + ticksInSecond;
  var epochTSDaysTicks = totalTicks / tsDay |0;
  return totalTicks - epochTSDaysTicks * tsDay;
}

function tsDaysSinceEpoch() {
  return (Date.now() / tsDaysMS) | 0;
}

// CRC-32 code adapted from the output of Thomas Pircher's (MIT licensed) pycrc.
var crcTable = [
  0x00000000, 0x04c11db7, 0x09823b6e, 0x0d4326d9, 0x130476dc, 0x17c56b6b, 0x1a864db2, 0x1e475005,
  0x2608edb8, 0x22c9f00f, 0x2f8ad6d6, 0x2b4bcb61, 0x350c9b64, 0x31cd86d3, 0x3c8ea00a, 0x384fbdbd,
  0x4c11db70, 0x48d0c6c7, 0x4593e01e, 0x4152fda9, 0x5f15adac, 0x5bd4b01b, 0x569796c2, 0x52568b75,
  0x6a1936c8, 0x6ed82b7f, 0x639b0da6, 0x675a1011, 0x791d4014, 0x7ddc5da3, 0x709f7b7a, 0x745e66cd,
  0x9823b6e0, 0x9ce2ab57, 0x91a18d8e, 0x95609039, 0x8b27c03c, 0x8fe6dd8b, 0x82a5fb52, 0x8664e6e5,
  0xbe2b5b58, 0xbaea46ef, 0xb7a96036, 0xb3687d81, 0xad2f2d84, 0xa9ee3033, 0xa4ad16ea, 0xa06c0b5d,
  0xd4326d90, 0xd0f37027, 0xddb056fe, 0xd9714b49, 0xc7361b4c, 0xc3f706fb, 0xceb42022, 0xca753d95,
  0xf23a8028, 0xf6fb9d9f, 0xfbb8bb46, 0xff79a6f1, 0xe13ef6f4, 0xe5ffeb43, 0xe8bccd9a, 0xec7dd02d,
  0x34867077, 0x30476dc0, 0x3d044b19, 0x39c556ae, 0x278206ab, 0x23431b1c, 0x2e003dc5, 0x2ac12072,
  0x128e9dcf, 0x164f8078, 0x1b0ca6a1, 0x1fcdbb16, 0x018aeb13, 0x054bf6a4, 0x0808d07d, 0x0cc9cdca,
  0x7897ab07, 0x7c56b6b0, 0x71159069, 0x75d48dde, 0x6b93dddb, 0x6f52c06c, 0x6211e6b5, 0x66d0fb02,
  0x5e9f46bf, 0x5a5e5b08, 0x571d7dd1, 0x53dc6066, 0x4d9b3063, 0x495a2dd4, 0x44190b0d, 0x40d816ba,
  0xaca5c697, 0xa864db20, 0xa527fdf9, 0xa1e6e04e, 0xbfa1b04b, 0xbb60adfc, 0xb6238b25, 0xb2e29692,
  0x8aad2b2f, 0x8e6c3698, 0x832f1041, 0x87ee0df6, 0x99a95df3, 0x9d684044, 0x902b669d, 0x94ea7b2a,
  0xe0b41de7, 0xe4750050, 0xe9362689, 0xedf73b3e, 0xf3b06b3b, 0xf771768c, 0xfa325055, 0xfef34de2,
  0xc6bcf05f, 0xc27dede8, 0xcf3ecb31, 0xcbffd686, 0xd5b88683, 0xd1799b34, 0xdc3abded, 0xd8fba05a,
  0x690ce0ee, 0x6dcdfd59, 0x608edb80, 0x644fc637, 0x7a089632, 0x7ec98b85, 0x738aad5c, 0x774bb0eb,
  0x4f040d56, 0x4bc510e1, 0x46863638, 0x42472b8f, 0x5c007b8a, 0x58c1663d, 0x558240e4, 0x51435d53,
  0x251d3b9e, 0x21dc2629, 0x2c9f00f0, 0x285e1d47, 0x36194d42, 0x32d850f5, 0x3f9b762c, 0x3b5a6b9b,
  0x0315d626, 0x07d4cb91, 0x0a97ed48, 0x0e56f0ff, 0x1011a0fa, 0x14d0bd4d, 0x19939b94, 0x1d528623,
  0xf12f560e, 0xf5ee4bb9, 0xf8ad6d60, 0xfc6c70d7, 0xe22b20d2, 0xe6ea3d65, 0xeba91bbc, 0xef68060b,
  0xd727bbb6, 0xd3e6a601, 0xdea580d8, 0xda649d6f, 0xc423cd6a, 0xc0e2d0dd, 0xcda1f604, 0xc960ebb3,
  0xbd3e8d7e, 0xb9ff90c9, 0xb4bcb610, 0xb07daba7, 0xae3afba2, 0xaafbe615, 0xa7b8c0cc, 0xa379dd7b,
  0x9b3660c6, 0x9ff77d71, 0x92b45ba8, 0x9675461f, 0x8832161a, 0x8cf30bad, 0x81b02d74, 0x857130c3,
  0x5d8a9099, 0x594b8d2e, 0x5408abf7, 0x50c9b640, 0x4e8ee645, 0x4a4ffbf2, 0x470cdd2b, 0x43cdc09c,
  0x7b827d21, 0x7f436096, 0x7200464f, 0x76c15bf8, 0x68860bfd, 0x6c47164a, 0x61043093, 0x65c52d24,
  0x119b4be9, 0x155a565e, 0x18197087, 0x1cd86d30, 0x029f3d35, 0x065e2082, 0x0b1d065b, 0x0fdc1bec,
  0x3793a651, 0x3352bbe6, 0x3e119d3f, 0x3ad08088, 0x2497d08d, 0x2056cd3a, 0x2d15ebe3, 0x29d4f654,
  0xc5a92679, 0xc1683bce, 0xcc2b1d17, 0xc8ea00a0, 0xd6ad50a5, 0xd26c4d12, 0xdf2f6bcb, 0xdbee767c,
  0xe3a1cbc1, 0xe760d676, 0xea23f0af, 0xeee2ed18, 0xf0a5bd1d, 0xf464a0aa, 0xf9278673, 0xfde69bc4,
  0x89b8fd09, 0x8d79e0be, 0x803ac667, 0x84fbdbd0, 0x9abc8bd5, 0x9e7d9662, 0x933eb0bb, 0x97ffad0c,
  0xafb010b1, 0xab710d06, 0xa6322bdf, 0xa2f33668, 0xbcb4666d, 0xb8757bda, 0xb5365d03, 0xb1f740b4
];

var crc = b => {
  if (!Buffer.isBuffer(b)) {
    throw new TypeError(`MPEG-CRC calculations only work for buffers, not ${typeof b}.`);
  }
  var crc = 0xffffffff;
  for (var i = 0; i < b.length; ++i) {
    var tableIndex = ((crc >>> 24) ^ b[i]) & 0xff;
    crc = ((crcTable[tableIndex] ^ (crc << 8)) & 0xffffffff) >>> 0;
  }
  return (crc & 0xffffffff) >>> 0;
};

var tableIDName = {
  0x00 : 'program_association_section',
  0x01 : 'conditional_access_section',
  0x02 : 'TS_program_map_section',
  0x03 : 'TS_description_section',
  0x04 : 'ISO_IEC_14496_scene_description_section',
  0x05 : 'ISO_IEC_14996_object_descriptor_section',
  0x06 : 'metadata_section',
  0x07 : 'IPMP_control_information_section',
  0xff : 'forbidden'
};
for ( let x = 0x08 ; x <= 0x3f ; x++ )
  tableIDName[x] = `ISO/IEC_13818-1_reserved_0x${x.toString(16)}`;
for ( let x = 0x40 ; x < 0xff ; x++ )
  tableIDName[x] = `user_private_0x${x.toString(16)}`;

var tableNameID = {};
for ( let id in tableIDName ) tableNameID[tableIDName[id]] = +id;

var streamTypeIDName = {
  0x00 : 'ITU-T | ISO/IEC Reserved',
  0x01 : 'ISO/IEC 11172-2 Video',
  0x02 : 'ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream',
  0x03 : 'ISO/IEC 11172-3 Audio',
  0x04 : 'ISO/IEC 13818-3 Audio',
  0x05 : 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 private_sections',
  0x06 : 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 PES packets containing private data',
  0x07 : 'ISO/IEC 13522 MHEG',
  0x08 : 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 Annex A DSM-CC',
  0x09 : 'ITU-T Rec. H.222.1',
  0x0a : 'ISO/IEC 13818-6 type A',
  0x0b : 'ISO/IEC 13818-6 type B',
  0x0c : 'ISO/IEC 13818-6 type C',
  0x0d : 'ISO/IEC 13818-6 type D',
  0x0e : 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 auxiliary',
  0x0f : 'ISO/IEC 13818-7 Audio with ADTS transport syntax',
  0x10 : 'ISO/IEC 14496-2 Visual',
  0x11 : 'ISO/IEC 14496-3 Audio with the LATM transport syntax as defined in ISO/IEC 14496-3',
  0x12 : 'ISO/IEC 14496-1 SL-packetized stream or FlexMux stream carried in PES packets',
  0x13 : 'ISO/IEC 14496-1 SL-packetized stream or FlexMux stream carried in ISO/IEC 14496_sections',
  0x14 : 'ISO/IEC 13818-6 Synchronized Download Protocol',
  0x15 : 'Metadata carried in PES packets',
  0x16 : 'Metadata carried in metadata_sections',
  0x17 : 'Metadata carried in ISO/IEC 13818-6 Data Carousel',
  0x18 : 'Metadata carried in ISO/IEC 13818-6 Object Carousel',
  0x19 : 'Metadata carried in ISO/IEC 13818-6 Synchronized Download Protocol',
  0x1a : 'IPMP stream (defined in ISO/IEC 13818-11, MPEG-2 IPMP)',
  0x1b : 'AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video',
  0x7f : 'IPMP stream'
};

for ( let x = 0x1c ; x <= 0x7e ; x++ )
  streamTypeIDName[x] = `ITU-T Rec. H.222.0 | ISO/IEC 13818-1 Reserved 0x${x.toString(16)}`;
for ( let x = 0x80 ; x <= 0xff ; x++ )
  streamTypeIDName[x] = `User Private 0x${x.toString(16)}`;

var streamTypeNameID = {};
for ( let id in streamTypeIDName )
  streamTypeNameID[streamTypeIDName[id]] = +id;

var audioTypeIDName = {
  0x00 : 'Undefined',
  0x01 : 'Clean effects',
  0x02 : 'Hearing impaired',
  0x03 : 'Visual impaired commentary'
};

for ( let x = 0x04 ; x <= 0x7f ; x++ )
  audioTypeIDName[x] = `User Private 0x${x.toString(16)}`;
for ( let x = 0x04 ; x <= 0xff ; x++ )
  audioTypeIDName[x] = `Reserved 0x${x}`;

var audioTypeNameID = {};
for ( let id in audioTypeIDName )
  audioTypeNameID[audioTypeIDName[id]] = +id;

/* function bitStringProcessor (s) {
  let acc = 0;
  for ( let x of s ) {
    acc = (acc << 1) | (x === '1' ? 1 : 0);
  }
  return acc;
} */

var streamIDName = {
  0xbc: 'program_stream_map',
  0xbd: 'private_stream_1',
  0xbe: 'padding_stream',
  0xbf: 'private_stream_2',
  0xf0: 'ECM_stream',
  0xf1: 'EMM_stream',
  0xf2: 'DSMCC_stream',
  0xf3: '13522_stream',
  0xf4: 'type_A',
  0xf5: 'type_B',
  0xf6: 'type_C',
  0xf7: 'type_D',
  0xf8: 'type_E',
  0xf9: 'ancillary_stream',
  0xfa: 'SL-packetized_stream',
  0xfb: 'FlexMux_stream',
  0xfc: 'metadata_stream',
  0xfd: 'extended_stream_id',
  0xfe: 'reserved_data_stream',
  0xff: 'program_stream_directory'
};

for ( let x = 0 ; x <= 0x1f ; x++ )
  streamIDName[0xc0 | x] = `audio_stream_number_0x${x.toString(16)}`;
for ( let x = 0 ; x <= 0x0f ; x++ )
  streamIDName[0xe0 | x] = `video_stream_number_0x${x.toString(16)}`;
for ( let x = 0 ; x <= 0xff ; x++ )
  if (!streamIDName[x]) streamIDName[x] = `undefined_0x${x.toString(16)}`;

var streamNameID = {};
for ( let id in streamIDName )
  streamNameID[streamIDName[id]] = +id;

function sectionCollector(pid, filter = true) {
  var section = null;
  var lengthDiff = 0;
  var continuityCheck = null;
  var collector = x => {
    if (x.type === 'TSPacket' && x.pid === pid) {
      if (continuityCheck === null) {
        continuityCheck = x.continuityCounter;
      } else if (x.continuityCounter !== ++continuityCheck % 16) {
        console.log(`Warning: Continuity check fail for pid ${pid}, expected ${continuityCheck} and got ${x.continuityCounter}.`);
        continuityCheck = x.continuityCounter;
      }

      if (x.payloadUnitStartIndicator || section === null) { // start of new section
        let pointerFieldOffset = x.payload.readUInt8(0) + 1;
        let tableHeader = x.payload.readUInt16BE(pointerFieldOffset + 1);
        section = {
          type: 'PSISection',
          pid: pid,
          pointerField: pointerFieldOffset - 1,
          tableID: tableIDName[x.payload.readUInt8(pointerFieldOffset)],
          sectionSyntaxIndicator: (tableHeader & 0x8000) >>> 15,
          privateBit: (tableHeader & 0x4000) >>> 14,
          length: tableHeader & 0x0fff,
          start: 3 + pointerFieldOffset,
          pos: 0
        };
        if (section.sectionSyntaxIndicator === 1) {
          section.tableIDExtension = x.payload.readUInt16BE(pointerFieldOffset + 3);
          section.versionNumber = (x.payload.readInt8(pointerFieldOffset + 5) & 0x3e) >> 1;
          section.currentNextIndicator = x.payload.readInt8(pointerFieldOffset + 5) & 0x01;
          section.sectionNumber = x.payload.readUInt8(pointerFieldOffset + 6);
          section.lastSectionNumber = x.payload.readUInt8(pointerFieldOffset + 7);
          section.start += 5;
        }
        if (section.length > (section.tableID.startsWith('user_private') ? 4093 : 1021)) {
          console.log(`Warning: Received section header for PID ${pid} with length ${section.length}` +
            ` exceeding maximum of ${(section.sectionSyntaxIndicator === 1) ? 1021 : 4093}.`);
          section.length = (section.sectionSyntaxIndicator === 1) ? 1021 : 4093;
        }
        lengthDiff = section.sectionSyntaxIndicator === 1 ? 5 : 0;
        section.payload = Buffer.alloc(section.length - lengthDiff);
        section.pos = x.payload.copy(section.payload, 0, section.start);
      } else {
        section.pos += x.payload.copy(section.payload, section.pos);
      }
      if ((section.pos + lengthDiff) >= section.length) {
        let result = section;
        if (section.sectionSyntaxIndicator === 1) { // CRC omitted for private section
          result.CRC = result.payload.readUInt32BE(result.payload.length - 4);
          result.payload = result.payload.slice(0, -4); // Chop the CRC off the end
        }
        delete result.pos; delete result.start;
        section = null; lengthDiff = 0;
        return filter ? H([result]) : H([x, result]);
      } else {
        return filter ? H([]) : H([x]);
      }
    } else {
      return H([x]);
    }
  };
  return H.pipeline(H.flatMap(collector));
}

function tableCollector(pid, filter = true) {
  var sections = null;
  var collector = x => {
    if (x.type === 'PSISection' && x.pid === pid) {
      if (!sections) sections = {};
      sections[x.sectionNumber] = x;
      var gotAllSections = true;
      for ( var y = 0 ; y <= x.lastSectionNumber ; y++ ) {
        if (!sections[y]) { gotAllSections = false; break; }
      }
      if (gotAllSections) {
        var result = {
          type: 'PSISections',
          pid: pid,
          sections: Object.values(sections)
        };
        sections = null;
        return filter ? H([result]) : H([x, result]);
      } else {
        return filter ? H([]) : H([x]);
      }
    } else {
      return H([x]);
    }
  };
  return H.pipeline(H.flatMap(collector));
}

function psiCollector(pid, filter = true) {
  return H.pipeline(
    sectionCollector(pid, filter),
    tableCollector(pid, filter) );
}

function makeSectionHeader (sec) {
  var header = Buffer.alloc(sec.sectionSyntaxIndicator === 1 ? 8 : 3);
  header.writeUInt8(tableNameID[sec.tableID], 0);
  let tableHeader =
    (sec.sectionSyntaxIndicator === 1 ? 0x8000 : 0) |
    (sec.privateBit === 1 ? 0x4000 : 0) |
    0x3000 | // reserved bits all on
    sec.length & 0x0fff;
  header.writeUInt16BE(tableHeader, 1);
  if (sec.sectionSyntaxIndicator === 1) {
    header.writeUInt16BE(sec.tableIDExtension, 3);
    var versionByte = 0xc0 |
      ((sec.versionNumber & 0x1f) << 1) |
      (sec.currentNextIndicator & 0x1);
    header.writeUInt8(versionByte, 5);
    header.writeUInt8(sec.sectionNumber, 6);
    header.writeUInt8(sec.lastSectionNumber, 7);
  }
  return header;
}

const ALL_PIDS = -1;

function tableDistributor (type, pid = ALL_PIDS) {
  const typeName = type + 'Payload';
  var distributor = t => {
    if (t.type === typeName && (t.pid === pid || pid === ALL_PIDS)) {
      var psiSecs = {
        type: 'PSISections',
        pid: t.pid,
        sections: []
      };
      var maxSize = t.tableID.startsWith('user_private') ? 4089 : 1017;
      maxSize -= t.sectionSyntaxIndicator === 1 ? 5 : 0;
      for ( var secNo = 0 ; secNo < t.payloads.length ; secNo++ ) {
        var sec = {
          type: 'PSISection',
          pid: t.pid,
          pointerField: 0,
          tableID: t.tableID,
          sectionSyntaxIndicator: t.sectionSyntaxIndicator,
          privateBit: t.privateBit,
          length: 0
        };
        if (t.sectionSyntaxIndicator === 1) {
          sec.tableIDExtension = t.tableIDExtension;
          sec.versionNumber = t.versionNumber;
          sec.currentNextIndicator = t.currentNextIndicator;
          sec.sectionNumber = secNo;
          sec.lastSectionNumber = t.payloads.length - 1;
          sec.length += 5;
        }
        sec.payload = t.payloads[secNo].slice(0, maxSize);
        if (sec.payload.length < t.payloads[secNo].length) {
          throw new Error(`Section payload data for pid ${t.pid} has length ` +
            `${t.payloads[0].length} that exceeds limit of ${maxSize}.`);
        }
        sec.length += sec.payload.length + (t.sectionSyntaxIndicator === 1 ? 4 : 0); // Allow space for CRC if syntax indicated
        sec.headerBytes = makeSectionHeader(sec);
        if (t.sectionSyntaxIndicator === 1) {
          sec.CRC = crc(Buffer.concat([sec.headerBytes.slice(3), sec.payload],
            t.sectionSyntaxIndicator === 1 ? sec.payload.length + 5 : sec.payload.length));
        }
        psiSecs.sections.push(sec);
      }
      return psiSecs;
    } else {
      return t;
    }
  };
  return H.pipeline(H.map(distributor));
}

function sectionDistributor (pid = ALL_PIDS) {
  var continuityCounter = 0;
  var distributor = s => {
    if (s.type === 'PSISections' && (s.pid === pid || pid === ALL_PIDS)) {
      var tsps = [];
      var pos = 0;
      for ( var sec of s.sections ) {
        var crcBytes = Buffer.allocUnsafe(sec.sectionSyntaxIndicator === 1 ? 4 : 0);
        if (crcBytes.length === 4) crcBytes.writeUInt32BE(sec.CRC, 0);
        var secPayload = Buffer.concat([sec.headerBytes, sec.payload, crcBytes],
          sec.headerBytes.length + sec.payload.length + crcBytes.length);
        var tsp = {
          type: 'TSPacket',
          packetSync: 0x47,
          transportErrorIndicator: false,
          payloadUnitStartIndicator: true,
          transportPriority: false,
          pid: s.pid,
          scramblingControl: 0,
          adaptationFieldControl: 1,
          continuityCounter: continuityCounter++ % 16,
          payload: Buffer.allocUnsafe(184)
        };
        tsp.payload.writeUInt8(sec.pointerField, 0);
        for ( pos = 1 ; pos <= sec.pointerField ; pos++ )
          tsp.payload.writeInt8(0xff, pos);
        var posInSec = secPayload.copy(tsp.payload, pos, 0);
        tsp.payload.fill(0xff, pos + posInSec);
        tsps.push(tsp);
        while (posInSec < secPayload.length) {
          tsp = {
            type: 'TSPacket',
            packetSync: 0x47,
            transportErrorIndicator: false,
            payloadUnitStartIndicator: false,
            transportPriority: false,
            pid: s.pid,
            scramblingControl: 0,
            adaptationFieldControl: 1,
            continuityCounter: continuityCounter++ % 16,
            payload: Buffer.allocUnsafe(184)
          };
          let written = secPayload.copy(tsp.payload, 0, posInSec);
          posInSec += written;
          tsp.payload.fill(0xff, written);
          tsps.push(tsp);
        }
      }
      return H(tsps);
    } else {
      return H([s]);
    }
  };
  return H.pipeline(H.flatMap(distributor));
}

function psiDistributor (type, pid = ALL_PIDS) {
  return H.pipeline(
    tableDistributor(type, pid),
    sectionDistributor(pid)
  );
}

module.exports = {
  readTimeStamp : readTimeStamp,
  writeTimeStamp : writeTimeStamp,
  crcMpeg : crc,
  tsTimeToPTPTime : tsTimeToPTPTime,
  ptpTimeToTsTime : ptpTimeToTsTime,
  tsDaysSinceEpoch : tsDaysSinceEpoch,
  sectionCollector : sectionCollector,
  tableCollector : tableCollector,
  psiCollector : psiCollector,
  tableDistributor : tableDistributor,
  sectionDistributor : sectionDistributor,
  psiDistributor : psiDistributor,
  tableNameID : tableNameID,
  tableIDName : tableIDName,
  streamTypeIDName : streamTypeIDName,
  streamTypeNameID : streamTypeNameID,
  audioTypeIDName : audioTypeIDName,
  audioTypeNameID : audioTypeNameID,
  streamIDName : streamIDName,
  streamNameID : streamNameID,
  ALL_PIDS : ALL_PIDS
};

// var testB = Buffer.from([0x00, 0xb0, 0x0d, 0xb3, 0xc8, 0xc1,
//   0x00, 0x00, 0x00, 0x01, 0xe1, 0x00]);
// console.log((crc(testB) >>> 0).toString(10));
