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
  // .default('metaclass', true)
  // .default('filler', false)
  // .default('detailing', true)
  // .default('nest', true)
  // .default('flatten', false)
  // .boolean(['filler', 'metaclass', 'detailing', 'nest', 'flatten'])
  .string(['version'])
  .usage('Dump an MPEG transport stream file as a stream of JSON objects.\n' +
    'Usage: $0 [options] <file.ts>')
  // .describe('filler', 'include filler in the output')
  // .describe('metadata', 'resolves keys to meta classes')
  // .describe('detailing', 'decode bytes to JS objects')
  // .describe('nest', 'nest children within preface')
  // .describe('flatten', 'show only detail for each KLV packet')
  .example('$0 my_stream.ts')
  .check((argv) => {
    fs.accessSync(argv._[0], fs.R_OK);
    return true;
  })
  .argv;

H(fs.createReadStream(argv._[0]))
  .pipe(tesladon.bufferGroup(188))
  .pipe(tesladon.readTSPackets())
//  .pipe(tesladon.readPAT(true))
//  .pipe(tesladon.readPMTs(true))
//  .pipe(tesladon.readPESPackets(true))
//  .filter(x => x.type !== 'TSPacket')
  .map(x => {
    if (x.type === 'PESPacket') {
      x.payloads = {
        number: x.payloads.length,
        size: x.payloads.reduce((x, y) => x + y.length, 0)
      };
    }
    return x;
  })
  .errors(console.error)
  .each(x => {
    console.log(util.inspect(x, { depth: null }));
  })
  .done(() => {
    console.log('Finished dumping MPEG transport stream data.');
  });
