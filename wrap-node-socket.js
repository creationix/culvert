var makeChannel = require('./channel');

module.exports = wrapNodeSocket;

// Given a duplex node stream, return a culvert duplex channel.
function wrapNodeSocket(socket, reportError) {
  // Data traveling from node socket to consumer
  var incoming = makeChannel();
  // Data traveling from consumer to node socket
  var outgoing = makeChannel();

  var onDrain2 = wrapHandler(onReadable, onError);
  onTake = wrapHandler(onTake, onError);

  var paused = false;
  var ended = false;

  outgoing.take(onTake);
  socket.on("error", onError);
  socket.on("drain", wrap(onDrain, onError));
  socket.on("readable", wrap(onReadable, onError));
  socket.on("end", wrap(onEnd, onError));

  function onError(err) {
    if (err.code === "EPIPE" || err.code === "ECONNRESET") {
      return onEnd();
    }
    if (reportError) return reportError(err);
    console.error(err.stack);
  }

  function onTake(data) {
    if (ended) return;
    // console.log("TAKE", data);
    if (data === undefined) {
      ended = true;
      return socket.end();
    }
    if (socket.write(data)) {
      outgoing.take(onTake);
    }
    else {
      if (!paused) paused = true;
    }
  }

  function onDrain() {
    if (paused) {
      paused = false;
      outgoing.take(onTake);
    }
  }

  function onEnd() {
    if (ended) return;
    ended = true;
    incoming.put(undefined);
  }

  function onReadable() {
    if (ended) return;
    while (true) {
      var chunk = socket.read();
      // console.log("READ", chunk);
      if (!chunk) return;
      if (!incoming.put(chunk)) {
        incoming.drain(onDrain2);
        return;
      }
    }
  }

  var originalOut = outgoing.put;
  var originalInn = incoming.put;

  function setCodecs() {
    var out = originalOut;
    var inn = originalInn;
    for (var i = 0, l = arguments.length; i < l; ++i) {
      var codec = arguments[i];
      if (codec.encoder) out = codec.encoder(out);
      if (codec.decoder) inn = codec.decoder(inn);
    }
    outgoing.put = out;
    incoming.put = inn;
  }

  return {
    put: function (item) {
      return outgoing.put(item);
    },
    drain: outgoing.drain,
    take: incoming.take,
    setCodecs: setCodecs
  };
}

function wrap(fn, onError) {
  if (!onError) return fn;
  return function (value) {
    try {
      return fn(value);
    }
    catch (err) {
      return onError(err);
    }
  };
}

function wrapHandler(fn, onError) {
  if (!onError) {
    return function (err, value) {
      if (err) throw err;
      return fn(value);
    };
  }
  return function (err, value) {
    if (err) return onError(err);
    try {
      return fn(value);
    }
    catch (err) {
      return onError(err);
    }
  };
}