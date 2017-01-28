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

function readTimeStamp (buffer, offset) {
  // console.log('>>>',((buffer.readUInt8(offset) & 0x0e) * 536870912) +
  //   ((buffer.readUInt16BE(offset + 1) & 0xfffe) * 16384) +
  //   (buffer.readUInt16BE(offset + 3) / 2|0));
  return ((buffer.readUInt8(offset) & 0x0e) * 536870912) + // << 29
    ((buffer.readUInt16BE(offset + 1) & 0xfffe) * 16384) + // << 14
    (buffer.readUInt16BE(offset + 3)  / 2|0); // >> 1
}

function writeTimeStamp (ts, base, buffer, offset) {
  buffer.writeUInt8(base | (ts / 536870912|0) | 0x0001, offset);
  buffer.writeUInt16BE(((ts / 16384|0) & 0xfffe) | 0x01, offset + 1);
  buffer.writeUInt16BE(((ts * 2|0) & 0xfffe) | 0x01, offset + 3);
}

module.exports = {
  readTimeStamp : readTimeStamp,
  writeTimeStamp : writeTimeStamp
};
