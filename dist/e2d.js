(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.e2d = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":5,"_process":4,"inherits":2}],7:[function(require,module,exports){
//jshint node: true
'use strict';

module.exports = {
    addColorStop: require('./src/addColorStop'),
    arc: require('./src/arc'),
    arcTo: require('./src/arcTo'),
    beginPath: require('./src/beginPath'),
    bezierCurveTo: require('./src/bezierCurveTo'),
    Canvas: require('./src/Canvas'),
    clearRect: require('./src/clearRect'),
    clip: require('./src/clip'),
    clipPath: require('./src/clipPath'),
    closePath: require('./src/closePath'),
    createLinearGradient: require('./src/createLinearGradient'),
    createRadialGradient: require('./src/createRadialGradient'),
    drawCanvas: require('./src/drawCanvas'),
    drawImage: require('./src/drawImage'),
    ellipse: require('./src/ellipse'),
    fill: require('./src/fill'),
    fillArc: require('./src/fillArc'),
    fillImage: require('./src/fillImage'),
    fillImagePattern: require('./src/fillImagePattern'),
    fillRect: require('./src/fillRect'),
    fillStyle: require('./src/fillStyle'),
    globalAlpha: require('./src/globalAlpha'),
    globalCompositeOperation: require('./src/globalCompositeOperation'),
    Gradient: require('./src/Gradient'),
    hitRect: require('./src/hitRect'),
    hitRegion: require('./src/hitRegion'),
    Img: require('./src/Img'),
    Instruction: require('./src/Instruction'),
    isDataUrl: require('./src/isDataUrl'),
    isWorker: require('./src/isWorker'),
    lineStyle: require('./src/lineStyle'),
    lineTo: require('./src/lineTo'),
    moveTo: require('./src/moveTo'),
    path: require('./src/path'),
    quadraticCurveTo: require('./src/quadraticCurveTo'),
    Renderer: require('./src/Renderer'),
    rotate: require('./src/rotate'),
    scale: require('./src/scale'),
    shadowStyle: require('./src/shadowStyle'),
    stroke: require('./src/stroke'),
    strokeArc: require('./src/strokeArc'),
    strokeRect: require('./src/strokeRect'),
    text: require('./src/text'),
    textStyle: require('./src/textStyle'),
    transform: require('./src/transform'),
    transformPoints: require('./src/transformPoints'),
    translate: require('./src/translate')
};
},{"./src/Canvas":34,"./src/Gradient":35,"./src/Img":36,"./src/Instruction":37,"./src/Renderer":38,"./src/addColorStop":39,"./src/arc":40,"./src/arcTo":41,"./src/beginPath":42,"./src/bezierCurveTo":43,"./src/clearRect":44,"./src/clip":45,"./src/clipPath":46,"./src/closePath":47,"./src/createLinearGradient":48,"./src/createRadialGradient":49,"./src/drawCanvas":50,"./src/drawImage":51,"./src/ellipse":52,"./src/fill":53,"./src/fillArc":54,"./src/fillImage":55,"./src/fillImagePattern":56,"./src/fillRect":57,"./src/fillStyle":58,"./src/globalAlpha":59,"./src/globalCompositeOperation":60,"./src/hitRect":61,"./src/hitRegion":62,"./src/isDataUrl":64,"./src/isWorker":65,"./src/lineStyle":66,"./src/lineTo":67,"./src/moveTo":68,"./src/path":69,"./src/quadraticCurveTo":70,"./src/rotate":71,"./src/scale":72,"./src/shadowStyle":73,"./src/stroke":74,"./src/strokeArc":75,"./src/strokeRect":76,"./src/text":77,"./src/textStyle":78,"./src/transform":79,"./src/transformPoints":80,"./src/translate":81}],8:[function(require,module,exports){
// Source: http://jsfiddle.net/vWx8V/
// http://stackoverflow.com/questions/5603195/full-list-of-javascript-keycodes



/**
 * Conenience method returns corresponding value for given keyName or keyCode.
 *
 * @param {Mixed} keyCode {Number} or keyName {String}
 * @return {Mixed}
 * @api public
 */

exports = module.exports = function(searchInput) {
  // Keyboard Events
  if (searchInput && 'object' === typeof searchInput) {
    var hasKeyCode = searchInput.which || searchInput.keyCode || searchInput.charCode
    if (hasKeyCode) searchInput = hasKeyCode
  }

  // Numbers
  if ('number' === typeof searchInput) return names[searchInput]

  // Everything else (cast to string)
  var search = String(searchInput)

  // check codes
  var foundNamedKey = codes[search.toLowerCase()]
  if (foundNamedKey) return foundNamedKey

  // check aliases
  var foundNamedKey = aliases[search.toLowerCase()]
  if (foundNamedKey) return foundNamedKey

  // weird character?
  if (search.length === 1) return search.charCodeAt(0)

  return undefined
}

/**
 * Get by name
 *
 *   exports.code['enter'] // => 13
 */

var codes = exports.code = exports.codes = {
  'backspace': 8,
  'tab': 9,
  'enter': 13,
  'shift': 16,
  'ctrl': 17,
  'alt': 18,
  'pause/break': 19,
  'caps lock': 20,
  'esc': 27,
  'space': 32,
  'page up': 33,
  'page down': 34,
  'end': 35,
  'home': 36,
  'left': 37,
  'up': 38,
  'right': 39,
  'down': 40,
  'insert': 45,
  'delete': 46,
  'command': 91,
  'right click': 93,
  'numpad *': 106,
  'numpad +': 107,
  'numpad -': 109,
  'numpad .': 110,
  'numpad /': 111,
  'num lock': 144,
  'scroll lock': 145,
  'my computer': 182,
  'my calculator': 183,
  ';': 186,
  '=': 187,
  ',': 188,
  '-': 189,
  '.': 190,
  '/': 191,
  '`': 192,
  '[': 219,
  '\\': 220,
  ']': 221,
  "'": 222,
}

// Helper aliases

var aliases = exports.aliases = {
  'windows': 91,
  '⇧': 16,
  '⌥': 18,
  '⌃': 17,
  '⌘': 91,
  'ctl': 17,
  'control': 17,
  'option': 18,
  'pause': 19,
  'break': 19,
  'caps': 20,
  'return': 13,
  'escape': 27,
  'spc': 32,
  'pgup': 33,
  'pgdn': 33,
  'ins': 45,
  'del': 46,
  'cmd': 91
}


/*!
 * Programatically add the following
 */

// lower case chars
for (i = 97; i < 123; i++) codes[String.fromCharCode(i)] = i - 32

// numbers
for (var i = 48; i < 58; i++) codes[i - 48] = i

// function keys
for (i = 1; i < 13; i++) codes['f'+i] = i + 111

// numpad keys
for (i = 0; i < 10; i++) codes['numpad '+i] = i + 96

/**
 * Get by code
 *
 *   exports.name[13] // => 'Enter'
 */

var names = exports.names = exports.title = {} // title for backward compat

// Create reverse mapping
for (i in codes) names[codes[i]] = i

// Add aliases
for (var alias in aliases) {
  codes[alias] = aliases[alias]
}

},{}],9:[function(require,module,exports){
var baseFlatten = require('../internal/baseFlatten'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Flattens a nested array. If `isDeep` is `true` the array is recursively
 * flattened, otherwise it is only flattened a single level.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
 * @returns {Array} Returns the new flattened array.
 * @example
 *
 * _.flatten([1, [2, 3, [4]]]);
 * // => [1, 2, 3, [4]]
 *
 * // using `isDeep`
 * _.flatten([1, [2, 3, [4]]], true);
 * // => [1, 2, 3, 4]
 */
function flatten(array, isDeep, guard) {
  var length = array ? array.length : 0;
  if (guard && isIterateeCall(array, isDeep, guard)) {
    isDeep = false;
  }
  return length ? baseFlatten(array, isDeep) : [];
}

module.exports = flatten;

},{"../internal/baseFlatten":11,"../internal/isIterateeCall":20}],10:[function(require,module,exports){
/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;

},{}],11:[function(require,module,exports){
var arrayPush = require('./arrayPush'),
    isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isArrayLike = require('./isArrayLike'),
    isObjectLike = require('./isObjectLike');

/**
 * The base implementation of `_.flatten` with added support for restricting
 * flattening and specifying the start index.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, isDeep, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (isObjectLike(value) && isArrayLike(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (isDeep) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, isDeep, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

module.exports = baseFlatten;

},{"../lang/isArguments":24,"../lang/isArray":25,"./arrayPush":10,"./isArrayLike":18,"./isObjectLike":22}],12:[function(require,module,exports){
var createBaseFor = require('./createBaseFor');

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

module.exports = baseFor;

},{"./createBaseFor":15}],13:[function(require,module,exports){
var baseFor = require('./baseFor'),
    keysIn = require('../object/keysIn');

/**
 * The base implementation of `_.forIn` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForIn(object, iteratee) {
  return baseFor(object, iteratee, keysIn);
}

module.exports = baseForIn;

},{"../object/keysIn":31,"./baseFor":12}],14:[function(require,module,exports){
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;

},{}],15:[function(require,module,exports){
var toObject = require('./toObject');

/**
 * Creates a base function for `_.forIn` or `_.forInRight`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var iterable = toObject(object),
        props = keysFunc(object),
        length = props.length,
        index = fromRight ? length : -1;

    while ((fromRight ? index-- : ++index < length)) {
      var key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

module.exports = createBaseFor;

},{"./toObject":23}],16:[function(require,module,exports){
var baseProperty = require('./baseProperty');

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

module.exports = getLength;

},{"./baseProperty":14}],17:[function(require,module,exports){
var isNative = require('../lang/isNative');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

module.exports = getNative;

},{"../lang/isNative":28}],18:[function(require,module,exports){
var getLength = require('./getLength'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

module.exports = isArrayLike;

},{"./getLength":16,"./isLength":21}],19:[function(require,module,exports){
/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

module.exports = isIndex;

},{}],20:[function(require,module,exports){
var isArrayLike = require('./isArrayLike'),
    isIndex = require('./isIndex'),
    isObject = require('../lang/isObject');

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    var other = object[index];
    return value === value ? (value === other) : (other !== other);
  }
  return false;
}

module.exports = isIterateeCall;

},{"../lang/isObject":29,"./isArrayLike":18,"./isIndex":19}],21:[function(require,module,exports){
/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],22:[function(require,module,exports){
/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],23:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * Converts `value` to an object if it's not one.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {Object} Returns the object.
 */
function toObject(value) {
  return isObject(value) ? value : Object(value);
}

module.exports = toObject;

},{"../lang/isObject":29}],24:[function(require,module,exports){
var isArrayLike = require('../internal/isArrayLike'),
    isObjectLike = require('../internal/isObjectLike');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Native method references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is classified as an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  return isObjectLike(value) && isArrayLike(value) &&
    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
}

module.exports = isArguments;

},{"../internal/isArrayLike":18,"../internal/isObjectLike":22}],25:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var arrayTag = '[object Array]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

module.exports = isArray;

},{"../internal/getNative":17,"../internal/isLength":21,"../internal/isObjectLike":22}],26:[function(require,module,exports){
var isObjectLike = require('../internal/isObjectLike'),
    isPlainObject = require('./isPlainObject');

/**
 * Checks if `value` is a DOM element.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
 * @example
 *
 * _.isElement(document.body);
 * // => true
 *
 * _.isElement('<body>');
 * // => false
 */
function isElement(value) {
  return !!value && value.nodeType === 1 && isObjectLike(value) && !isPlainObject(value);
}

module.exports = isElement;

},{"../internal/isObjectLike":22,"./isPlainObject":30}],27:[function(require,module,exports){
var isObject = require('./isObject');

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

module.exports = isFunction;

},{"./isObject":29}],28:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isObjectLike = require('../internal/isObjectLike');

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isNative;

},{"../internal/isObjectLike":22,"./isFunction":27}],29:[function(require,module,exports){
/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],30:[function(require,module,exports){
var baseForIn = require('../internal/baseForIn'),
    isArguments = require('./isArguments'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * **Note:** This method assumes objects created by the `Object` constructor
 * have no inherited enumerable properties.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  var Ctor;

  // Exit early for non `Object` objects.
  if (!(isObjectLike(value) && objToString.call(value) == objectTag && !isArguments(value)) ||
      (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
    return false;
  }
  // IE < 9 iterates inherited properties before own properties. If the first
  // iterated property is an object's own property then there are no inherited
  // enumerable properties.
  var result;
  // In most environments an object's own properties are iterated before
  // its inherited properties. If the last iterated property is an object's
  // own property then there are no inherited enumerable properties.
  baseForIn(value, function(subValue, key) {
    result = key;
  });
  return result === undefined || hasOwnProperty.call(value, result);
}

module.exports = isPlainObject;

},{"../internal/baseForIn":13,"../internal/isObjectLike":22,"./isArguments":24}],31:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('../internal/isIndex'),
    isLength = require('../internal/isLength'),
    isObject = require('../lang/isObject');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"../internal/isIndex":19,"../internal/isLength":21,"../lang/isArguments":24,"../lang/isArray":25,"../lang/isObject":29}],32:[function(require,module,exports){
module.exports = function (point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point[0], y = point[1];
    
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
};

},{}],33:[function(require,module,exports){
/*

index.js - square matrix multiply

The MIT License (MIT)

Copyright (c) 2013 Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/

"use strict";

var squareMatrixMultiply = module.exports = function squareMatrixMultiply (A, B, algorithm) {
    switch (algorithm && algorithm.toLowerCase()) {
        case 'strassen': 
            return strassen(A, B);
        case 'naive':
        default:
            return naive(A, B);
    }
};

var naive = function naive (A, B) {
    var n = A.length;
    var C = [];
    for (var e = 0; e < n; e++) {
        C.push([]);
    }
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
            C[i][j] = 0;
            for (var k = 0; k < n; k++) {
                C[i][j] = C[i][j] + (A[i][k] * B[k][j]);
            }
        }
    }
    return C;
};

var strassen = function strassen (A, B) {
    var n = A.length;
    var C = [];
    for (var e = 0; e < n; e++) {
        C.push([]);
    }
    if (n == 1) {
        C[0][0] = A[0][0] * B[0][0];
    } else {
        var halfOfN = n / 2;

        // matrix partitions initialization
        var A11 = [], A12 = [], A21 = [], A22 = [];
        var B11 = [], B12 = [], B21 = [], B22 = [];
        for (e = 0; e < halfOfN; e++) {
            A11.push([]);
            A12.push([]);
            A21.push([]);
            A22.push([]);
            B11.push([]);
            B12.push([]);
            B21.push([]);
            B22.push([]);
        }
        var row, column;
        for (row = 0; row < halfOfN; row++) {
            for (column = 0; column < halfOfN; column++) {
                A11[row][column] = A[row][column];
                B11[row][column] = B[row][column];
            }
            for (column = halfOfN; column < n; column++) {
                A12[row][column - halfOfN] = A[row][column];
                B12[row][column - halfOfN] = B[row][column];
            }
        }
        for (row = halfOfN; row < n; row++) {
            for (column = 0; column < halfOfN; column++) {
                A21[row - halfOfN][column] = A[row][column];
                B21[row - halfOfN][column] = B[row][column];
            }
            for (column = halfOfN; column < n; column++) {
                A22[row - halfOfN][column - halfOfN] = A[row][column];
                B22[row - halfOfN][column - halfOfN] = B[row][column];
            }
        }

        // strassen matrices
        var S1 = [], S2 = [], S3 = [], S4 = [], S5 = [], S6 = [], S7 = [],
            S8 = [], S9 = [], S10 = [];
        for (e = 0; e < halfOfN; e++) {
            S1.push([]);
            S2.push([]);
            S3.push([]);
            S4.push([]);
            S5.push([]);
            S6.push([]);
            S7.push([]);
            S8.push([]);
            S9.push([]);
            S10.push([]);
        }

        for (row = 0; row < halfOfN; row++) {
            for (column = 0; column < halfOfN; column++) {
                S1[row][column] = B12[row][column] - B22[row][column];
                S2[row][column] = A11[row][column] + A12[row][column];
                S3[row][column] = A21[row][column] + A22[row][column];
                S4[row][column] = B21[row][column] - B11[row][column];
                S5[row][column] = A11[row][column] + A22[row][column];
                S6[row][column] = B11[row][column] + B22[row][column];
                S7[row][column] = A12[row][column] - A22[row][column];
                S8[row][column] = B21[row][column] + B22[row][column];
                S9[row][column] = A11[row][column] - A21[row][column];
                S10[row][column] = B11[row][column] + B12[row][column];
            }
        }

        // actual computations
        var P1 = strassen(A11, S1);
        var P2 = strassen(S2, B22);
        var P3 = strassen(S3, B11);
        var P4 = strassen(A22, S4);
        var P5 = strassen(S5, S6);
        var P6 = strassen(S7, S8);
        var P7 = strassen(S9, S10);

        // assemble computations in original matrix
        for (row = 0; row < halfOfN; row++) {
            for (column = 0; column < halfOfN; column++) {
                C[row][column]                     = P5[row][column] + P4[row][column] - P2[row][column] + P6[row][column];
                C[row][column + halfOfN]           = P1[row][column] + P2[row][column];
                C[row + halfOfN][column]           = P3[row][column] + P4[row][column];
                C[row + halfOfN][column + halfOfN] = P5[row][column] + P1[row][column] - P3[row][column] - P7[row][column];
            }
        }
    }
    return C;
};
},{}],34:[function(require,module,exports){
//jshint worker: true, browser: true, node: true
'use strict';

var isWorker = require('./isWorker'),
    Img = require('./Img'),
    flatten = require('lodash/array/flatten'),
    newid = require('./id');

function Canvas(width, height, id) {
  this.id = id || newid();
  var Renderer = require('./Renderer');
  if (!isWorker) {
    this.renderer = new Renderer(width, height, document.createElement('div'));
  } else {
    this.renderer = null;
  }
  this.width = width;
  this.height = height;
  Object.seal(this);
}

Canvas.prototype.render = function render(children) {
  var result = [];
  for (var i = 0; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result = flatten(result);
  if (isWorker) {
    postMessage({ type: 'canvas', value: { id: this.id, width: this.width, height: this.height, children: result } });
  } else {
    this.renderer.render(result);
  }
};

Canvas.prototype.toImage = function toImage(imageID) {
  
  var img;
  img = new Img(imageID || newid());
  
  if (isWorker) {
    postMessage({ type: 'canvas-image', value: { id: this.id, imageID: imageID } });
    return img;
  } else {
    img.src = this.renderer.canvas.toDataURL('image/png');
    return img;
  }
};

Canvas.prototype.dispose = function dispose() {
  if (isWorker) {
    return postMessage({ type: 'canvas-dispose', value: { id: this.id }});
  } else {
    Canvas.cache[this.id] = null;
    var index = Canvas.cachable.indexOf(this.id);
    if (index > -1) {
      Canvas.cachable.splice(index, 1);
    }
  }
};

Canvas.prototype.cache = function cache() {
  if (isWorker) {
    return postMessage({ type: 'canvas-cache', value: { id: this.id }});
  } else {
    var index = Canvas.cachable.indexOf(this.id);
    if (index === -1) {
      Canvas.cachable.push(this.id);
    }
  }
  return this;
};

Canvas.cleanUp = function cleanUp() {
  var index = {},
      key;
  for(var i = 0; i < Canvas.cachable.length; i++) {
    key = Canvas.cachable[i];
    index[key] = Canvas.cache[key];
  }
  
  Canvas.cache = index;
};

Canvas.prototype.resize = function (width, height) {
  return this.renderer.resize(width, height);
};

Canvas.cache = {};
Canvas.cachable = [];

Canvas.create = function (width, height, id) {
  return new Canvas(width, height, id);
};

Object.seal(Canvas);
Object.seal(Canvas.prototype);
module.exports = Canvas;

},{"./Img":36,"./Renderer":38,"./id":63,"./isWorker":65,"lodash/array/flatten":9}],35:[function(require,module,exports){
//jshint node: true, browser: true, worker: true
'use strict';
var isWorker = require('./isWorker');

function Gradient(id, grd) {
  this.id = id;
  this.grd = grd;
  Gradient.cache[id] = this;
  Object.seal(this);
}

Gradient.cache = {};
Gradient.cachable = [];
Gradient.prototype.cache = function cache() {
  if (isWorker) {
    postMessage({ type: 'gradient-cache', value: { id: this.id }});
  } else {
    Gradient.cachable.push(this.id);
  }
  return this;
};

Gradient.prototype.dispose = function dispose() {
  if(isWorker) {
    return postMessage({ type: 'gradient-dispose', value: { id: this.id } });
  } else {
    Gradient.cache[this.id] = null;
    var index = Gradient.cachable.indexOf(this.id);
    if (index !== -1) {
      Gradient.cachable.splice(index, 1);
    }
  }
};

Gradient.cleanUp = function cleanUp() {
  var index = {},
      key;
  for(var i = 0; i < Gradient.cachable.length; i++) {
    key = Gradient.cachable[i];
    index[key] = Gradient.cache[key];
  }
  
  Gradient.cache = index;
};

Object.seal(Gradient);
Object.seal(Gradient.prototype);

module.exports = Gradient;
},{"./isWorker":65}],36:[function(require,module,exports){
//jshint node: true, browser: true, worker: true
'use strict';

var path = require('path'),
    isWorker = require('./isWorker'),
    isDataUrl = require('./isDataUrl'),
    events = require('events'),
    util = require('util'),
    newid = require('./id');

util.inherits(Img, events.EventEmitter);

function Img(id) {
  events.EventEmitter.call(this);
  this._src = "";
  this.isDataUrl = false;
  this.id = id || newid();
  this.buffer = new ArrayBuffer();
  this.onload = function() {};
  this.texture = null;
  this.type = 'image';
  this.blobOptions = {};
  this.imageElement = null;
  this.imagePattern = null;
  this.imagePatternRepeat = null;
  if (isWorker) {
    postMessage({ type: 'image', value: { id: this.id, src: '' } });
  }
  Object.seal(this);
}
Img.cache = {};
Img.cachable = [];
Object.defineProperty(Img.prototype, 'src', {
  set: function(val) {
    this.isDataUrl = isDataUrl(val);
    if (isWorker) {
      Img.cache[this.id] = this;
      postMessage({ type: 'image-source', value: { id: this.id, src: val } });
      return;
    }
    var element = new Image();
    this.imageElement = element;
    element.src = val;
    element.onload = this.imageLoad.bind(this);
  },
  get: function() {
    return this._src;
  }
});

Img.prototype.imageLoad = function imageLoad() {
  if (!isWorker) {
    var ctx = document.createElement('canvas').getContext('2d');
    this.imagePattern = ctx.createPattern(this.imageElement, 'no-repeat');
    this.imagePatternRepeat = ctx.createPattern(this.imageElement, 'repeat');
  }
  Img.cache[this.id] = this;
  return this.emit('load', this);
};

Img.prototype.cache = function dispose() {
  if (isWorker) {
    postMessage({ type: 'image-cache', value: { id: this.id }});
  } else {
    Img.cachable.push(this.id);
  }
  return this;
};

Img.prototype.dispose = function dispose() {
  if (isWorker) {
    return postMessage({ type: 'image-dispose', value: { id: this.id }});
  } else {
    Img.cache[this.id] = null;
    var index = Img.cachable.indexOf(this.id);
    if (index !== -1) {
      Img.cachable.splice(index, 1);
    }
  }
};

Img.cleanUp = function cleanUp() {
  var index = {},
      key;
  for(var i = 0; i < Img.cachable.length; i++) {
    key = Img.cachable[i];
    index[key] = Img.cache[key];
  }
  
  Img.cache = index;
};

Object.seal(Img);
Object.seal(Img.prototype);

module.exports = Img;
},{"./id":63,"./isDataUrl":64,"./isWorker":65,"events":1,"path":3,"util":6}],37:[function(require,module,exports){
//jshint node: true
'use strict';
function Instruction(type, props) {
  this.type = type;
  this.props = props;
  Object.seal(this);
}

Object.seal(Instruction);
Object.seal(Instruction.prototype);

module.exports = Instruction;
},{}],38:[function(require,module,exports){
//jshint node: true
//jshint browser: true
//jshint worker: true

'use strict';
var flatten = require('lodash/array/flatten'),
    isElement = require('lodash/lang/isElement'),
    Canvas = null,
    Gradient = null,
    isWorker = require('./isWorker'),
    createLinearGradient = require('./createLinearGradient'),
    createRadialGradient = require('./createRadialGradient'),
    events = require('events'),
    util = require('util'),
    Img = require('./Img'),
    keycode = require('keycode'),
    smm = require('square-matrix-multiply'),
    transformPoints = require('./transformPoints'),
    pointInPolygon = require('point-in-polygon'),
    pi2 = Math.PI * 2,
    identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

util.inherits(Renderer, events.EventEmitter);

function Renderer(width, height, parent, worker) {
  //this needs to be done later because of cyclical dependencies
  events.EventEmitter.call(this);
  
  if (!Canvas) {
    Canvas = require('./Canvas');
  }
  if (!Gradient) {
    Gradient = require('./Gradient');
  }
  if (!Img) {
    Gradient = require('./Gradient');
  }

  
  this.tree = null;
  this.isReady = false;
  this.mouseState = 'up';
  this.mouseData = {
    x: 0,
    y: 0,
    state: this.mouseState,
    activeRegions: []
  };
  this.mouseRegions = [];
  this.activeRegions = [];
  this.styleQueue = [];
  
  //this is the basic structure of the data sent to the web worker
  this.keyData = {};
  
  if (isWorker) {
    this.worker = null;
    this.canvas =  null;
    this.ctx = null;
    this.parent = null;
    addEventListener('message', this.browserCommand.bind(this));
    Object.seal(this);
    //nothing else to do
    return;
  }
  

  //create the web worker and hook the workerCommand function
  if (worker) {
    this.worker = worker instanceof Worker ? worker : new Worker(worker);
    this.worker.onmessage = this.workerCommand.bind(this);
  } else {
    this.worker = null;
  }
  
  //set parent
  if (!parent || !isElement(parent)) {
    this.parent = document.createElement('div');
    this.parent.style.margin = '0 auto';
    this.parent.style.width = width + 'px';
    this.parent.style.height = height + 'px';
    document.body.appendChild(this.parent);
  } else {
    this.parent = parent;
  }
  
  //set width and height automatically
  if (!width || width <= 0) {
    width = window.innerWidth;
  }
  
  if (!height || height <= 0) {
    height = window.innerHeight;
  }
  
  this.canvas = document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d');
  
  this.canvas.width = width;
  this.canvas.height = height;
  this.parent.appendChild(this.canvas);
  
  //hook mouse and keyboard events right away
  this.hookMouseEvents();
  this.hookKeyboardEvents();
  
  Object.seal(this);
}

Renderer.prototype.render = function render(args) {
  var i,
      len,
      child,
      props,
      type,
      cache,
      matrix,
      sinr,
      cosr,
      fillStyleStack = [],
      lineStyleStack = [],
      textStyleStack = [],
      shadowStyleStack = [],
      globalAlphaStack = [],
      transformStack = [identity],
      globalCompositeOperationStack = [],
      ctx = this.ctx,
      children = [];
  
  for (i = 0, len = arguments.length; i < len; i++) {
    children.push(arguments[i]);
  }
  children = flatten(children, true);
  
  if (isWorker) {
    return this.sendBrowser('render', children);
  }
  
  this.mouseRegions = [];
  this.activeRegions = [];
  
  for(i = 0, len = children.length; i < len; i++) {
    child = children[i];
    if (!child) {
      continue;
    }
    props = child.props;
    type = child.type;
    
    if (type === 'transform') {
      matrix = smm(transformStack[transformStack.length - 1], [
        [props.a, props.c, props.e],
        [props.b, props.d, props.f],
        [0,       0,       1      ]
      ]);
      cache = {
        a: matrix[0][0],
        b: matrix[1][0],
        c: matrix[0][1],
        d: matrix[1][1],
        e: matrix[0][2],
        f: matrix[1][2]
      };
      transformStack.push(matrix);
      ctx.save();
      ctx.transform(props.a, props.b, props.c, props.d, props.e, props.f);
      continue;
    }
    
    if (type === 'scale') {
      matrix = smm(transformStack[transformStack.length - 1], [
        [props.x, 0,       0],
        [0,       props.y, 0],
        [0,       0,       1]
      ]);
      cache = {
        a: matrix[0][0],
        b: matrix[1][0],
        c: matrix[0][1],
        d: matrix[1][1],
        e: matrix[0][2],
        f: matrix[1][2]
      };
      transformStack.push(matrix);
      ctx.save();
      ctx.scale(props.x, props.y);
      continue;
    }
    
    if (type === 'translate') {
      matrix = smm(transformStack[transformStack.length - 1], [
        [1, 0, props.x],
        [0, 1, props.y],
        [0, 0, 1            ]
      ]);
      cache = {
        a: matrix[0][0],
        b: matrix[1][0],
        c: matrix[0][1],
        d: matrix[1][1],
        e: matrix[0][2],
        f: matrix[1][2]
      };
      transformStack.push(matrix);
      ctx.save();
      ctx.translate(props.x, props.y);
      continue;
    }
    
    if (type === 'rotate') {
      cosr = Math.cos(props.r);
      sinr = Math.cos(props.r);
      
      matrix = smm(transformStack[transformStack.length - 1], [
        [cosr, -sinr, 0],
        [sinr, cosr,  0],
        [0,    0,     1]
      ]);
      cache = {
        a: matrix[0][0],
        b: matrix[1][0],
        c: matrix[0][1],
        d: matrix[1][1],
        e: matrix[0][2],
        f: matrix[1][2]
      };
      transformStack.push(matrix);
      ctx.save();
      ctx.rotate(props.r);
      continue;
    }
    
    if (type === 'restore') {
      transformStack.pop();
      ctx.restore();
      continue;
    }
    
    if (type === 'fillRect') {
      ctx.fillRect(props.x, props.y, props.width, props.height);
      continue;
    }
    
    if (type === 'strokeRect') {
      ctx.strokeRect(props.x, props.y, props.width, props.height);
      continue;
    }
    
    if (type === 'clearRect') {
      ctx.clearRect(props.x, props.y, props.width, props.height);
      continue;
    }
    
    if (type === 'fillStyle') {
      fillStyleStack.push(ctx.fillStyle);
      ctx.fillStyle = props.value;
      continue;
    }
    
    if (type == 'fillGradient') {
      fillStyleStack.push(ctx.fillStyle);
      if (Gradient.cache.hasOwnProperty(props.value.id)) {
        ctx.fillStyle = Gradient.cache[props.value.id].grd;
      }
      continue;
    }
    
    if (type === 'endFillStyle') {
      ctx.fillStyle = fillStyleStack.pop();
      continue;
    }
    
    if (type === 'lineStyle') {
      lineStyleStack.push({
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        lineCap: ctx.lineCap,
        lineJoin: ctx.lineJoin,
        miterLimit: ctx.miterLimit,
        lineDash: ctx.getLineDash(),
        lineDashOffset: ctx.lineDashOffset
      });
      if (props.strokeStyle !== null) {
        ctx.strokeStyle = props.strokeStyle;
      }
      if (props.lineWidth !== null) {
        ctx.lineWidth = props.lineWidth;
      }
      if (props.lineCap !== null) {
        ctx.lineCap = props.lineCap;
      }
      if (props.lineJoin !== null) {
        ctx.lineJoin = props.lineJoin;
      }
      if (props.miterLimit !== null) {
        ctx.miterLimit = props.miterLimit;
      }
      if (props.lineDash.length > 0) {
        ctx.setLineDash(props.lineDash);
      }
      if (props.lineDashOffset !== null) {
        ctx.lineDashOffset = props.lineDashOffset;
      }
      continue;
    }
    
    if (type === 'endLineStyle') {
      cache = lineStyleStack.pop();
      ctx.strokeStyle = cache.strokeStyle;
      ctx.lineWidth = cache.lineWidth;
      ctx.lineCap = cache.lineCap;
      ctx.lineJoin = cache.lineJoin;
      ctx.miterLimit = cache.miterLimit;
      ctx.setLineDash(cache.lineDash);
      ctx.lineDashOffset = cache.lineDashOffset;
      continue;
    }

    if (type === 'textStyle') {
      textStyleStack.push({
        font: ctx.font,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
        direction: ctx.direction
      });
      if (props.font !== null) {
        ctx.font = props.font;
      }
      if (props.textAlign !== null) {
        ctx.textAlign = props.textAlign;
      }
      if (props.textBaseline !== null) {
        ctx.textBaseline = props.textBaseline;
      }
      if (props.lineJoin !== null) {
        ctx.direction = props.direction;
      }
      continue;
    }
    
    if (type === 'endTextStyle') {
      cache = textStyleStack.pop();
      ctx.font = cache.font;
      ctx.textAlign = cache.textAlign;
      ctx.textBaseline = cache.textBaseline;
      ctx.direction = cache.direction;
      continue;
    }
    
    if (type === 'shadowStyle') {
      shadowStyleStack.push({
        shadowBlur: ctx.shadowBlur,
        shadowColor: ctx.shadowColor,
        shadowOffsetX: ctx.shadowOffsetX,
        shadowOffsetY: ctx.shadowOffsetY
      });
      if (props.shadowBlur !== null) {
        ctx.shadowBlur = props.shadowBlur;
      }
      if (props.shadowColor !== null) {
        ctx.shadowColor = props.shadowColor;
      }
      if (props.shadowOffsetX !== null) {
        ctx.shadowOffsetX = props.shadowOffsetX;
      }
      if (props.shadowOffsetY !== null) {
        ctx.shadowOffsetY = props.shadowOffsetY;
      }
      continue;
    }
    
    if (type === 'endShadowStyle') {
      cache = shadowStyleStack.pop();
      ctx.shadowBlur = cache.shadowBlur;
      ctx.shadowColor = cache.shadowColor;
      ctx.shadowOffsetX = cache.shadowOffsetX;
      ctx.shadowOffsetY = cache.shadowOffsetY;
      continue;
    }
    
    if (type === 'text') {
      if (props.maxWidth !== 0) {
        if (props.fill) {
          ctx.fillText(props.text, props.x, props.y, props.maxWidth);
        }
        if (props.stroke) {
          ctx.strokeText(props.text, props.x, props.y, props.maxWidth);
        }
        continue;
      }
      if (props.fill) {
        ctx.fillText(props.text, props.x, props.y);
      }
      if (props.stroke) {
        ctx.strokeText(props.text, props.x, props.y);
      }
      continue;
    }
    
    if (type === 'drawImage') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Img.cache[props.img].imageElement || new Image(), props.dx, props.dy);
      continue;
    }

    if (type === 'drawImageSize') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Img.cache[props.img].imageElement || new Image(), props.dx, props.dy, props.dWidth, props.dHeight);
      continue;
    }

    if (type === 'drawImageSource') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Img.cache[props.img].imageElement || new Image(), props.sx, props.sy, props.sWidth, props.sHeight, props.dx, props.dy, props.dWidth, props.dHeight);
      continue;
    }
    
    if (type === 'fillImagePattern') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      
      ctx.fillStyle = Img.cache[props.img].imagePatternRepeat;
      ctx.translate(props.dx, props.dy);
      ctx.fillRect(0, 0, props.dWidth, props.dHeight);
      ctx.restore();
    }
    
    if (type === 'fillImage') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }

      cache = Img.cache[props.img].imageElement;
      ctx.save();
      ctx.fillStyle = Img.cache[props.img].imagePattern;
      ctx.translate(props.dx, props.dy);
      ctx.fillRect(0, 0, cache.width, cache.height);
      ctx.restore();
      
      continue;
    }

    if (type === 'fillImageSize') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      
      cache = Img.cache[props.img].imageElement;
      ctx.save();
      ctx.fillStyle = Img.cache[props.img].imagePattern;
      ctx.translate(props.dx, props.dy);
      ctx.scale(props.dWidth / cache.width, props.dHeight / cache.height);
      ctx.fillRect(0, 0, cache.width, cache.height);
      ctx.restore();
      
      continue;
    }

    if (type === 'fillImageSource') {
      if (!Img.cache.hasOwnProperty(props.img)) {
        continue;
      }
      
      cache = Img.cache[props.img].imageElement;
      ctx.save();
      ctx.fillStyle = Img.cache[props.img].imagePattern;
      ctx.translate(props.dx, props.dy);
      ctx.scale(cache.dWidth / props.sWidth, cache.dHeight / props.sHeight);
      ctx.translate(-props.sx, -props.sy);
      ctx.fillRect(props.sx, props.sy, props.sWidth, props.sHeight);
      ctx.restore();
      
      continue;
    }
    
    if (type === 'drawCanvas') {
      if (!Canvas.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Canvas.cache[props.img].renderer.canvas, props.dx, props.dy);
      continue;
    }

    if (type === 'drawCanvasSize') {
      if (!Canvas.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Canvas.cache[props.img].renderer.canvas, props.dx, props.dy, props.dWidth, props.dHeight);
      continue;
    }

    if (type === 'drawCanvasSource') {
      if (!Canvas.cache.hasOwnProperty(props.img)) {
        continue;
      }
      ctx.drawImage(Canvas.cache[props.img].renderer.canvas, props.sx, props.sy, props.sWidth, props.sHeight, props.dx, props.dy, props.dWidth, props.dHeight);
      continue;
    }
    
    if (type === 'strokeArc') {
      ctx.beginPath();
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle);
      ctx.closePath();
      ctx.stroke();
      continue;
    }
    
    if (type === 'strokeArc-counterclockwise') {
      ctx.beginPath();
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle, true);
      ctx.closePath();
      ctx.stroke();
      continue;
    }
    
    
    if (type === 'fillArc') {
      ctx.beginPath();
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    
    if (type === 'fillArc-counterclockwise') {
      ctx.beginPath();
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    
    if (type === 'moveTo') {
      ctx.moveTo(props.x, props.y);
      continue;
    }
    
    if (type === 'lineTo') {
      ctx.lineTo(props.x, props.y);
      continue;
    }
    
    if (type === 'bezierCurveTo') {
      ctx.bezierCurveTo(props.cp1x, props.cp1y, props.cp2x, props.cp2y, props.x, props.y);
      continue;
    }
    
    if (type === 'quadraticCurveTo') {
      ctx.quadraticCurveTo(props.cpx, props.cpy, props.x, props.y);
      continue;
    }
    
    if (type === 'anticlockwise-arc') {
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle, true);
      continue;
    }
    
    if (type === 'arc') {
      ctx.arc(props.x, props.y, props.r, props.startAngle, props.endAngle);
      continue;
    }
    
    if (type === 'full-arc') {
      ctx.arc(props.x, props.y, props.r, 0, pi2);
      continue;
    }
    
    if (type === 'quick-arc') {
      ctx.arc(0, 0, props.r, 0, pi2);
      continue;
    }
    
    if (type === 'arcTo') {
      ctx.arcTo(props.x1, props.y1, props.x2, props.y2, props.r);
      continue;
    }
    
    if (type === 'anticlockwise-ellipse') {
      this.save();
      this.translate(props.x, props.y);
      this.rotate(props.rotation);
      this.scale(props.radiusX, props.radiusY);
      this.arc(0, 0, 1, props.startAngle, props.endAngle, true);
      this.restore();
      continue;
    }

    if (type === 'ellipse') {
      this.save();
      this.translate(props.x, props.y);
      this.rotate(props.rotation);
      this.scale(props.radiusX, props.radiusY);
      this.arc(0, 0, 1, props.startAngle, props.endAngle);
      this.restore();
      continue;
    }
    
    if (type === 'full-ellipse') {
      this.save();
      this.translate(props.x, props.y);
      this.rotate(props.rotation);
      this.scale(props.radiusX, props.radiusY);
      this.arc(0, 0, 1, 0, pi2);
      this.restore();
      continue;
    }
    
    if (type === 'quick-ellipse') {
      this.save();
      this.translate(props.x, props.y);
      this.scale(props.radiusX, props.radiusY);
      this.arc(0, 0, 1, 0, pi2);
      this.restore();
      continue;
    }
    
    if (type === 'globalCompositeOperation') {
      globalCompositeOperationStack.push(ctx.globalCompositeOperation);
      ctx.globalCompositeOperation = props.value;
      continue;
    }
    
    if (type === 'endGlobalCompositeOperation') {
      ctx.globalCompositeOperation = globalCompositeOperationStack.pop();
      continue;
    }
    
    if (type === 'fill') {
      ctx.fill();
      continue;
    }
    
    if (type === 'stroke') {
      ctx.stroke();
      continue;
    }
    if (type === 'clipPath') {
      ctx.clip();
      continue;
    }
    
    if (type === 'beginPath') {
      ctx.beginPath();
      continue;
    }
    
    if (type === 'closePath') {
      ctx.closePath();
      continue;
    }
    
    if (type === 'globalAlpha') {
      globalAlphaStack.push(ctx.globalAlpha);
      ctx.globalAlpha *= props.value;
      continue;
    }
    
    if (type === 'endGlobalAlpha') {
      ctx.globalAlpha = globalAlphaStack.pop();
      continue;
    }
    
    if (type === 'hitRegion') {
      this.mouseRegions.push({
        id: props.id,
        points: transformPoints(props.points, transformStack[transformStack.length - 1])
      });
      continue;
    }
  }
  
  return this.applyStyles();
};

Renderer.create = function create(width, height, parent, worker) {
  if (arguments.length > 2) {
    return new Renderer(width, height, parent, worker);
  }
  if (arguments.length === 2) {
    return new Renderer(width, height);
  }
  return new Renderer();
};

Renderer.prototype.workerCommand = function workerCommand(e) {
  var tree,
      img,
      data = e.data;
  //import the canvas object when we need it because Canvas depends on Renderer
  if (!Canvas) {
    Canvas = require('./Canvas');
  }
  if (!Gradient) {
    Gradient = require('./Gradient');
  }
  
  if (data.type === 'ready') {
    return this.ready();
  }
  
  if (data.type === 'image') {
    img = new Img(data.value.id);
    Img.cache[data.value.id] = img;
    return;
  }
  if (data.type === 'image-source') {
    if (Img.cache.hasOwnProperty(data.value.id)) {
      img = Img.cache[data.value.id];
      img.src = data.value.src;
      img.once('load', function() {
        this.sendWorker('image-load', data.value);
      }.bind(this));
    }
    return;
  }
  
  if (data.type === 'image-cache') {
    if (Img.cache.hasOwnProperty(data.value.id)) {
      Img.cache[data.value.id].cache();
    }
    return;
  }
  
  if (data.type === 'image-dispose') {
    if (Img.cache.hasOwnProperty(data.value.id)) {
      Img.cache[data.value.id].dispose();
    }
    return;
  }
  
  if (data.type === 'render') {  
    //set the tree
    this.tree = data.value;
    return;
  }
  
  if (data.type === 'renderer-resize') {
    return this.resize(data.value.width, data.value.height);
  }
  
  if (data.type === 'canvas') {
    if (!Canvas.cache.hasOwnProperty(data.value.id)) {
      Canvas.cache[data.value.id] = new Canvas(data.value.width, data.value.height, data.value.id);
    }
    img = Canvas.cache[data.value.id];
    img.resize(data.value.width, data.value.height);
    return Canvas.cache[data.value.id].render(data.value.children);
  }
  
  if (data.type === 'canvas-image') {
    if (Canvas.cache.hasOwnProperty(data.value.id)) {
      Canvas.cache[data.value.id].toImage(data.value.imageID);
      return;
    }
  }
  
  if (data.type === 'canvas-cache') {
    if (Canvas.cache.hasOwnProperty(data.value.id) && Canvas.cache[data.value.id]) {
      Canvas.cache[data.value.id].cache();
    }
    return;
  }
  
  if (data.type === 'canvas-dispose' && Canvas.cache.hasOwnProperty(data.value.id) && Canvas.cache[data.value.id]) {
      return Canvas.cache[data.value.id].dispose();
  }
  
  if (data.type === 'linear-gradient') {
    Gradient.cache[data.value.id] = createLinearGradient(data.value.x0, data.value.y0, 
                                                         data.value.x1, data.value.y1, 
                                                         data.value.children, data.value.id);
    return;
  }
  
  if (data.type === 'radial-gradient') {
    Gradient.cache[data.value.id] = createRadialGradient(
      data.value.x0, data.value.y0, data.value.r0,
      data.value.x1, data.value.y1, data.value.r1,
      data.value.children, data.value.id
    );
    return;
  }
  
  if (data.type === 'gradient-dispose') {
    if (Gradient.cache.hasOwnProperty(data.value.id)) {
      return Gradient.cache[data.value.id].dispose();
    }
    return;
  }
  
  if (data.type === 'gradient-cache') {
    if (Gradient.cache.hasOwnProperty(data.value.id)) {
      return Gradient.cachable.push(data.value.id);
    }
    return;
  }
  
  if (data.type === 'style') {
    return this.style(data.value);
  }
  
  return this.emit(data.type, data.value);
};

Renderer.prototype.resize = function(width, height) {
  
  //resize event can be called from browser or worker, so we need to tell the browser to resize itself
  if (isWorker) {
    return this.sendBrowser('renderer-resize', { width: width, height: height });
  }
  
  //only resize if the sizes are different, because it clears the canvas
  if (this.canvas.width.toString() !== width.toString()) {
    this.canvas.width = width;
  }
  if (this.canvas.height.toString() !== height.toString()) {
    this.canvas.height = height;
  }
};

Renderer.prototype.hookRender = function hookRender() {
  //This function is never called worker side, so we can't check isWorker to determine where this code is run.
  var didRender = true;
  
  //If the client has sent a 'ready' command and a tree exists
  if (this.isReady) {
      
      //if the worker exists, we should check to see if the worker has sent back anything yet
      if (this.worker) {
        if (this.tree !== null) {
          //fire the frame right away
          this.fireFrame();
          
          //render the current frame from the worker
          this.render(this.tree);
          
          //reset the tree/frame
          this.tree = null;
        } else {
          //the worker isn't finished yet and we missed the window
          didRender = false;
        }
      } else {
        //we are browser side, so this should fire the frame synchronously
        this.fireFrame();
      }
    
      //clean up the cache, but only after the frame is rendered and when the browser has time to
      if (didRender) {
        setTimeout(this.cleanUpCache.bind(this), 0);
      }
  }
  
  return requestAnimationFrame(this.hookRender.bind(this));
};

Renderer.prototype.cleanUpCache = function cleanUpCache() {
  Img.cleanUp();
  Canvas.cleanUp();
  return Gradient.cleanUp();
};

Renderer.prototype.sendWorker = function sendWorker(type, value) {
  //if there is no worker, the event needs to happen browser side
  if (!this.worker) {
    //fire the event anyway
    return this.emit(type, value);
  }
  //otherwise, post the message
  return this.worker.postMessage({ type: type, value: value });
};

Renderer.prototype.sendBrowser = function sendBrowser(type, value) {
  //there is definitely a browser on the other end
  return postMessage({ type: type, value: value });
};


Renderer.prototype.sendAll = function sendAll(type, value) {
  if (!isWorker) {
    this.sendWorker(type, value);
  } else {
    this.sendBrowser(type, value);
  }
  return this.emit(type, value);
};
/*
 * Mouse move events simply increment the down and up values every time the event is fired.
 * This allows games that are lagging record the click counts. It gets reset to 0 every time
 * it is sent.
 */

Renderer.prototype.hookMouseEvents = function hookMouseEvents() {
  //whenever the mouse moves, report the position
  document.addEventListener('mousemove', this.mouseMove.bind(this));
  
  //only report mousedown on canvas
  this.canvas.addEventListener('mousedown', this.mouseDown.bind(this));
  
  //mouse up can happen anywhere
  return document.addEventListener('mouseup', this.mouseUp.bind(this));
};

Renderer.prototype.mouseMove = function mouseMove(evt) {
  //get bounding rectangle
  var rect = this.canvas.getBoundingClientRect(),
      mousePoint = [0,0],
      region;
  
  mousePoint[0] = evt.clientX - rect.left;
  mousePoint[1] = evt.clientY - rect.top;
  
  for(var i = 0; i < this.mouseRegions.length; i++) {
    region = this.mouseRegions[i];
    if (pointInPolygon(mousePoint, region.points)) {
      this.activeRegions.push(region.id);
      this.mouseRegions.splice(this.mouseRegions.indexOf(region), 1);
      i -= 1;
    }
  }
  
  this.mouseData.x = mousePoint[0];
  this.mouseData.y = mousePoint[1];
  this.mouseData.state = this.mouseState;
  this.mouseData.activeRegions = this.activeRegions;

  //send the mouse event to the worker
  this.sendWorker('mouse', this.mouseData);
  
  //default event stuff
  evt.preventDefault();
  return false;
};

Renderer.prototype.mouseDown = function mouseMove(evt) {
  //set the mouseState down
  this.mouseState = 'down';
  
  //defer to mouseMove
  return this.mouseMove(evt);
};

Renderer.prototype.mouseUp = function mouseMove(evt) {
  //set the mouse state
  this.mouseState = 'up';
  //defer to mouse move
  return this.mouseMove(evt);
};

Renderer.prototype.hookKeyboardEvents = function hookMouseEvents() {
  
  //every code in keycode.code needs to be on keyData
  for (var name in keycode.code) {
    if (keycode.code.hasOwnProperty(name)) {
      this.keyData[name] = "up";
    }
  }
  
  //keydown should only happen ON the canvas
  this.canvas.addEventListener('keydown', this.keyDown.bind(this));
  
  //but keyup should be captured everywhere
  return document.addEventListener('keyUp', this.keyUp.bind(this));
};

Renderer.prototype.keyChange = function keyChange(evt) {
  this.sendWorker('key', this.keyData);
  evt.preventDefault();
  return false;
};

Renderer.prototype.keyDown = function keyDown(evt) {
  this.keyData[keycode.code[evt.keyCode]] = "down";
  return this.keyChange(evt);
};

Renderer.prototype.keyUp = function keyUp(evt) {
  this.keyData[keycode.code[evt.keyCode]] = "up";
  return this.keyChange(evt);
};

Renderer.prototype.browserCommand = function(e) {
  if (e.data.type === 'image-load') {
    Img.cache[e.data.value.id].emit('load');
  }
  
  return this.emit(e.data.type, e.data.value);
};

Renderer.prototype.fireFrame = function() {
  return this.sendWorker('frame', {});
};

Renderer.prototype.style = function style() {
  var styles = [],
      name;
  for (var i = 0; i < arguments.length; i++) {
    styles.push(arguments[i]);
  }
  styles = flatten(styles);
  if (isWorker) {
    this.sendBrowser('style', styles);
  } else {
    for (i = 0; i < styles.length; i++) {
      this.styleQueue.push(styles[i]);
    }
    
  }
};

Renderer.prototype.applyStyles = function applyStyles() {
  var styleVal, value;
  for(var i = 0; i < this.styleQueue.length; i++) {
      styleVal = this.styleQueue[i];
      for(var name in styleVal) {
        if (styleVal.hasOwnProperty(name)) {
          value = styleVal[name];
          if (value === null) {
            this.canvas.style.removeProperty(name);
            continue;
          }
          this.canvas.style.setProperty(name, value);
        }
      }
    }
};

Renderer.prototype.ready = function ready() {
  if (isWorker) {
    this.sendBrowser('ready');
  } else {
    this.isReady = true;
    this.fireFrame();
    return requestAnimationFrame(this.hookRender.bind(this));
  }
};
Object.seal(Renderer);
Object.seal(Renderer.prototype);
module.exports = Renderer;

},{"./Canvas":34,"./Gradient":35,"./Img":36,"./createLinearGradient":48,"./createRadialGradient":49,"./isWorker":65,"./transformPoints":80,"events":1,"keycode":8,"lodash/array/flatten":9,"lodash/lang/isElement":26,"point-in-polygon":32,"square-matrix-multiply":33,"util":6}],39:[function(require,module,exports){
//jshint node: true

'use strict';
var Instruction = require('./Instruction');

function addColorStop(offset, color) {
  return new Instruction('addColorStop', { offset: offset, color: color });
}

module.exports = addColorStop;
},{"./Instruction":37}],40:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function arc(x, y, r, startAngle, endAngle, anticlockwise) {
  if (arguments.length > 5) {
    return new Instruction(anticlockwise ? 'anticlockwise-arc' : 'arc', { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
  }
  if (arguments.length === 5) {
    return new Instruction('arc', { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
  }
  if (arguments.length >= 3) {
    return new Instruction('full-arc', { x: x, y: y, r: r});
  }
  if (arguments.length >= 1) {
    return new Instruction('quick-arc', { r: x });
  }
  
  return new Instruction('quick-arc', { r: 1 });
}

module.exports = arc;
},{"./Instruction":37}],41:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function arcTo(x1, y1, x2, y2, r) {
  return new Instruction('arcTo', { x1: x1, y1: y1, x2: x2, y2: y2, r: r });
}

module.exports = arcTo;

},{"./Instruction":37}],42:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function beginPath() {
  return new Instruction('beginPath');
}
module.exports = beginPath;
},{"./Instruction":37}],43:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
  return new Instruction('bezierCurveTo', {
    cp1x: cp1x, 
    cp1y: cp1y, 
    cp2x: cp2x, 
    cp2y: cp2y, 
    x: x, 
    y: y
  });
}

module.exports = bezierCurveTo;
},{"./Instruction":37}],44:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function fillRect(x, y, width, height) {
  if (arguments.length > 2) {
    return new Instruction("clearRect", { x: x, y: y, width: width, height: height });
  } else {
    return new Instruction("clearRect", { x: 0, y: 0, width: x, height: y });
  }
}

module.exports = fillRect;
},{"./Instruction":37}],45:[function(require,module,exports){
//jshint node: true
'use strict';

var beginPath = require('./beginPath'),
    clipPath = require('./clipPath');

function clip(children) {
  var result = [beginPath()];
  for(var i = 0; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(clipPath());
  return result;
}

module.exports = clip;
},{"./beginPath":42,"./clipPath":46}],46:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function clipPath() {
  return new Instruction('clipPath');
}
module.exports = clipPath;
},{"./Instruction":37}],47:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function closePath() {
  return new Instruction('closePath');
}
module.exports = closePath;
},{"./Instruction":37}],48:[function(require,module,exports){
//jshint node: true, browser: true, worker: true
'use strict';
var isWorker = require('./isWorker'),
    flatten = require('lodash/array/flatten'),
    Gradient = require('./Gradient'),
    newid = require('./id');

function createLinearGradient(x0, y0, x1, y1, children, id) {
  id = id || newid();
  if (isWorker) {
    postMessage({ type: 'linear-gradient', value: { id: id, x0: x0, y0: y0, x1: x1, y1: y1, children: children } });
    return new Gradient(id, null);
  } else {
    var ctx = document.createElement('canvas').getContext('2d'),
      grd = ctx.createLinearGradient(x0, y0, x1, y1),
      colorStop,
      result = new Gradient(id, grd);
    for(var i = 0; i < children.length; i++) {
      colorStop = children[i];
      grd.addColorStop(colorStop.props.offset, colorStop.props.color);
    }
    
    return result; 
  }
}


module.exports = createLinearGradient;
},{"./Gradient":35,"./id":63,"./isWorker":65,"lodash/array/flatten":9}],49:[function(require,module,exports){
//jshint node: true, browser: true, worker: true
'use strict';
var isWorker = require('./isWorker'),
    Gradient = require('./Gradient'),
    newid = require('./id');

function createRadialGradient(x0, y0, r0, x1, y1, r1, children, id) {
  id = id || newid();
  if (isWorker) {
    postMessage({ 
      type: 'radial-gradient', 
      value: { id: id, x0: x0, r0: r0, y0: y0, x1: x1, y1: y1, r1: r1, children: children } 
    });
    return new Gradient(id, null);
  } else {
    var ctx = document.createElement('canvas').getContext('2d'),
      grd = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1),
      colorStop,
      result = new Gradient(id, grd);
    for(var i = 0; i < children.length; i++) {
      colorStop = children[i];
      grd.addColorStop(colorStop.props.offset, colorStop.props.color);
    }
    return result;
  }
}


module.exports = createRadialGradient;
},{"./Gradient":35,"./id":63,"./isWorker":65}],50:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function drawCanvas(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  if (arguments.length === 9) {
    return new Instruction('drawCanvasSource', {
      img: canvas.id,
      sx: sx,
      sy: sy,
      sWidth: sWidth,
      sHeight: sHeight,
      dx: dx,
      dy: dy,
      dWidth: dWidth,
      dHeight: dHeight
    });
  }
  
  if (arguments.length >= 5) {
    return new Instruction('drawCanvasSize', {
      img: canvas.id,
      dx: sx,
      dy: sy,
      dWidth: sWidth,
      dHeight: sHeight
    });
  }
  
  if (arguments.length >= 3) {
    return new Instruction('drawCanvas', {
      img: canvas.id,
      dx: sx,
      dy: sy
    });
  }  

  return new Instruction('drawCanvas', {
    img: canvas.id,
    dx: 0,
    dy: 0
  });
}

module.exports = drawCanvas;
},{"./Instruction":37}],51:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  if (arguments.length === 9) {
    return new Instruction('drawImageSource', {
      img: img.id,
      sx: sx,
      sy: sy,
      sWidth: sWidth,
      sHeight: sHeight,
      dx: dx,
      dy: dy,
      dWidth: dWidth,
      dHeight: dHeight
    });
  }
  
  if (arguments.length >= 5) {
    return new Instruction('drawImageSize', {
      img: img.id,
      dx: sx,
      dy: sy,
      dWidth: sWidth,
      dHeight: sHeight
    });
  }
  
  if (arguments.length >= 3) {
    return new Instruction('drawImage', {
      img: img.id,
      dx: sx,
      dy: sy
    });
  }  

  return new Instruction('drawImage', {
    img: img.id,
    dx: 0,
    dy: 0
  });
}

module.exports = drawImage;
},{"./Instruction":37}],52:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) {
  if (arguments.length > 7) {
    return new Instruction(anticlockwise ? 'anticlockwise-ellipse' : 'ellipse', { x: x, y: y, radiusX: radiusX, radiusY: radiusY, startAngle: startAngle, endAngle: endAngle });
  }
  
  if (arguments.length === 7) {
    return new Instruction('ellipse', { x: x, y: y, radiusX: radiusX, radiusY: radiusY, rotation: rotation, startAngle: startAngle, endAngle: endAngle });
  }
  if (arguments.length >= 5) {
    return new Instruction('full-ellipse', { x: x, y: y, radiusX: radiusX, radiusY: radiusY, rotation: rotation });
  }
  if (arguments.length === 4) {
    return new Instruction('quick-ellipse', { x: x, y: y, radiusX: radiusX, radiusY: radiusY });
  }
  return new Instruction('quick-ellipse', { x: 0, y: 0, radiusX: x, radiusY: y });
}

module.exports = ellipse;
},{"./Instruction":37}],53:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function fill() {
  return new Instruction('fill');
}

module.exports = fill;
},{"./Instruction":37}],54:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    pi2 = Math.PI * 2;

function fillArc(x, y, r, startAngle, endAngle, counterclockwise) {
  if (arguments.length >= 6 && counterclockwise) {
    return new Instruction("fillArc-counterclockwise", { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
    
  }
  if (arguments.length > 3) {
    return new Instruction("fillArc", { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
  } 
  if (arguments.length > 1){
    return new Instruction("fillArc", { x: x, y: y, r: r, startAngle: 0, endAngle: pi2 });
  }
  return new Instruction("fillArc",  { x: 0, y: 0, r: x, startAngle: 0, endAngle: pi2 });
}

module.exports = fillArc;
},{"./Instruction":37}],55:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function fillImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  if (arguments.length === 9) {
    return new Instruction('fillImageSource', {
      img: img.id,
      sx: sx,
      sy: sy,
      sWidth: sWidth,
      sHeight: sHeight,
      dx: dx,
      dy: dy,
      dWidth: dWidth,
      dHeight: dHeight
    });
  }
  
  if (arguments.length >= 5) {
    return new Instruction('fillImageSize', {
      img: img.id,
      dx: sx,
      dy: sy,
      dWidth: sWidth,
      dHeight: sHeight
    });
  }
  
  if (arguments.length >= 3) {
    return new Instruction('fillImage', {
      img: img.id,
      dx: sx,
      dy: sy
    });
  }  

  return new Instruction('fillImage', {
    img: img.id,
    dx: 0,
    dy: 0
  });
}

module.exports = fillImage;
},{"./Instruction":37}],56:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function fillImagePattern(img, dx, dy, dWidth, dHeight) {
  
  if (arguments.length >= 5) {
    return new Instruction('fillImagePattern', {
      img: img.id,
      dx: dx,
      dy: dy,
      dWidth: dWidth,
      dHeight: dHeight
    });
  }
  
  if (arguments.length >= 3) {
    return new Instruction('fillImagePattern', {
      img: img.id,
      dx: 0,
      dy: 0,
      dWidth: dx,
      dHeight: dy
    });
  }  

  return new Instruction('fillImagePattern', {
    img: img.id,
    dx: 0,
    dy: 0,
    dWidth: 0,
    dHeight: 0
  });
}

module.exports = fillImagePattern;
},{"./Instruction":37}],57:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function fillRect(x, y, width, height) {
  if (arguments.length >= 4) {
    return new Instruction("fillRect", { x: x, y: y, width: width, height: height });
  } else {
    return new Instruction("fillRect", { x: 0, y: 0, width: x, height: y });
  }
}

module.exports = fillRect;
},{"./Instruction":37}],58:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    Gradient = require('./Gradient');

function fillStyle(value, children) {
  var instruction;
  if (value instanceof Gradient) {
    instruction = new Instruction('fillGradient', { value: { id: value.id } });
  }
  
  if (!instruction) {
    instruction = new Instruction('fillStyle', { value: value });
  }
  var result = [instruction];
  for(var i = 1; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('endFillStyle'));
  return result;
}

module.exports = fillStyle;
},{"./Gradient":35,"./Instruction":37}],59:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function globalAlpha(alpha, children) {
  var result = [new Instruction('globalAlpha', { value: alpha })];
  for(var i = 1; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('endGlobalAlpha'));
  return result;
}

module.exports = globalAlpha;
},{"./Instruction":37}],60:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function globalCompositeOperation(operationType, children) {
  var result = [new Instruction('globalCompositeOperation', { value: operationType })];
  if (arguments.length === 0) {
    return [];
  }
  
  for (var i = 1; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('endGlobalCompositeOperation'));
  return result;
}

module.exports = globalCompositeOperation;
},{"./Instruction":37}],61:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    hitRegion = require('./hitRegion');


function hitRect(id, x, y, width, height) {
  if (arguments.length <= 3) {
    width = x;
    height = y;
    x = 0;
    y = 0;
  }
  
  var points = [
    [x, y],
    [x, y + height],
    [x + width, y + height],
    [x + width, y]
  ];
  
  return hitRegion(id, points);
}

module.exports = hitRect;
},{"./Instruction":37,"./hitRegion":62}],62:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');


function hitRegion(id, points) {
  return new Instruction('hitRegion', {
    id: id,
    points: points
  });
}

module.exports = hitRegion;
},{"./Instruction":37}],63:[function(require,module,exports){
//jshint node: true
'use strict';

function id() {
  return Date.now() + '-' + Math.random();
}

module.exports = id;
},{}],64:[function(require,module,exports){
//jshint node: true
function isDataURL(s) {
    return !!s.match(isDataURL.regex);
}
isDataURL.regex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;
Object.seal(isDataURL);
module.exports = isDataURL;

},{}],65:[function(require,module,exports){
//jshint node: true
'use strict';

module.exports = typeof document === 'undefined';
},{}],66:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function lineStyle(value, children) {
  
  value = value || {};
  var result = {
    strokeStyle: null,
    lineWidth: null,
    lineCap: null,
    lineJoin: null,
    miterLimit: null,
    lineDash: [],
    lineDashOffset: null
  };
  
  if (typeof value.strokeStyle !== 'undefined') {
    result.strokeStyle = value.strokeStyle; 
  }
  if (typeof value.lineWidth !== 'undefined') {
    result.lineWidth = value.lineWidth;
  }
  if (typeof value.lineCap !== 'undefined') {
    result.lineCap = value.lineCap;
  }
  if (typeof value.lineJoin !== 'undefined') {
    result.lineJoin = value.lineJoin;
  }
  if (typeof value.miterLimit !== 'undefined') {
    result.miterLimit = value.miterLimit;
  }
  if (typeof value.lineDash !== 'undefined') {
    result.lineDash = value.lineDash;
  }
  if (typeof value.lineDashOffset !== 'undefined') {
    result.lineDashOffset = value.lineDashOffset;
  }
  var tree = [new Instruction('lineStyle', result)];
  for(var i = 1; i < arguments.length; i++) {
    tree.push(arguments[i]);
  }
  tree.push(new Instruction('endLineStyle'));
  return tree;
}

module.exports = lineStyle;
},{"./Instruction":37}],67:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function lineTo(x, y) {
  if (arguments.length === 0) {
    return new Instruction('lineTo', { x: 0, y: 0});
  }
  return new Instruction('lineTo', { x: x, y: y });
}

module.exports = lineTo;
},{"./Instruction":37}],68:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function moveTo(x, y) {
  if (arguments.length === 0) {
    return new Instruction('moveTo', { x: 0, y: 0});
  }
  return new Instruction('moveTo', { x: x, y: y });
}

module.exports = moveTo;
},{"./Instruction":37}],69:[function(require,module,exports){
//jshint node: true
'use strict';

var beginPath = require('./beginPath'),
    closePath = require('./closePath');

function path(children) {
  var result = [beginPath()];
  for(var i = 0; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(closePath());
  return result;
}

module.exports = path;
},{"./beginPath":42,"./closePath":47}],70:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function quadraticCurveTo(cpx, cpy, x, y) {
  return new Instruction('quadraticCurveTo', {
    cpx: cpx, 
    cpy: cpy, 
    x: x, 
    y: y
  });
}

module.exports = quadraticCurveTo;
},{"./Instruction":37}],71:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    flatten = require('lodash/array/flatten');

function rotate(r, children) {
  r = +r;
  var result = [new Instruction('rotate', { r: r })];
  for(var i = 1; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('restore'));
  return result;
}

module.exports = rotate;
},{"./Instruction":37,"lodash/array/flatten":9}],72:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    flatten = require('lodash/array/flatten');

function scale(x, y, children) {
  var i = 2;
  if (typeof y !== 'number') {
    y = x;
    i = 1;
  }
  children = children || [];
  
  var result = [new Instruction('scale', { x: x, y: y })],
      child;
  for (; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('restore'));
  return result;
}

module.exports = scale;
},{"./Instruction":37,"lodash/array/flatten":9}],73:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function shadowStyle(value, children) {
  value = value || {};
  var result = {
    shadowBlur: null,
    shadowColor: null,
    shadowOffsetX: null,
    shadowOffsetY: null
  };
  
  if (typeof value.shadowBlur !== 'undefined') {
    result.shadowBlur = value.shadowBlur; 
  }
  if (typeof value.shadowColor !== 'undefined') {
    result.shadowColor = value.shadowColor; 
  }
  if (typeof value.shadowOffsetX !== 'undefined') {
    result.shadowOffsetX = value.shadowOffsetX; 
  }
  if (typeof value.direction !== 'undefined') {
    result.shadowOffsetY = value.shadowOffsetY; 
  }
  
  var tree = [new Instruction('shadowStyle', value)];
  for (var i = 1; i < arguments.length; i++) {
    tree.push(arguments[i]);
  }
  tree.push(new Instruction('endShadowStyle'));
  
  return tree;
}

module.exports = shadowStyle;
},{"./Instruction":37}],74:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function stroke() {
  return new Instruction('stroke');
}

module.exports = stroke;
},{"./Instruction":37}],75:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
    pi2 = Math.PI * 2;

function strokeArc(x, y, r, startAngle, endAngle, counterclockwise) {
  if (arguments.length >= 6 && counterclockwise) {
    return new Instruction("strokeArc-counterclockwise", { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
  }
  if (arguments.length > 3) {
    return new Instruction("strokeArc", { x: x, y: y, r: r, startAngle: startAngle, endAngle: endAngle });
  } 
  if (arguments.length > 1){
    return new Instruction("strokeArc", { x: x, y: y, r: r, startAngle: 0, endAngle: pi2 });
  }
  return new Instruction("strokeArc",  { x: 0, y: 0, r: x, startAngle: 0, endAngle: pi2 });
}

module.exports = strokeArc;
},{"./Instruction":37}],76:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function strokeRect(x, y, width, height) {
  if (arguments.length > 2) {
    return new Instruction("strokeRect", { x: x, y: y, width: width, height: height });
  } else {
    return new Instruction("strokeRect", { x: 0, y: 0, width: x, height: y });
  }
}

module.exports = strokeRect;
},{"./Instruction":37}],77:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');
function text(str, x, y, fill, stroke, maxWidth) {
  if (arguments.length === 6) {
    return new Instruction('text', {
      x: x,
      y: y,
      fill: fill,
      stroke: stroke,
      text: str,
      maxWidth: maxWidth
    });
  }
  if (arguments.length === 5) {
    return new Instruction('text', {
      x: x,
      y: y,
      fill: fill,
      stroke: stroke,
      text: str,
      maxWidth: 0
    });
  }
  
  if (arguments.length === 4) {
    return new Instruction('text', {
      x: x,
      y: y,
      fill: fill,
      stroke: false,
      text: str,
      maxWidth: 0
    });
  }
  
  if (arguments.length === 3) {
    return new Instruction('text', {
      x: x,
      y: y,
      fill: true,
      stroke: false,
      text: str,
      maxWidth: 0
    });
  }
  
  return new Instruction('text', {
    x: 0,
    y: 0,
    fill: true,
    stroke: false,
    text: str,
    maxWidth: 0
  });
}

module.exports = text;
},{"./Instruction":37}],78:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction');

function textStyle(value, children) {
  value = value || {};
  var result = {
    font: null,
    textAlign: null,
    textBaseline: null,
    direction: null
  };
  
  if (typeof value.font !== 'undefined') {
    result.font = value.font; 
  }
  if (typeof value.textAlign !== 'undefined') {
    result.textAlign = value.textAlign; 
  }
  if (typeof value.textBaseline !== 'undefined') {
    result.textBaseline = value.textBaseline; 
  }
  if (typeof value.direction !== 'undefined') {
    result.direction = value.direction; 
  }
  var tree = [new Instruction('textStyle', value)];
  for(var i = 1; i < arguments.length; i++) {
    tree.push(arguments[i]);
  }
  tree.push(new Instruction('endTextStyle'));
  return tree;
}

module.exports = textStyle;
},{"./Instruction":37}],79:[function(require,module,exports){
//jshint node: true
'use strict';
var smm = require('square-matrix-multiply'),
    Instruction = require('./Instruction');

function transform(stack, children) {
  var t,
      i,
      val,
      cosVal,
      sinVal,
      sx,
      sy,
      result = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ],
      props,
      transformResult,
      len = stack.length;
  for(i = 0; i < len; i++) {
    t = stack[i];
    
    if (t.hasOwnProperty('transform')) {
      result = smm(result, [
        [t.transform.a,t.transform.c,t.transform.e],
        [t.transform.b,t.transform.d,t.transform.f],
        [0,0,1]
      ]);
      continue;
    }
    
    if (t.hasOwnProperty('translate')) {
      sx = t.translate.x;
      sy = t.translate.y;
      
      result = smm(result, [
        [1, 0, sx],
        [0, 1, sy],
        [0, 0, 1]
      ]);
    }
    
    if (t.hasOwnProperty('scale')) {
      sx = t.scale.x;
      sy = t.scale.y;
      
      result = smm(result, [
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, 1]
      ]);
    }
    
    if (t.hasOwnProperty('rotate')) {
      sinVal = Math.sin(t.rotate);
      cosVal = Math.cos(t.rotate);
      result = smm(result, [
        [cosVal, -sinVal, 0],
        [sinVal, cosVal, 0],
        [0, 0, 1]
      ]);
    }
  }
  props = {
    a: result[0][0],
    b: result[1][0],
    c: result[0][1],
    d: result[1][1],
    e: result[0][2],
    f: result[1][2]
  };
  
  transformResult = [new Instruction('transform', props)];
  for(i = 1; i < arguments.length; i++) {
    transformResult.push(arguments[i]);
  }
  transformResult.push(new Instruction('restore'));
  
  return transformResult;
}
function copy(target, children) {
  var t = target[0],
    result = [new Instruction('transform', {
      a: t.props.a,
      b: t.props.b,
      c: t.props.c,
      d: t.props.d,
      e: t.props.e,
      f: t.props.f
    })];
  
  for(var i = 1; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  result.push(new Instruction('restore'));
  return result;
}

transform.copy = copy;


module.exports = transform;
},{"./Instruction":37,"square-matrix-multiply":33}],80:[function(require,module,exports){
//jshint node: true
'use strict';

function transformPoints(points, matrix) {
  var result = [],
      len = points.length,
      point;

  for(var i = 0; i < len; i++) {
    point = points[i];
    result.push([
      matrix[0][0] * point[0] + matrix[0][1] * point[1] + matrix[0][2],
      matrix[1][0] * point[0] + matrix[1][1] * point[1] + matrix[1][2]
    ]);
  }
  return result;
}

module.exports = transformPoints;
},{}],81:[function(require,module,exports){
//jshint node: true
'use strict';
var Instruction = require('./Instruction'),
  flatten = require('lodash/array/flatten');

function translate(x, y, children) {
  
  var result = [new Instruction('translate', { x: x, y: y })];
  
  for (var i = 2; i < arguments.length; i++) {
    result.push(arguments[i]);
  }
  
  result.push(new Instruction('restore'));
  return result;
}

module.exports = translate;
},{"./Instruction":37,"lodash/array/flatten":9}]},{},[7])(7)
});