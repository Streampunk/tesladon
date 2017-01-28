# tesladon

Reactive streams [MPEG transport stream](https://en.wikipedia.org/wiki/MPEG_transport_stream) library for [Node.js](http://nodejs.org/). Uses [Highland](http://highlandjs.org/) to provide a set of mappings from binary transport stream packets to and from JSON objects with Buffer payloads.

The philosophy is to read/consume any stream (file, network, ASI), turn it into JSON objects that represent transport stream packets and then add to the stream additional JSON objects for Program Association Tables, Program Map Tables and PES packets. The user of the stream can then filter out the information that is of interest to them. Each stage can either pass on the packets it has process or filter them out.

The writing process is effectively the reverse. The user creates a stream of JSON objects representing the transport stream and tesladon turns these back into transport stream packets. Utility functions will be added over time to help with multiplexing and inserting a sufficient number of PATs and PMTs at a reasonable frequency.

## Installation

Tesladon is a library that is designed to be used within other projects. To use the library within your project, in the project's root directory:

    npm install --save netadon

## Usage

### Reading

Here is an example of using tesladon to dump a transport stream as a stream JSON objects representing PAT, PMT and PES packets.

```javascript
var tesladon = require('tesladon');
var H = require('highland');
var fs = require('fs');

H(fs.createReadStream(process.argv[2]))
  .pipe(tesladon.bufferGroup(188))
  .pipe(tesladon.readPAT(true))
  .pipe(tesladon.readPMTs(true))
  .pipe(tesladon.readPESPackets(true))
  .filter(x => x.type !== 'TSPacket')
  .each(H.log);
```

The `true` parameter to the read methods requests that the TS packets read to create JSON object are filtered out from the stream.

The `readPMTs()` stage only works after the `readPATs()` stage as it uses the PAT objects to find the _pids_ used for the PMTs.

### Writing

To follow.

## Status, support and further development

Currently only reading is supported. 

This is prototype software and not suitable for production use. Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](http://www.streampunk.media/).

## License

This software is released under the Apache 2.0 license. Copyright 2017 Streampunk Media Ltd.
