/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is NSS-PKCS5-PKCS12 Parser.
 *
 * The Initial Developer of the Original Code is Anant Narayanan.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Anant Narayanan <anant@kix.in>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Weave.Crypto.PKCS12ASN = function() {
  /* It's not even a real ASN parser.
     This can decode only un-Base64ed strings from NSS's PKCS7Encoder */
  
  /* Salt and Cipher are OCTET Strings */
  var OCT = 0x04;
  /* While iterations is an INTEGER */
  var INT = 0x02;
  
  /* Salt is always at offset 49, and is 16 bytes long */
  var s_off = 49;
  var s_len = 16;
  /* Iterations is always at offset 67. and is 1 byte long */
  var i_off = 67;
  var i_len = 1;
  /* Cipher is always at offset 72, but we don't know its length */
  var c_off = 72;

  var data = '';
  
  function _getSalt() {
    /* TAG must be OCTET STRING */
    var tag = data.charCodeAt(s_off) & 0x1f;
    if (tag != OCT) {
      return false;
    }
    
    /* Length must be s_len */
    var len = data.charCodeAt(s_off + 1);
    if (len != s_len) {
      return false;
    }
      
    /* Extract salt */
    var salt = data.substr(s_off + 2, s_len);
    return salt;
  }
  
  function _getIterations() {
    /* TAG must be INTEGER */
    var tag = data.charCodeAt(i_off) & 0x1f;
    if (tag != INT) {
      return false;
    }
    
    /* Length must be i_len */
    var len = data.charCodeAt(i_off + 1);
    if (len != i_len) {
      return false;
    }

    /* Extract iterations */
    return data.charCodeAt(i_off + 2);
  }
  
  function _getCipher() {
    /* Somehow we always end up with a pair of OCTET STRINGs */
    var tag1 = data.charCodeAt(c_off) & 0x1f;
    if (tag1 != OCT) {
      return false;
    }
    
    /* First length is tricky */
    var lOfLen = 0;
    var len1 = data.charCodeAt(c_off + 1);
    if (len1 & 0x80 != 0) {
      /* we have more length */
      aLen = '';
      lOfLen = len1 & 0x7f;
      for (var i = 0; i < lOfLen; i++) {
        aLen += data.charCodeAt(c_off + 2 + i).toString(16);
      }
      len1 = parseInt(aLen, 16);
    } else {
      lOfLen = 0;
    }
    
    var cip1 = data.substr(c_off + 2 + lOfLen, len1);
    var off2 = c_off + lOfLen + len1 + 2;
    var tag2 = data.charCodeAt(off2) & 0x1f;

    if (tag2 != OCT) {
      return false;
    }
    
    var len2 = data.charCodeAt(off2 + 1);
    var cip2 = data.substr(off2 + 2, len2);
    
    return (cip1 + cip2);
  }
  
  function _decodeASN1(input) {
    var salt, iter, ciph;
    data = input;
    
    salt = _getSalt();
    if (!salt) {
      return false;
    }
    
    iter = _getIterations();
    if (!iter) {
      return false;
    }

    ciph = _getCipher();
    if (!ciph)
      return false;
      
    return {'salt': salt, 'iter': iter, 'cipher': ciph};
  }
  
  return {
    decode: _decodeASN1
  };
  
}();
