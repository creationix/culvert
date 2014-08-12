var makeChannel = require('./channel');

module.exports = wrapNodeSocket;

// Given a browser websocket, return a culvert duplex channel.
function wrapNodeSocket(ws, reportError) {
  // Data traveling from websocket to consumer
  var incoming = makeChannel();
  // Data traveling from consumer to websocket
  var outgoing = makeChannel();

  onTake = wrapHandler(onTake, onError);
  outgoing.take(onTake);

  ws.onerror = onError;
  ws.onmessage = wrap(onMessage, onError);
  ws.onclose = wrap(onClose, onError);

  function onError(err) {
    if (reportError) return reportError(err);
    console.error(err.stack);
  }

  function onMessage(evt) {
    if (evt.data instanceof ArrayBuffer) {
      incoming.put(new Uint8Array(evt.data));
    }
  }

  function onClose(evt) {
    incoming.put();
  }

  function onTake(data) {
    // console.log("TAKE", data);
    if (data === undefined) {
      ws.close();
      return;
    }
    ws.send(data);
    outgoing.take(onTake);
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