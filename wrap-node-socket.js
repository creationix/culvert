var makeChannel = require('./channel');

module.exports = wrapNodeSocket;

// Given a duplex node stream, return a culvert duplex channel.
function wrapNodeSocket(socket, options) {
  // Data traveling from node socket to consumer
  var incoming = makeChannel();
  // Data traveling from consumer to node socket
  var outgoing = makeChannel();

  if (options.encoder) outgoing.put = options.encoder(outgoing.put);
  if (options.decoder) incoming.put = options.decoder(incoming.put);

  var onDrain2 = wrapHandler(onReadable, options.onError);
  onTake = wrapHandler(onTake, options.onError);

  var paused = false;

  outgoing.take(onTake);
  if (options.onError) socket.on("error", options.onError);
  socket.on("drain", wrap(onDrain, options.onError));
  socket.on("readable", wrap(onReadable, options.onError));

  function onTake(data) {
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

  function onReadable() {
    while (true) {
      var chunk = socket.read();
      if (!chunk) return;
      if (!incoming.put(chunk)) {
        incoming.drain(onDrain2);
        return;
      }
    }
  }

  return {
    put: outgoing.put,
    drain: outgoing.drain,
    take: incoming.take,
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