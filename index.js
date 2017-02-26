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

module.exports = {
  bufferGroup : require('./src/bufferGroup.js'),
  readTSPackets : require('./src/readTSPackets.js'),
  readPAT : require('./src/readPAT.js'),
  readPMTs : require('./src/readPMTs.js'),
  readPESPackets : require('./src/readPESPackets.js'),
  readTimeStamp : require('./src/util.js').readTimeStamp,
  writeTimeStamp : require('./src/util.js').writeTimeStamp,
  writeTSPackets : require('./src/writeTSPackets.js'),
  writePAT : require('./src/writePAT.js'),
  writePMTs : require('./src/writePMTs.js'),
  writePESPackets : require('./src/writePESPackets.js'),
  tsTimeToPTPTime : require('./src/util.js').tsTimeToPTPTime,
  ptpTimeToTsTime : require('./src/util.js').ptpTimeToTsTime,
  tsDaysSinceEpoch : require('./src/util.js').tsDaysSinceEpoch
};
