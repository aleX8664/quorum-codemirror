(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("quorum", function(config) {
  var kwType, curPunc;
  var parserConfig = {
    punctuation: /[.,:()]/,
    simpleOps: /\+|-|\*|<|>|=/,
    ops: /(?:and|or|mod)\b/,
    atomics: /(?:true|false)\b/,
    builtins: /(?:alert|cast|input|output|say|Skynet_Token)\b/,
    keywords: {
      indent: /(?:action|check|class|if|repeat)\b/,
      dedent: /(?:end)\b/,
      redent: /(?:always|detect|else|elseif)\b/,
      normal: /(?:is|me|package|parent|public|private|return(?:s)?|times|until|use)\b/
    }
  }

  function tokenBase(stream, state) {
    var ch = stream.next();
    if(!ch) return null;
    // Text
    if(ch == '"') {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    }
    // Commentes
    if(ch == '/') {
      // Multiline comments
      if(stream.eat('*')) {
        state.tokenize = tokenComment;
        return tokenComment(stream, state);
      }
      // Single line comments - DONE
      if(stream.eat('/')) {
        stream.skipToEnd();
        return 'comment';
      }
      // Division operator
      return 'operator';
    }
    // Punctuation - DONE
    if(parserConfig.punctuation.test(ch)) {
      curPunc = ch;
      return null;
    }
    // Operators - DONE
    if(parserConfig.simpleOps.test(ch)) {
      stream.eatWhile(parserConfig.simpleOps);
      return 'operator';
    }
    var start = charBeforeStart(stream);
    stream.backUp(1);
    if(stream.match(/^not=/) && !(start && /\w|\d/.test(start))) return "operator";
    if(!start || start == " " || start == "(" || start == "\t") {
      if(stream.match(parserConfig.ops)) return "operator";
      // Atomics
      if(stream.match(parserConfig.atomics)) return "atom";
      // Types
      if(stream.match(/\b(?:boolean|integer|number|text)\b/)) return "type";
      // Builtins - DONE
      if(stream.match(parserConfig.builtins)) return "builtin";
      // Keywords
      if(stream.match(parserConfig.keywords.normal)) return "keyword";
      if(stream.match(parserConfig.keywords.indent)) {
        kwType = "indent";
        return "keyword";
      }
      if(stream.match(parserConfig.keywords.redent)) {
        kwType = "redent";
        return "keyword";
      }
      if(stream.match(parserConfig.keywords.dedent)) {
        kwType = "dedent";
        return "keyword";
      }
    }
    // Numbers - DONE
    if(/\d/.test(ch) && (!start || /\W/.test(start))) {
      if(stream.match(/^((?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/)) {
        if(!stream.eat(/\w/)) return "number";
      }
    }
    stream.next();
    return null;
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (maybeEnd && ch == "/") {
        state.tokenize = null;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return "comment";
  }

  function charBeforeStart(stream) {
    if(stream.start > 0 && !stream.sol())
      return stream.string.charAt(stream.start - 1);
    return false;
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next, end = false;
      while ((next = stream.next()) != null) {
        if (!escaped && next == quote) {end = true; break;}
        escaped = !escaped && next == "\\";
      }
      if (end || !escaped) state.tokenize = null;
      return "string";
    };
  }

  return {
    startState: function() {
      return {
        tokenize: null,
        context: {
          indented: -config.indentUnit,
          type: "top",
          prev: null
        },
        indented: 0
      }
    },
    token: function(stream, state) {
      if(stream.sol()) state.indented = stream.indentation();
      if(stream.eatSpace()) return null;
      curPunc = null;
      kwType = null;
      var ctx = state.context;
      var style = (state.tokenize || tokenBase)(stream, state);
      if(style == "keyword") {
        if(kwType == "dedent" && state.context.prev != null) {
          state.context = state.context.prev;
        }
        if (kwType == "redent" && state.context.prev != null) {
          state.context = {indented: state.context.prev.indented, type: style, prev: state.context.prev.prev}
          kwType = "indent";
        }
        if(kwType == "indent") {
          state.context = {indented: state.indented, type: style, prev: state.context};
        }
      }
      return style;
    },

    indent: function(state, textAfter) {
      var firstChar = textAfter && textAfter.charAt(0);
      var ctx = state.context;
      var closing = ctx.type == "keyword" && /^(?:else|elseif|end)$/.test(textAfter);
      return ctx.indented + (closing ? 0 : config.indentUnit);
    },
    electricInput: /^\s*(?:else|elseif|end)$/,
    lineComment: "//",
    blockCommentStart: "/*",
    blockCommentEnd: "*/"
  }
});
})
