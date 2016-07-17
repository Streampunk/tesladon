var fs = require('fs');
var H = require('highland');

var ts = H(fs.createReadStream('A_1920x10806.ts'));
var remaining = null;
var prev = -1;
var prevCount = 0;

function bufferGroup (g) {
  var remaining = null;
  var group = function (x) {
    var bufs = [];
    var pointer = 0;
    if (remaining) {
      bufs.push(Buffer.concat([remaining, x.slice(0, g - remaining.length)], 188));
      pointer = g - remaining.length;
    }
    while (pointer < x.length - g) {
      bufs.push (x.slice(pointer, pointer + g));
      pointer += g;
    }
    if (pointer < x.length)
      remaining = x.slice(pointer);
    else remaining = null;
    return H(bufs);
  }
  return H.pipeline(H.flatMap(group))
}

ts.through(bufferGroup(188))
.map(function (x) {
  var header = x.readUInt32BE(0);
  var packet = {
    type : 'TSPacket',
    packetSync : (header & 0xff000000) >> 24,
    transportErrorIndicator : (header & 0x800000) !== 0,
    payloadUnitStartIndicator : (header & 0x400000) !== 0,
    transportPriority : (header & 0x200000) !== 0,
    pid : (header & 0x1fff00) >>> 8,
    scramblingControl : (header & 0xc0) >>> 6,
    adaptationFieldControl : (header & 0x30) >>> 4,
    continuityCounter : (header & 0xf)
  };
  if ((packet.adaptationFieldControl & 0x2) !== 0) {
    var adaptationLength = x.readUInt8(4);
    if (adaptationLength === 0) {
      packet.adaptationField = {
        type : 'AdaptationField',
        adaptationFieldLength : 0
      }
    } else {
      var flags = x.readUInt8(5);
      packet.adaptationField = {
        type : 'AdaptationField',
        adaptationFieldLength : adaptationLength,
        discontinuityIndicator : (flags & 0x80) !== 0,
        randomAccessIndicator : (flags & 0x40) !== 0,
        elementaryStreamPriorityIndicator : (flags & 0x20) !== 0,
        pcrFlag : (flags & 0x01) !== 0,
        opcrFlag : (flags & 0x08) !== 0,
        splicingPointFlag : (flags & 0x04) !== 0,
        transportPrivateDataFlag : (flags & 0x02) !== 0,
        adaptationFieldExtensionFlag : (flags & 0x01) !== 0
      }
    };
    var adaptationPosition = 6;
    if (packet.adaptationField.pcrFlag === true) {
      var pcrBase = x.readUInt32BE(adaptationPosition);
      var pcrExtension = x.readUInt16BE(adaptationPosition + 4);
      pcrBase = pcrBase * 2 + ((pcrExtension & 0x8000) !== 0) ? 1 : 0;
      pcrExtension = pcrExtension & 0x1ff;
      packet.adaptationField.pcr = pcrBase * 300 + pcrExtension;
      adaptationPosition += 6;
    }
    if (packet.adaptationField.opcrFlag === true) {
      var opcrBase = x.readUInt32BE(adaptationPosition);
      var opcrExtension = x.readUInt16BE(adaptationPosition + 4);
      opcrBase = opcrBase * 2 + ((opcrExtension & 0x8000) !== 0) ? 1 : 0;
      opcrExtension = opcrExtension & 0x1ff;
      packet.adaptationField.opcr = opcrBase * 300 + opcrExtension;
      adaptationPosition += 6;
    }
    if (packet.adaptationField.splicingPointFlag === true) {
      packet.adaptationField.spliceCountdown = x.readUInt8(adaptationPosition);
      adaptationPosition++;
    }
    if (packet.adaptationField.transportPrivateDataFlag === true) {
      var transportPrivateDataLength = x.readUInt8(adaptationPosition);
      adaptationPosition++;
      packet.adaptationField.transportPrivateData =
        x.slice(adaptationPosition, adaptationPosition + transportPrivateDataLength);
      adaptationPosition += transportPrivateDataLength;
    }
    if (packet.adaptationField.adaptationFieldExtensionFlag === true) {
      console.log(x, adaptationPosition, packet);
      var adaptExtFlags = x.readUInt8(adaptationPosition + 1);
      packet.adaptationField.adaptationFieldExtension = {
        adaptationExtensionLength : x.readUInt8(adaptationPosition),
        legalTimeWindowFlag : (adaptExtFlags & 0x80) !== 0,
        piecewiseRateFlag : (adaptExtFlags & 0x40) !== 0,
        seamlessSpliceFlag : (adaptExtFlags & 0x20) !== 0
      };
      adaptationPosition += 2;
      if (packet.adaptationField.adaptationFieldExtension.legalTimeWindowFlag === true) {
        var ltw = x.readUInt16BE(adaptationPosition);
        packet.adaptationField.adaptationFieldExtension.legalTimeWindowValidFlag =
          (ltw & 0x8000) !== 0;
        packet.adaptationField.adaptationFieldExtension.legalTimeWindowOffset =
          ltw & 0x7fff;
        adaptationPosition += 2;
      }
      if (packet.adaptationField.adaptationFieldExtension.piecewiseRateFlag === true) {
        var pw = x.readUIntBE(adaptationPosition, 3);
        packet.adaptationField.adaptationFieldExtension.piecewiseRate =
          pw & 0x3fffff;
        adaptationPosition += 3;
      }
      if (packet.adaptationField.adaptationFieldExtension.seamlessSpliceFlag === true) {
        packet.adaptationField.adaptationFieldExtension.spliceType =
          x.readUInt8(adaptationPosition) / 16 | 0;
        var topBits = x.readUInt8(adaptationPosition) & 0x0e * 0x20000000;
        var midBits = x.readUInt16BE(adaptationPosition + 1) & 0xfffe * 0x4000;
        var lowBits = x.readUInt16BE(adaptationPosition + 3) / 2 | 0;
        packet.adaptationField.adaptationFieldExtension.dtsNextAccessUnit =
          topBits + midBits + lowBits;
      }
    }
  }
  if ((packet.adaptationFieldControl & 0x01) !== 0) {
    packet.payload = (packet.adaptationField) ?
        x.slice(5 + packet.adaptationField.adaptationFieldLength) :
        x.slice(4);
  }
  return packet;
})
.flatMap(function (x) {
  if (x.pid === 0) {
    var patOffset = 1 + x.payload.readUInt8(0);
    var tableHeader = x.payload.readUInt16BE(patOffset + 1);
    var pat = {
      type : 'ProgramAssocationTable',
      pointerField : patOffset - 1,
      tableID : x.payload.readUInt8(patOffset),
      sectionSyntaxHeader : (tableHeader & 0X8000) !== 0,
      privateBit : (tableHeader & 0x4000) !== 0,
      sectionLength : tableHeader & 0x3ff,
      transportStreamIdentifier : x.payload.readUInt16BE(patOffset + 3),
      versionNumber : x.payload.readUInt8(patOffset + 5) & 0x3c / 2 | 0,
      currentNextIndicator : (x.payload.readUInt8(patOffset + 5) & 0x01) !== 0,
      sectionNumber : x.payload.readUInt8(patOffset + 6),
      lastSectionNumber : x.payload.readUInt8(patOffset + 7)
    };
    patOffset += 8;
    while (patOffset < pat.sectionLength + 4) {
      var programNum = x.payload.readUInt16BE(patOffset);
      var programMapPID = x.payload.readUInt16BE(patOffset + 2) & 0x1fff;
      if (!pat.table) pat.table = {};
      pat.table[programMapPID] = {
        programNum : programNum,
        programMapPID : programMapPID
      };
      patOffset += 4;
    }
    pat.CRC = x.payload.readUInt32BE(patOffset);
    return H([x, pat])
  } else {
    return H([x]);
  }
})
.each(function (x) { if (x.pid === 4096) console.log(x); });
