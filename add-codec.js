"use strict";

// codec.encoder transforms data that is put into the channel.
// codec.decoder transforms data that is taken from the channel.
module.exports = function (channel, codec) {
  var buffer = [];
  var put = channel.put;
  if (codec.encoder) put = codec.encoder(put);
  if (codec.decoder) decode = codec.decoder(decode);

  return {
    put: put,
    drain: channel.drain,
    take: take
  };

  function decode(item) {
    buffer.push(item);
    return buffer.length < 2;
  }

  function take(callback) {
    if (!callback) return take;
    if (buffer.length) {
      return callback(null, buffer.shift());
    }
    // TODO: add trampoline so stack doesn't grow with large sync streams.
    channel.take(function (err, item) {
      if (err) return callback(err);
      try {
        decode(item);
      }
      catch (err) {
        return callback(err);
      }
      return take(callback);
    });
  }
};
