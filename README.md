[![CircleCI](https://circleci.com/gh/Streampunk/tesladon.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/Streampunk/tesladon)
# tesladon

[MPEG transport stream](https://en.wikipedia.org/wiki/MPEG_transport_stream) library for [Node.js](http://nodejs.org/). Uses [Highland](http://highlandjs.org/) reactive streams library to provide a set of mappings from binary transport stream packets to and from Javascript objects with embedded Buffer payloads.

The philosophy is to read/consume any stream (file, network, ASI), turn it into Javascript objects that represent transport stream packets and then add to the stream additional JSON objects for Program Association Tables, Program Map Tables and PES packets. The user of the stream can then filter out the information that is of interest to them. Each stage can either pass on the packets it has processed, or filter them out.

The writing process is effectively the reverse. The user creates a stream of Javascript objects representing the transport stream and tesladon turns these back into transport stream packets. Utility functions will be added over time to help with multiplexing and inserting a sufficient number of PATs and PMTs at a reasonable frequency.

## Installation

Tesladon is a library that is designed to be used within other projects. To use the library within your project, in the project's root directory:

    npm install --save tesladon

Alternatively, you can use tesladon as a transport stream dumper via a global install and the `tesladump` application.

    npm install -g tesladon

Users or Mac or Linux platforms may need to prepend `sudo` to the above.

## Usage

### Reading

Here is an example of using tesladon to dump a transport stream as a stream JSON objects representing PAT, PMT and PES packets.

```javascript
var tesladon = require('tesladon');
var H = require('highland');
var fs = require('fs');

H(fs.createReadStream(process.argv[2]))
  .pipe(tesladon.bufferGroup(188))
  .pipe(tesladon.readTSPackets())
  .pipe(tesladon.readPAT(true))
  .pipe(tesladon.readPMTs(true))
  .pipe(tesladon.readPESPackets(true))
  .filter(x => x.type !== 'TSPacket')
  .each(H.log);
```

The `true` parameter to the read methods requests that the TS packets read to create JSON object are filtered out from the stream.

The `bufferGroup()` and `readTSPackets()` pipeline stages must come first and be in that order. The `readPMTs()` stage only works after the `readPATs()` stage as it uses the PAT objects to find the _pids_ used for the PMTs.

### Writing

To follow. The code is basically done but will not be released to the world until it is roundtrip tested and a basic muxer has been created.

### Dumping a file

Run:

    tesladump <myfile.ts>

Here is an example output:

```Javascript
{ type: 'ProgramMapTable',
  pid: 256,
  pointerField: 0,
  tableID: 2,
  sectionSyntaxHeader: true,
  privateBit: false,
  sectionLength: 23,
  programNum: 1,
  versionNumber: 0,
  currentNextIndicator: true,
  sectionNumber: 0,
  lastSectionNumber: 0,
  pcrPid: 4096,
  programInfoLength: 0,
  payload: <Buffer 00 02 b0 17 00 01 c1 00 00 f0 00 f0 00 1b f0 00 f0 00 0f f0 01 f0 00 c5 f7 eb 39>,
  programInfo: [],
  esStreamInfo:
   { '4096':
     { streamType: 27,
       elementaryPid: 4096,
       esInfoLength: 0,
       esInfo: [] },
     '4097':
     { streamType: 15,
       elementaryPid: 4097,
       esInfoLength: 0,
       esInfo: [] } },
  CRC: 3321359161 }
{ type: 'PESPacket',
  pid: 4096,
  streamID: 224,
  pesPacketLength: 0,
  scramblingControl: 0,
  priority: false,
  dataAlignmentIndicator: true,
  copyright: false,
  originalOrCopy: false,
  ptsDtsIndicator: 3,
  escrFlag: false,
  esRateFlag: false,
  dsmTrickModeFlag: false,
  additionalCopyInfoFlag: false,
  crcFlag: false,
  extensionFlag: false,
  pesHeaderLength: 10,
  pts: 3802644416,
  dts: 3802626416,
  payloads: { number: 67, size: 12201 } }
Finished dumping MPEG transport stream data.
```

### TS time mapped to PTP time

A mapping is defined between MPEG-TS timestamps (PTS and DTS in PES packets) and PTP time for _relative_ time mapping purposes only. The aim is that given any TS timestamp, it is possible to create a PTP timestamp and take this PTP timestamp and get back exactly the same TS timestamp. It is also possible to take a PTP timestamp from co-timed PTP sources and make consistent relative TS timestamp. Care needs to be taken near to the day boundary (Unix epoch, no leap seconds, 2**33 90Hz units per day) as the timestamp will wrap back to zero.

```javascript
var tesladon = require('tesladon');
var pts = 2964452213;

// Convert to PTP timestamp
var ptp = tesladon.tsTimeToPTPTime(pts);
// ptp is [ 1488095940, 845388889 ]

// Convert from PTP timestamp to TS timestamp
var tsts = tesladon.ptpTimeToTsTime(ptp);
// tsts is 2964452213 == pts

// Find out today's TS day ... the number of elapsed TS days since the Unix epoch
tesladon.tsDaysSinceEpoch()
// As of today, that is 15591
```

Note that one of the side effects of this approach is that PTP timestamps generated from arbitrary transport streams will sometimes appear to be slightly in the future.

Transport stream timing references are not intended for use as relative time references within the MPEG reference decoder (see ISO/IEC 13818-1). It is not recommended to use MPEG-TS timing references as time-of-day time references for metadata purposes.

## Status, support and further development

Currently only reading is supported.

This is prototype software and not suitable for production use. Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](http://www.streampunk.media/).

## License

This software is released under the Apache 2.0 license. Copyright 2017 Streampunk Media Ltd.
