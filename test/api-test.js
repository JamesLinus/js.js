var assert = require('assert');
var js = require('../');

var heap = require('heap.js');

describe('js.js API', function() {
  var r;
  beforeEach(function() {
    r = js.create();
  });

  it('should do basic binary expression', function() {
    var fn = r.compile('(1 + 2) + (3 + 4)');
    r.heap.gc();
    assert.equal(fn.call(null, []).cast().value(), 10);
  });

  it('should do string literal', function() {
    var fn = r.compile('"okish"');
    r.heap.gc();
    assert.equal(fn.call(null, []).cast().toString(), 'okish');
  });

  it('should do global fetch', function() {
    var global = r.heap.context.global().cast();
    global.set(r.heap.allocString('ohai'), r.heap.allocString('ok'));

    var fn = r.compile('ohai');
    r.heap.gc();
    var res = fn.call(null, []).cast();
    assert.equal(res.toString(), 'ok');
  });

  it('should do global store', function() {
    var fn = r.compile('ohai = "oook";ohai');
    r.heap.gc();
    var res = fn.call(null, []).cast();
    assert.equal(res.toString(), 'oook');
  });

  it('should do math with globals', function() {
    var fn = r.compile('var a = 1, b = 2, c = 3; (a + c)  + (b + c)');
    r.heap.gc();
    var res = fn.call(null, []).cast();
    assert.equal(res.value(), 9);
  });
});