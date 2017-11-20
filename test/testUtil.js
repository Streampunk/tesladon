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

// Inclusive minimum, exclusive maximum
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomBoolean() {
  return Math.random() > 0.5;
}

function checkOnes(b, o) {
  return ((b.readUInt8(o) & 0x01) === 1) &&
    ((b.readUInt8(o + 2) & 0x01) === 1) &&
    ((b.readUInt8(o + 4) & 0x01) === 1);
}

module.exports = {
  getRandomInt: getRandomInt,
  getRandomBoolean: getRandomBoolean,
  checkOnes: checkOnes
};
