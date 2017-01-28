/* Copyright 2016 Streampunk Media Ltd.

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

var fs = require('fs');
var H = require('highland');
var bufferGroup = require('../src/bufferGroup.js');
var readTSPacket = require('../src/readTSPackets.js');
var readPAT = require('../src/readPAT.js');
var readPMTs = require('../src/readPMTs.js');
var readPESPackets = require('../src/readPESPackets.js');

var ts = H(fs.createReadStream(process.argv[2]));

ts
  .pipe(bufferGroup(188))
  .pipe(readTSPacket())
  .pipe(readPAT(true))
  .pipe(readPMTs(true))
  .pipe(readPESPackets(true))
  .filter(x => x.type === 'PESPacket' && x.pid === 4097)
  .each(x => H.log(x.payloads))
