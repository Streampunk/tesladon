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

var tesladon = require('..');
var H = require('highland');
var fs = require('fs');

var latestPes = null;
var inCount = 0;
var outCount = 0;

H(fs.createReadStream(process.argv[2]))
  .pipe(tesladon.bufferGroup(188))
  .pipe(tesladon.readTSPackets())
  .pipe(tesladon.readPAT(true))
  .pipe(tesladon.readPMTs(true))
  .pipe(tesladon.readPESPackets(true))
  .doto(x => {
    if (x.type === 'PESPacket') {
      console.log('>>>IN>>>', inCount++, x);
      console.log();
    }
  })
  .pipe(tesladon.writePESPackets())
  .pipe(tesladon.readPESPackets(true))
  .filter(x => x.type === 'PESPacket')
  .each(x => {
    console.log('<<<OUT<<<', outCount++, x);
    console.log();
  });
