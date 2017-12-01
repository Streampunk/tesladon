[![CircleCI](https://circleci.com/gh/Streampunk/tesladon.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/Streampunk/tesladon)
# tesladon

[MPEG transport stream](https://en.wikipedia.org/wiki/MPEG_transport_stream) library for [Node.js](http://nodejs.org/). Uses the [highland](http://highlandjs.org/) reactive streams library to provide a set of mappings between binary transport stream packets to and from Javascript objects with embedded Buffer payloads.

The philosophy is to read/consume any stream (file, network, ASI), turn it into Javascript objects that represent transport stream packets and then add to the stream additional JSON objects for Program Association Tables, Program Map Tables and PES packets. The user of the stream can then filter out the information that is of interest to them. Each stage can either pass on the packets it has processed, or filter them out.

The writing process is effectively the reverse. The user creates a stream of Javascript objects representing the transport stream and tesladon turns these back into transport stream packets. Utility functions will be added over time to help with multiplexing and inserting a sufficient number of PATs and PMTs at a reasonable frequency. Further descriptors will be added as they are encountered.

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

Tesladon can take a stream of Javascript objects representing a mixture of PES streams, PAT tables and PSI tables and convert those to a stream of transport stream packets and write those to a byte stream. The library takes care of conversion of these objects into sections and efficiently sub-dividing payload across the MPEG packets, including length and CRC calculations.

The following contrived example shows how tesladon could be used to write a transport stream to a file:

```javascript
var tesladon = require('tesladon');
var H = require('highland');
var fs = require('fs');

H([ pat, pmt, video_pes1, audio_pes1, video_pes2, audio_pes2 ])
  .through(tesladon.writePESPackets())
  .through(tesladon.writePMTs())
  .through(tesladon.writePAT()) // by here, you have a stream of TS packets only
  .through(tesladon.writeTSPackets()) // TS packets are converted to Buffers
  .pipe(fs.createWriteStream('my_new_stream.ts'));
```

### Dumping a file

Run:

    tesladump [options] <myfile.ts>

The tool is self-documenting. To find out more, run:

    tesladump --help

Here is an example output:

```Javascript
{ type: 'ProgramMapTable',
  pid: 4671,
  tableID: 'TS_program_map_section',
  programNumber: 4671,
  versionNumber: 28,
  currentNextIndicator: 1,
  pcrPid: 620,
  programInfo: [],
  programElements:
   { '620':
      { type: 'ElementaryStreamInfo',
        streamType: 'ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream',
        elementaryPID: 620,
        esInfo:
         [ { type: 'DVBStreamIdentifierDescriptor',
             descriptorTag: 82,
             descriptorLength: 1,
             componentTag: 1 } ] },
     '621':
      { type: 'ElementaryStreamInfo',
        streamType: 'ISO/IEC 11172-3 Audio',
        elementaryPID: 621,
        esInfo:
         [ { type: 'ISO639LanguageDescriptor',
             descriptorTag: 10,
             descriptorLength: 4,
            languages: [ { iso639LanguageCode: 'eng', audioType: 'Undefined' } ] },
          { type: 'DVBStreamIdentifierDescriptor',
            descriptorTag: 82,
            descriptorLength: 1,
            componentTag: 2 } ] } } }
{ type: 'PESPacket',
  pid: 620,
  streamID: 'video_stream_number_0x0',
  pesPacketLength: 0,
  scramblingControl: 0,
  priority: true,
  dataAlignmentIndicator: false,
  copyright: true,
  originalOrCopy: true,
  ptsDtsIndicator: 2,
  escrFlag: false,
  esRateFlag: false,
  dsmTrickModeFlag: false,
  additionalCopyInfoFlag: false,
  crcFlag: false,
  extensionFlag: false,
  pesHeaderLength: 5,
  pts: 4065910999,
  payloads: { number: 30, size: 5506 } }
...
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

Reading and writing are supported but you need to create your own multiplexer when writing a stream.

A number of basic descriptors are provided and a full range of descriptors covering those documented in commonly used MPEG-2, MPEG-4, ATSC and DVB specifications will be added in the future. Note that this library does not yet extract event information tables (EITs).

This is prototype software and not suitable for production use. Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](http://www.streampunk.media/).



## License

This software is released under the Apache 2.0 license. Copyright 2017 Streampunk Media Ltd.
