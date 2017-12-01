#!/usr/bin/env node
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

const tesladon = require('.');
const H = require('highland');
const fs = require('fs');
const util = require('util');

var argv = require('yargs')
  .help('help')
  .default('pat', true)
  .default('pmt', true)
  .default('pes', true)
  .default('filter', true)
  .default('video', true)
  .default('audio', true)
  .default('anc', true)
  .default('payload', false)
  .default('tspacket', false)
  .array('pid')
  .number('pid')
  .boolean(['pat', 'pmt', 'pes', 'filter', 'video',
    'audio', 'anc', 'payload', 'tspacket'])
  .string(['version'])
  .usage('Dump an MPEG transport stream file as a stream of JSON objects.\n' +
    'Usage: $0 [options] <file.ts>')
  .describe('pat', 'include the PAT in the output')
  .describe('pmt', 'include the PMTs in the output')
  .describe('pes', 'include pes packets in the output')
  .describe('filter', 'filter out TS packets that have been processed')
  .describe('pid', 'list of pids to include in output, default is all')
  .describe('video', 'include video PES packets in the output')
  .describe('audio', 'include audio PES packets in the output')
  .describe('anc', 'include all other PES packets in the output')
  .describe('payloads', 'show the payload bytes of packets')
  .describe('tspacket', 'include raw transport stream packets')
  .example('$0 --pat false --video false my_stream.ts')
  .example('$0 --pid 0 --pid 4096 my_stream.ts')
  .check((argv) => {
    fs.accessSync(argv._[0], fs.R_OK);
    return true;
  })
  .argv;

H(fs.createReadStream(argv._[0]))
  .through(tesladon.bufferGroup(188))
  .through(tesladon.readTSPackets())
  .through(tesladon.readPAT(argv.filter))
  .through(tesladon.readPMTs(argv.filter))
  .through(tesladon.readPESPackets(argv.filter))
  .map(x => {
    if ((!argv.payloads) && (x.payloads)) {
      x.payloads = {
        number: x.payloads.length,
        size: x.payloads.reduce((x, y) => x + y.length, 0)
      };
    }
    return x;
  })
  .flatMap(x => {
    switch (x.type) {
    case 'ProgramAssociationTable':
      return argv.pat ? H([x]) : H([]);
    case 'ProgramMapTable':
      return argv.pmt ? H([x]) : H([]);
    case 'PESPacket':
      if (!argv.pes) return H([]);
      if (x.streamID.startsWith('video_stream')) {
        return argv.video ? H([x]) : H([]);
      }
      if (x.streamID.startsWith('audio_stream')) {
        return argv.audio ? H([x]) : H([]);
      }
      return argv.anc ? H([x]) : H([]);
    case 'TSPacket':
      return argv.tspacket ? H([x]) : H([]);
    default:
      return H([x]);
    }
  })
  .filter(x =>
    (!argv.pid || argv.pid.length === 0) ||
    argv.pid.indexOf(x.pid) >= 0)
  .errors(console.error)
  .each(x => {
    console.log(util.inspect(x, { depth: null }));
  })
  .done(() => {
    console.log('Finished dumping MPEG transport stream data.');
  });
