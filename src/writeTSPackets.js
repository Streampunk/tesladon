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
var writeTimeStamp = require('./util.js').writeTimeStamp;

function writeTSPacket() {
  var makeTSPacket = (err, x, push, next) => {
    if (err) {
      push(err);
      return next();
    } else if (x === H.nil) {
      push(null, x);
    } else {
      if (x.type && x.type === 'TSPacket') {
        var b = Buffer.allocUnsafe(188);
        var header = (x.packetSync << 24) |
          (x.transportErrorIndicator ? 0x800000 : 0) |
          (x.payloadUnitStartIndicator ? 0x400000 : 0) |
          (x.transportPriority ? 0x200000 : 0) |
          ((x.pid & 0x1fff) << 8) |
          ((x.scramblingControl & 0x3) << 6) |
          ((x.adaptationFieldControl & 0x03) << 4) |
          (x.continuityCounter & 0x0f);
        b.writeUInt32BE(header, 0);
        if ((x.adaptationFieldControl & 0x02) !== 0) {
          var af = x.adaptationField;
          b.writeUInt8(af.adaptationFieldLength, 4);
          if (af.adaptationFieldLength > 0) {
            var flags = (af.discontinuityIndicator ? 0x80 : 0) |
              (af.randomAccessIndicator ? 0x40 : 0) |
              (af.elementaryStreamPriorityIndicator ? 0x20 : 0) |
              (af.pcrFlag ? 0x10 : 0) |
              (af.opcrFlag ? 0x08 : 0) |
              (af.splicingPointFlag ? 0x04 : 0) |
              (af.transportPrivateDataFlag ? 0x02 : 0) |
              (af.adaptationFieldExtensionFlag ? 0x01 : 0);
            b.writeUInt8(flags, 5);
          }
          var adaptationStart = 5;
          var adaptationPosition = 6;
          if (af.pcrFlag === true) {
            var pcrBase = af.pcr / 300|0;
            var pcrExtension = af.pcr % 300;
            b.writeUInt32BE(pcrBase >>> 1, adaptationPosition);
            b.writeUInt16BE(((pcrBase & 0x01) << 15) | 0x7e00 | pcrExtension,
              adaptationPosition + 4);
            adaptationPosition += 6;
          }
          if (af.opcrFlag === true) {
            var opcrBase = af.pcr / 300|0;
            var opcrExtension = af.pcr % 300;
            b.writeUInt32BE(opcrBase >>> 1, adaptationPosition);
            b.writeUInt16BE(((opcrBase & 0x01) << 15) | 0x7e00 | opcrExtension,
              adaptationPosition + 4);
            adaptationPosition += 6;
          }
          if (af.splicingPointFlag === true) {
            b.writeUInt8(af.spliceCountdown, adaptationPosition);
            adaptationPosition++;
          }
          if (af.transportPrivateDataFlag === true) {
            b.writeUInt8(af.transportPrivateDataLength, adaptationPosition);
            adaptationPosition++;
            af.transportPrivateData.copy(b, adaptationPosition,
              0, af.transportPrivateDataLength);
            adaptationPosition += ad.transportPrivateDataLength;
          }
          if (af.adaptationFieldExtensionFlag === true) {
            var afx = af.adaptationFieldExtension;
            b.writeUInt8(afx.adaptationExtensionLength, adaptationPosition);
            var extensionStart = adaptationPosition + 1;
            var extFlags = (afx.legalTimeWindowFlag ? 0x80 : 0) |
              (afx.piecewiseRateFlag ? 0x40 : 0) |
              (afx.seamlessSpliceFlag ? 0x20 : 0) | 0x1f;
            b.writeUInt8(extFlags, adaptationPosition + 1);
            adaptationPosition += 2;
            if (afx.legalTimeWindowFlag === true) {
              b.writeUInt16BE(
                (afx.legalTimeWindowValidFlag ? 0x8000 : 0) |
                (afx.legalTimeWindowOffset & 0x7fff),
                adaptationPosition);
              adaptationPosition += 2;
            }
            if (afx.piecewiseRateFlag === true) {
              b.writeUIntBE(0xc00000 | (afx.piecewiseRate & 0x3fffff),
                adaptationPosition, 3);
              adaptationPosition += 3;
            }
            if (afx.seamlessSpliceFlag === true) {
              writeTimeStamp(afx.dtsNextAccessUnit,
                (afx.spliceType & 0x0f) << 4, b, adaptationPosition);
              adaptationPosition += 5;
            }
            for ( var y = adaptationPosition ;
                    y < extensionStart + afx.adaptationExtensionLength ; y++) {
              b.writeUInt8(0xff, y);
              adaptationPosition++;
            }
          } // end adaptation extensions
          for ( var z = adaptationPosition ;
                  z < adaptationStart + af.adaptationFieldLength ; z++ ) {
            b.writeUInt8(0xff, z);
            adaptationPosition++;
          }
        } // end adaptationField
        if ((x.adaptationFieldControl & 0x01) !== 0) {
          adaptationPosition += x.payload.copy(b,
            (x.adaptationField) ? 5 + x.adaptationField.adaptationFieldLength : 4);
        }
        if (adaptationPosition < b.length)
          console.error(`Warning: TS packet is short. Only written ${adaptationPosition} bytes.`);
        push(null, b);
      } else {
        push(null, x);
      }
      next();
    }
  }
  return H.pipeline(H.consume(makeTSPacket));
}

module.exports = writeTSPacket;
