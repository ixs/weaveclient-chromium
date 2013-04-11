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
 * The Original Code is Weave Client for Chromium
 *
 * The Initial Developer of the Original Code is Philipp von Weitershausen.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Martin Reckziegel
 * Andreas Thienemann
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

/*
 * This must be the first file to be included because it defines the
 * global object that we use to namespace our stuff.
 */

var Weave = {
    Client: {},
    Util: {},
    Crypto: {}
};

Weave.Client = (function () {

    /*** Private functions ***/

    // These hold security sensitive information (credentials, private
    // keys, etc.), which we mustn't expose to the outside.  It's
    // undefined when not connected.
    var secure;
    var cache;

    // Our extra input to SHA256-HMAC in generateEntry.
    // This includes the full crypto spec; change this when our algo changes.
    var HMAC_INPUT="Sync-AES_256_CBC-HMAC256";

    // The storage version we support
    var SUPPORTED_STORAGE_VERSION = 5;

    // A list of allowed WBO fields.
    // See https://wiki.mozilla.org/Labs/Weave/Sync/1.0/API
    var wbo_fields = ["id",
                    //"parentid",
                    //"precedessorid",
                      "modified",
                      "sortindex",
                      "payload"];

    // A list of allowed object fields for each collection.
    // See https://wiki.mozilla.org/Labs/Weave/Developer/BrowserObjects
    var object_fields = {
        "clients": ["id", "name", "type", "commands"],
        "tabs": ["id", "clientName", "tabs"],
        "bookmarks": ["id", "title", "bmkUri", "description", "loadInSidebar",
                      "tags", "keyword", "parentName", "predecessorid", "type"]
    };

    function serializeWBO (wbo) {
        return JSON.stringify(wbo, wbo_fields);
    }


    function createRequest (method, url, errback) {
        var req = new XMLHttpRequest();
        // Avoid initializing the request with username + password as
        // this will be logged in the console in some browsers
        // (e.g. Chrome).
        req.open(method, url, true);
        var authstring = Weave.Util.Base64.encode(
            hashUserName(secure.user) + ':' + secure.password);
        req.setRequestHeader('Authorization', 'Basic ' + authstring);

        req.onerror = function () {
            errback("REQUEST_ERROR", req);
        };
        return req;
    }

    // Attach this to a request if you want the request body to be
    // parsed as JSON.
    function checkJSONBody (callback, errback) {
        return function () {
            var data;
            if (this.status !== 200) {
                return errback("HTTP_STATUS_ERROR", this);
            }

            try {
                data = JSON.parse(this.responseText);
            } catch (ex) {
                return errback("JSON_ERROR", ex, this.responseText);
            }
            callback(data);
        };
    }

    // If handed an email address as a username, hash it before using it.
    function hashUserName (username) {
        if (username.indexOf("@") != -1) {
            return Weave.Util.Base32.encode(
                Weave.Util.SHA.digest1_str(
                    username.toLowerCase()
                )
            ).toLowerCase();
        } else {
            return username.toLowerCase();
        }
    }

    /*** Public client API ***/

    function getUserStorageNode (callback, errback) {
        var url = secure.server + "/user/1.0/" + hashUserName(secure.user) + "/node/weave";
        var req = new XMLHttpRequest();
        // No need for authentication here
        req.open("GET", url, true);
        req.onload = function () {
            if ((req.status === 200) && req.responseText) {
                secure.storageUrl = req.responseText;
            } else {
                // We're probably using a test server.
                // XXX Not sure having this kind of fallback logic in
                // here is such a good idea...
                secure.storageUrl = secure.server;
            }
            // Remove trainling slash from storageUrl.
            var l = secure.storageUrl.length;
            var char = secure.storageUrl.charAt(l-1);
            if(char==="/") {
                secure.storageUrl = secure.storageUrl.substring(0,l-1);
            }
            callback();
        };
        req.onerror = function () {
            errback("REQUEST_ERROR", req);
        };
        req.send();
    }

    function ensureUserStorageNode (callback, errback) {
        if (secure.storageUrl) {
            callback();
            return;
        }
        getUserStorageNode(callback, errback);
    }

    function checkStorageVersion (callback, errback) {
        var keyUri = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                    "/storage/meta/global";

        var req = createRequest("GET", keyUri, errback);
        req.onload = checkJSONBody(function (data) {
                var payload = JSON.parse(data.payload);
                if (payload['storageVersion'] != SUPPORTED_STORAGE_VERSION) {
                    return errback("STORAGE_VERSION_MISMATCH");
                }
                callback();
        }, errback);
        req.send();
    }

    function getKeys (callback, errback) {
        var keyUri = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                    "/storage/crypto/keys";

        var req = createRequest("GET", keyUri, errback);
        req.onload = checkJSONBody(function (data) {
                var payload = JSON.parse(data.payload);
                var sync_key = Weave.Util.PassphraseHelper.decodeKeyBase32(secure.passphrase);
                var encryption_key = Weave.Util.HtS(Weave.Util.SHA.hmac256(sync_key, HMAC_INPUT + secure.user + "\x01"));
                var hmac_key = Weave.Util.HtS(Weave.Util.SHA.hmac256(sync_key, encryption_key + HMAC_INPUT + secure.user + "\x02"));
                var hmac = Weave.Util.SHA.hmac256(hmac_key,payload.ciphertext);

            if (hmac !== payload.hmac) {
                return errback("KEY_HMAC_FAILED");
            }

            var data = JSON.parse(Weave.Crypto.AES.decrypt(
                encryption_key,
                Weave.Util.Base64.decode(payload.IV),
                Weave.Util.Base64.decode(payload.ciphertext)
            ));

            cache.keys = {};

            //cache default and collection keys
            cache.keys["default"] = [Weave.Util.Base64.decode(data.default[0]),Weave.Util.Base64.decode(data.default[1])];

            for(var i in data.collections) {
                var keyPair = data.collections[i];
                cache.keys[i] = [Weave.Util.Base64.decode(keyPair[0]),Weave.Util.Base64.decode(keyPair[1])];
            }
            callback();
        }, errback);
        req.send();
    }

    function ensureKeys (callback, errback) {
        if (cache.keys) {
            callback();
            return;
        }
        getKeys(callback, errback);
    }

    function ensureClientGUID (callback, errback) {
        //TODO make sure that secure.client.id etc.exists
        loadCollection('clients', {}, function (data) {
            if (data.indexOf(secure.client.id) !== -1) {
                // We've already got an entry in the 'clients' collection!
                //XXX should we update the 'modified' property?
                callback();
                return;
            }

            // We haven't got an entry in the 'clients' collection, so
            // let's make one.
            data = [secure.client];
            encryptPostCollection("clients", data, function (status) {
                //TODO examine status.success, status.failed
                callback();
            }, errback);
        }, errback);
    }

    function getBulkKey (collection, callback, errback) {
        callback(cache.keys[collection] || cache.keys['default']);
    }

    function decryptWBO (wbo, callback, errback) {
        var payload = JSON.parse(wbo.payload);
        getBulkKey(wbo.collection, function (keypair) {
            var enc_key = keypair[0];
            var hmac_key = keypair[1];

            // Check whether the data has been tampered with by
            // comparing the HMAC hash.  They key used for this is the
            // bulk key, the data is the encrypted payload, both (!)
            // in base64 encoding.
            var hmac = Weave.Util.SHA.hmac256(hmac_key,payload.ciphertext);
            if (hmac !== payload.hmac) {
                return errback("WBO_HMAC_FAILED", wbo);
            }

            var data = Weave.Crypto.AES.decrypt(
                enc_key,
                Weave.Util.Base64.decode(payload.IV),
                Weave.Util.Base64.decode(payload.ciphertext)
            );

            var data = JSON.parse(UTF8.decode(data));
            for (var key in data) {
                wbo[key] = data[key];
            }
            callback(wbo);
        }, errback);
    }

    //TODO perhaps instead of the collection parameter, require
    // wbo.collection to exist
    function encryptWBO (wbo, collection, callback, errback) {
        //TODO check that secure.storageUrl etc. exist
        var keyUri = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                     "/storage/crypto/keys";
        //TODO check that object_fields[collection] exists
        var cleartext = UTF8.encode(JSON.stringify(wbo, object_fields[collection]));
        getBulkKey(collection, function (keypair) {
            var enc_key = keypair[0];
            var hmac_key = keypair[1];
            var iv = Weave.Util.randomBytes(16);
            var ciphertext = Weave.Util.Base64.encode(
                Weave.Crypto.AES.encrypt(enc_key, iv, cleartext));
                var hmac = Weave.Util.SHA.hmac256(hmac_key, ciphertext);
                wbo.payload = JSON.stringify({ciphertext: ciphertext,
                                          IV: Weave.Util.Base64.encode(iv),
                                          hmac: hmac});
            callback(wbo);
        }, errback);
    }

    function loadCollection (collection, options, callback, errback) {
        if (secure.storageUrl === undefined) {
            return errback("MISSING_STORAGEURL");
        }

        // Assemble query string from 'options'
        var query = [];
        for (var key in options) {
            query.push(key + '=' + (options[key] || ''));
        }
        if (query.length) {
            query = '?' + query.join('&');
        }
        var url = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                  "/storage/" + collection + query;
        var req = createRequest("GET", url, errback);
        req.onload = checkJSONBody(callback, errback);
        req.send();
    }

    function postCollection (collection, data, callback, errback) {
        if (secure.storageUrl === undefined) {
            return errback("MISSING_STORAGEURL");
        }
        var url = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                  "/storage/" + collection;
        var req = createRequest("POST", url, errback);
        req.onload = checkJSONBody(callback, errback);

        // We must not simply JSON.stringify(data), we only want to
        // send the allowed fields of each WBO.
        data = "[" + data.map(serializeWBO).join(",") + "]";
        req.send(data);
    }

    //TODO errback-ify this
    function loadWBO (collection, id, callback) {
        //TODO check that secure.storageUrl is set
        var url = secure.storageUrl + "/1.0/" + hashUserName(secure.user) +
                  "/storage/" + collection + "/" + id + "?full=1";

        var req = createRequest("GET", url);
        req.onload = function () {
            callback(JSON.parse(req.responseText));
        };
        req.send();
    }

    function loadCollectionDecrypt (collection, options, callback, errback) {
        loadCollection(collection, options, function (data) {
            if (!data.length) {
                callback(data);
                return;
            }

            var count = 0;
            data.forEach(function (wbo) {
                wbo.collection = collection;
                decryptWBO(wbo, function (wbo) {
                    count += 1;
                    if (count === data.length) {
                        callback(data);
                    }
                }, errback);
            });
        }, errback);
    }

    function encryptPostCollection (collection, data, callback, errback) {
        var count = 0;
        if(data.length===0) callback({success:true});
        data.forEach(function (wbo) {
            encryptWBO(wbo, collection, function (wbo) {
                count += 1;
                if (count === data.length) {
                    postCollection(collection, data, callback);
                }
            }, errback);
        });
    }


    // Initialize the client by passing in an options object.  The
    // client may store security sensitive data on this object, so
    // whoever is calling connect() can hold a reference to it if
    // running in a safe environment and long-term caching is wanted
    // (e.g. in a browser extension).
    function connect (options) {
        if (secure !== undefined) {
            throw "ALREADY_CONNECTED";
        }
        if (options.server === undefined) {
            throw "MISSING_SERVER";
        }
        if ((options.user === undefined) || (options.password === undefined)) {
            throw "MISSING_CREDENTIALS";
        }
        secure = options;
        cache = {};
    }

    function disconnect () {
        secure = undefined;
        cache = undefined;
    }

    return {
        // Synchronous operations (no callbacks)
        connect: connect,
        disconnect: disconnect,
        // All of these are asynchronous as they may talk to the server
        getUserStorageNode: getUserStorageNode,
        ensureUserStorageNode: ensureUserStorageNode,
        ensureClientGUID: ensureClientGUID,
        getKeys: getKeys,
        ensureKeys: ensureKeys,
        loadCollection: loadCollection,
        postCollection: postCollection,
        loadWBO: loadWBO,
        loadCollectionDecrypt: loadCollectionDecrypt,
        encryptPostCollection: encryptPostCollection,
        encryptWBO: encryptWBO,
        decryptWBO: decryptWBO,
        // Some private helper methods we expose for unit testing
        getBulkKey: getBulkKey,

        default_options: {
            client: null,  // object with id, name, type
            server: "https://auth.services.mozilla.com",
            storageUrl: null,
            storageUrlOverrides: false,
            user: null,
            password: null,
            passphrase: null
        }
    };

}());
