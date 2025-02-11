'use strict';

var domain = require('domain');

var eos = require('end-of-stream');
var tick = require('process-nextick-args');
var once = require('once');
var exhaust = require('stream-exhaust');

var eosConfig = {
  error: false,
};

function asyncDone(fn, cb) {
  cb = once(cb);

  var d = domain.create();
  d.once('error', onError);
  var domainBoundFn = d.bind(fn);

  function done() {
    d.removeListener('error', onError);
    d.exit();
    return cb.apply(null, arguments);
  }

  function onSuccess(result) {
    tick(done, null, result);
  }

  function onError(error) {
    if (!error) {
      error = new Error('Promise rejected without Error');
    }
    tick(done, error);
  }

  function asyncRunner() {
    var result = domainBoundFn(done);

    function onNext(state) {
      onNext.state = state;
    }

    function onCompleted() {
      onSuccess(onNext.state);
    }

    if (result && typeof result.on === 'function') {
      // Assume node stream
      d.add(result);
      eos(exhaust(result), eosConfig, done);
      return;
    }

    if (result && typeof result.subscribe === 'function') {
      // Assume RxJS observable
      result.subscribe(onNext, onError, onCompleted);
      return;
    }

    if (result && typeof result.then === 'function') {
      // Assume promise
      result.then(onSuccess, onError);
      return;
    }
  }

  tick(asyncRunner);
}

module.exports = asyncDone;
