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
 * The Original Code is PKCS12 Key Generator.
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

Weave.Crypto.PKCS12 = function() {
  
  /* IV or Key */
  var _TIV = 0x02;
  var _KEY = 0x01;
  
  /* Repeat 'what' as many times as required to create 'bits' bits */
  function _replicate(what, bits) {
    var ret = '';
    var multi = Math.ceil(bits / (what.length * 8));
    for (var i = 0; i < multi; i++) {
      ret += what;
    }
    return ret.substr(0, bits/8);
  }
  
  /* PKCS #12, v1.0 pp. 14-15 */
  function _pkcs12Generator(type, iter, salt, pass) {
    /* For SHA 1 */
    var u = 160;
    var v = 512;
    
    var p = pass.length * 8;
    var s = salt.length * 8;
    
    var i, j, k, l, n, ID, Bidx;
        
    if (type == _TIV) {
      n = 8 * 8;
      ID = String.fromCharCode(2);
    } else {
      n = 24 * 8;
      ID = String.fromCharCode(1);
    }
    
    /* Prepare Diversifier D */
    var D = '';
    for (i = 0; i < v / 8; i++) {
      D += ID;
    }
    
    var S = _replicate(salt, v * Math.ceil(s / v));
    var P = _replicate(pass, v * Math.ceil(p / v));
    
    var I = S + P;
    var c = Math.ceil(n / u);
    
    var B = '';
    var A = [];

    for (i = 0; i < c; i++) {
      var cHash = D + I;
      for (j = 0; j < iter; j++) {
        cHash = Weave.Util.SHA.digest1_str(cHash);
      }
      A[i] = cHash;
      B = _replicate(A[i], v);
      
      /* Javascript strings are immutable, BOOOOO */
      var It = [];
      var In = [];
      k = (I.length * 8) / v;

      for (l = 0; l < k; l++) {
        var q, carry;
        It[l] = '';
        In[l] = I.substr(l * (v / 8), v / 8);

        /* In[l] = In[l] + B + 1 */
        for (Bidx = (v / 8) - 1, q = 1, carry = 0; Bidx >= 0; Bidx--, q = 0) {
          q += In[l].charCodeAt(Bidx);
          q += B.charCodeAt(Bidx);
          q += carry;
          
          if (q > 0xff) {
            carry = 1;
          } else {
            carry = 0;
          }
          
          It[l] += String.fromCharCode(q & 0xff);
        }
        In[l] = It[l].split("").reverse().join("");
      }
      I = In.join("");
    }
    return A.join("").substr(0, n / 8);
  }
  
  return {
    TIV: _TIV,
    KEY: _KEY,
    generate: _pkcs12Generator
  };
  
}();
