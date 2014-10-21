var js = require('../js');
var esprima = require('esprima');
var ssa = require('ssa.js');
var linearscan = require('linearscan');
var phi = require('phi.js');
var jit = require('jit.js');
var ir = require('ssa-ir');

function Compiler(runtime, options) {
  this.runtime = runtime;
  this.heap = this.runtime.heap;
  this.platform = this.runtime.platform;
  this.options = options;
  this.linearscan = linearscan.create({
    registers: this.platform.registers,
    instructions: this.platform.instructions
  });
  this.ctx = null;
}
module.exports = Compiler;

Compiler.prototype.compile = function compile(source) {
  var ast = esprima.parse(source);

  return this.heap.scope(function() {
    var res;

    // Walk up in the functions tree, first compile used and the compile uses
    ssa.construct(ast).slice().reverse().forEach(function(ssa) {
      ssa.blocks = phi.run(ssa.blocks);

      // Do platform-indepedent optimization
      this.optimize(ssa);

      // Do platform-specific optimization
      this.platform.optimize(ssa);

      // Allocate registers
      var blocks = this.linearscan.run(ssa.blocks);

      res = this.generate(blocks, this.linearscan.spillCount());
    }, this);

    return res;
  }, this);
};

Compiler.prototype.optimize = function optimize(ssa) {
};

Compiler.prototype.generate = function generate(blocks, spillCount) {
  this.ctx = new Context(this);
  this.platform.ctx = this.ctx;
  var offsets = [];

  var self = this;
  this.platform.doProc(spillCount, function() {
    blocks.forEach(function(block) {
      self.genBlock(block);
    });
  });

  var fn = this.ctx.render();
  this.ctx = null;
  this.platform.ctx = null;
  return fn;
};

Compiler.prototype.genBlock = function genBlock(block) {
  this.ctx.masm.bind(this.ctx.blockLabel(block.id));

  for (var i = 0; i < block.instructions.length; i++)
    this.platform.genInstruction(block.instructions[i]);

  // TODO(indutny): process successors
};



function Context(compiler) {
  this.compiler = compiler;
  this.heap = this.compiler.heap;

  this.masm = jit.create({
    stubs: this.compiler.platform.stubs,
    helpers: this.compiler.platform.helpers
  });
  this.offsets = [];
  this.blocks = {};
}

Context.prototype.blockLabel = function blockLabel(block) {
  if (!this.blocks[block])
    this.blocks[block] = this.masm.label();

  return this.blocks[block];
};

Context.prototype.render = function render() {
  var info = this.masm.compile();

  // Note: implicitly using scope in .compile()
  var code = this.heap.allocCode(info.buffer, this.offsets);
  var fn = this.heap.allocFunction(code);

  return fn;
};

Context.prototype.addReference = function addReference(offset) {
  this.offsets.push(offset - this.compiler.platform.ptrSize);
};