/*
 * General purpose utilities.
 *
 * Written by Anant Narayanan, unless otherwise specified.
 * Contributions by Philipp von Weitershausen, Martin Reckziegel, Andreas Thienemann
 *
 */
Weave.Util = function() {
  function _XOR(a, b, isA) {
    if (a.length != b.length) {
      return false;
    }

    var val = [];
    for (var i = 0; i < a.length; i++) {
      if (isA) {
        val[i] = a[i] ^ b[i];
      } else {
        val[i] = a.charCodeAt(i) ^ b.charCodeAt(i);
      }
    }

    return val;
  }

  function _stringToHex(str) {
    var ret = '';
    for (var i = 0; i < str.length; i++) {
      var num = str.charCodeAt(i);
      var hex = num.toString(16);
      if (hex.length == 1) {
        hex = '0' + hex;
      }
      ret += hex;
    }
    return ret;
  }

  function _hexToString(hex) {
    var ret = '';
    if (hex.length % 2 != 0) {
      return false;
    }

    for (var i = 0; i < hex.length; i += 2) {
      var cur = hex[i] + hex[i + 1];
      ret += String.fromCharCode(parseInt(cur, 16));
    }
    return ret;
  }

  function _arrayToString(arr) {
    var ret = '';
    for (var i = 0; i < arr.length; i++) {
      ret += String.fromCharCode(arr[i]);
    }
    return ret;
  }

  function _stringToArray(str) {
    var ret = [];
    for (var i = 0; i < str.length; i++) {
      ret[i] = str.charCodeAt(i);
    }
    return ret;
  }

  /*
   * Convert characters in 'str' to bytes by cutting off all bits > 8
   */
  function _intify(str) {
    var ret = '';
    for (var i = 0; i < str.length; i++) {
      var cur = str.charCodeAt(i);
      ret += String.fromCharCode(cur & 0xff);
    }

    return ret;
  }

  function _clearify(str) {
    var ret = '';
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        ret += String.fromCharCode(code);
      }
    }

    return ret;
  }

  function _randomBytes(length) {
      var ret = [];
      for (var i = 0; i < length; i++) {
        // Generates uniformly distributed random integer between 0 and 255
        ret[i] = Math.floor(Math.random() * 256);
      }
      return _arrayToString(ret);
  }

  function _hexStringToArray(str) {
    var ret = [];
    if (str.length % 2 != 0) {
      return false;
    }
    for (var i = 0; i < str.length; i += 2) {
      var cur = str.charAt(i) + str.charAt(i + 1);
      ret.push(parseInt(cur, 16));
    }
    return ret;
  }

  return {
    XOR: _XOR,
    HtS: _hexToString,
    StH: _stringToHex,
    AtS: _arrayToString,
    StA: _stringToArray,
    HtA: _hexStringToArray,
    intify: _intify,
    clearify: _clearify,
    randomBytes: _randomBytes
  };

}();

/*
 * Generate a brand-new globally unique identifier (GUID).
 */
Weave.Util.makeGUID = function () {
    var rnd = new Array();
    for (var i = 0; i < 9; i++) {
        rnd.push(Math.floor(Math.random() * 256));
    }
    return Weave.Util.Base64.encode(Weave.Util.AtS(rnd)).replace(/\+/g, '-').replace(/\//, '_');
};

/*
 * Generate a UUID according to RFC4122 v4 (random UUIDs)
 */
Weave.Util.makeUUID = function () {
    var chars = '0123456789abcdef';
    var uuid = [];
    var choice;

    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    for (var i = 0; i < 36; i++) {
        if (uuid[i]) {
            continue;
        }
        choice = Math.floor(Math.random() * 16);
        // Set bits 6 and 7 of clock_seq_hi to 0 and 1, respectively.
        // (cf. RFC4122 section 4.4)
        uuid[i] = chars[(i == 19) ? (choice & 3) | 8 : choice];
      }

    return uuid.join('');
};

Weave.Util.PassphraseHelper = (function() {
    var SYNC_KEY_ENCODED_LENGTH=26;
    var SYNC_KEY_DECODED_LENGTH=16;
    var SYNC_KEY_HYPHENATED_LENGTH=31;

    /**
     * Turn RFC 4648 base32 into our own user-friendly version.
     *   ABCDEFGHIJKLMNOPQRSTUVWXYZ234567
     * becomes
     *   abcdefghijk8mn9pqrstuvwxyz234567
     */
    function base32ToFriendly(input) {
        return input.toLowerCase()
            .replace(/l/g, '8')
            .replace(/o/g, '9');
    };

    function base32FromFriendly(input) {
        return input.toUpperCase()
            .replace(/8/g, 'L')
            .replace(/9/g, 'O');
    };

    function normalizePassphrase(pp) {
        // Short var name... have you seen the lines below?!
        // Allow leading and trailing whitespace.
        pp = pp.trim().toUpperCase();

        pp = pp.split("-").join("");

        while(pp.length<32) pp = pp + "=";

        // Something else -- just return.
        return pp;
    };

    decodeKeyBase32: function decodeKeyBase32(encoded) {
        var norm = normalizePassphrase(encoded);
        var fromFriendly = base32FromFriendly(norm);
        var decode = Weave.Util.Base32.decode(fromFriendly).output;
        var decodeString = Weave.Util.AtS(decode);
        return decodeString.slice(0,SYNC_KEY_DECODED_LENGTH);
    };
    return {
        decodeKeyBase32:decodeKeyBase32
    };
}());

Weave.Util.Base32 = (function() {
	
    function base32_decode(input) {
		var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=";
        var buffer = 0;
        var bitsLeft = 0;    
        var output = new Array();
        var i = 0;
        var count = 0;
        
        while (i < input.length) {
            var val = keyStr.indexOf(input.charAt(i++));
            if (val >= 0 && val < 32) {
              buffer <<= 5;
              buffer |= val;
              bitsLeft += 5;
              if (bitsLeft >= 8) {
                output[count++] = (buffer >> (bitsLeft - 8)) & 0xFF;
                bitsLeft -= 8;
              }            
            }                         
        }
        if (bitsLeft > 0) {
          buffer <<= 5;    
          output[count++] = (buffer >> (bitsLeft - 3)) & 0xFF;
        }         
        return {output : output, bitsLeft : bitsLeft};
    }

  /**
   * Base32 encode (RFC 4648) a string
   */
  function encodeBase32(bytes) {
    const key = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var quanta = Math.floor(bytes.length / 5);
    var leftover = bytes.length % 5;

    // Pad the last quantum with zeros so the length is a multiple of 5.
    if (leftover) {
      quanta += 1;
      for (var i = leftover; i < 5; i++)
        bytes += "\0";
    }

    // Chop the string into quanta of 5 bytes (40 bits). Each quantum
    // is turned into 8 characters from the 32 character base.
    var ret = "";
    for (var i = 0; i < bytes.length; i += 5) {
      var c = Array();
      for (pos in bytes.slice(i, i + 5)) { c.push(bytes.slice(i, i + 5)[pos].charCodeAt()) };
      ret += key[c[0] >> 3]
           + key[((c[0] << 2) & 0x1f) | (c[1] >> 6)]
           + key[(c[1] >> 1) & 0x1f]
           + key[((c[1] << 4) & 0x1f) | (c[2] >> 4)]
           + key[((c[2] << 1) & 0x1f) | (c[3] >> 7)]
           + key[(c[3] >> 2) & 0x1f]
           + key[((c[3] << 3) & 0x1f) | (c[4] >> 5)]
           + key[c[4] & 0x1f];
    }

    switch (leftover) {
      case 1:
        return ret.slice(0, -6) + "======";
      case 2:
        return ret.slice(0, -4) + "====";
      case 3:
        return ret.slice(0, -3) + "===";
      case 4:
        return ret.slice(0, -1) + "=";
      default:
        return ret;
    }
  };
  return {
    decode: base32_decode,
    encode: encodeBase32
	};
}());

/*
 * The JavaScript implementation of Base 64 encoding scheme
 * http://rumkin.com/tools/compression/base64.php
 *
 * Modified, 2008, Anant Narayanan <anant@kix.in>
 *
 * Public domain
 */
Weave.Util.Base64 = (function() {
  var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var encode, decode;

  function _encode64(input) {
    var i = 0;
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;

    while (i < input.length) {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }

    return output;
  }

  function _decode64(input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {
      enc1 = keyStr.indexOf(input.charAt(i++));
      enc2 = keyStr.indexOf(input.charAt(i++));
      enc3 = keyStr.indexOf(input.charAt(i++));
      enc4 = keyStr.indexOf(input.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 != 64) {
              output = output + String.fromCharCode(chr2);
      }

      if (enc4 != 64) {
              output = output + String.fromCharCode(chr3);
      }
    }

    return output;
  }


  // Mozilla and WebKit based browsers have native Base 64 conversion
  if ((typeof atob === "function") && (typeof btoa === "function")) {
    encode = function (input) { return btoa(input); };
    decode = function (input) { return atob(input); };
  } else {
    encode = _encode64;
    decode = _decode64;
  }

  return {
    encode: encode,
    decode: decode,

    // Expose these functions nonetheless for unit testing
    _encode: _encode64,
    _decode: _decode64
  };

}());
