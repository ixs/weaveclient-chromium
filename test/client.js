function networkErrorHandler (request) {
    request.err("NETWORK_ERR");
}

function expectNetworkError (method, path) {
    return function (error, request) {
        equals(error, "REQUEST_ERROR", "Received correct error");
        equals(request.method, method, "Correct request method");
        equals(request.urlParts.path, path, "Correct request path");
    };
}

function notFoundHandler (request) {
    request.receive(404, "Not Found");
}

function expectNotFound (method, path) {
    return function (error, request) {
        equals(error, "HTTP_STATUS_ERROR", "Received correct error");
        equals(request.status, 404, "Correct request status");
        equals(request.method, method, "Correct request method");
        equals(request.urlParts.path, path, "Correct request path");
    };
}


/*
 * Weave.Client.connect()
 */
(function () {
    var options;

    function setup () {
        options = {server: "http://weave",
                   user: "test",
                   password: "test"};
    }

    function teardown () {
        options = undefined;
        Weave.Client.disconnect();
    }

    module("Weave.Client.connect", {setup: setup, teardown: teardown});

    test("calling twice fails", function () {
        Weave.Client.connect(options);
        catches("ALREADY_CONNECTED", function () {
            Weave.Client.connect(options);
        });
    });

    test("missing server", function () {
        delete options.server;
        catches("MISSING_SERVER", function () {
            Weave.Client.connect(options);
        });
    });

    test("missing credentials", function () {
        delete options.user;
        delete options.password;
        catches("MISSING_CREDENTIALS", function () {
            Weave.Client.connect(options);
        });
    });
}());


/*
 * Weave.Client.ensureStorageNode()
 */
(function () {
    var options, server, callback, errback;

    function setup () {
        server = new MockHttpServer();
        server.start();

        options = {server: "http://weave",
                   user: "test",
                   password: "test"};
        Weave.Client.connect(options);

        callback = countCalls();
        errback = countCalls();
    }

    function teardown () {
        Weave.Client.disconnect();
        server.stop();
        options = undefined;
        server = undefined;
        callback = undefined;
        errback = undefined;
    }

    module("Weave.Client.ensureStorageNode",
           {setup: setup, teardown: teardown});

    test("retrieve from server", function () {
        server.handle = function (request) {
            equals(request.url, "http://weave/user/1.0/test/node/weave");
            request.receive(200, "http://weave.storage.node");
        };
        Weave.Client.ensureUserStorageNode(callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once.");
        equals(errback.callCount, 0, "Errback not called");
        equals(options.storageUrl, "http://weave.storage.node");
    });

    test("network error", function () {
        server.handle = networkErrorHandler;
        errback = countCalls(
            expectNetworkError("GET", "/user/1.0/test/node/weave"));
        Weave.Client.ensureUserStorageNode(callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("fallback", function () {
        server.handle = notFoundHandler;
        Weave.Client.ensureUserStorageNode(callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
        equals(options.storageUrl, options.server);
    });

    test("storageUrl already set", function () {
        server.handle = countCalls();
        options.storageUrl = "http://weave.storage.node";
        Weave.Client.ensureUserStorageNode(callback, errback);

        equals(server.handle.callCount, 0,
               "Server must not be contacted since storageUrl is already set");
        equals(callback.callCount, 1, "Callback called exactly once.");
        equals(errback.callCount, 0, "Errback not called");
        equals(options.storageUrl, "http://weave.storage.node");
    });
}());


/*
 * Weave.Client.loadCollection()
 */
(function () {
    var options, server, callback, errback;

    function setup () {
        server = new MockHttpServer();
        server.start();

        options = {server: "http://weave",
                   user: "test",
                   password: "test",
                   storageUrl: "http://weave"};
        Weave.Client.connect(options);

        callback = countCalls();
        errback = countCalls();
    }

    function teardown () {
        Weave.Client.disconnect();
        server.stop();
        options = undefined;
        server = undefined;
        callback = undefined;
        errback = undefined;
    }

    module("Weave.Client.loadCollection", {setup:setup, teardown: teardown});

    test("missing storageUrl", function () {
        server.handle = notFoundHandler;
        errback = countCalls(function (error) {
            equals(error, "MISSING_STORAGEURL", "Received correct error");
        });
        delete options.storageUrl;
        Weave.Client.loadCollection("foobar", {}, callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("network error", function () {
        server.handle = networkErrorHandler;
        errback = countCalls(
            expectNetworkError("GET", "/1.0/test/storage/foobar"));
        Weave.Client.loadCollection("foobar", {}, callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("HTTP status error (404)", function () {
        server.handle = notFoundHandler;
        errback = countCalls(expectNotFound("GET", "/1.0/test/storage/foobar"));
        Weave.Client.loadCollection("foobar", {}, callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("receive invalid JSON payload", function () {
        server.handle = function (request) {
            request.receive(200, "I am bender, please insert girder!");
        };
        errback = countCalls(function (error, exception, data) {
            equals(error, "JSON_ERROR", "Received correct error");
            equals(data, "I am bender, please insert girder!");
        });
        Weave.Client.loadCollection("foobar", {}, callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("receive valid JSON payload", function () {
        server.handle = function (request) {
            ok(request.urlParts.path, "http://weave/1.0/test/storage/foobar",
               "Request URL correct");
            ok(request.authenticate("test", "test"), "Authenticated request");
            request.receive(200, '[{"id":"bender"},{"id":"rodriguez"}]');
        };
        callback = countCalls(function (data) {
            same(data, [{id: "bender"}, {id: "rodriguez"}]);
        });
        Weave.Client.loadCollection("foobar", {}, callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
    });

    test("options", function () {
        var loadoptions = {full: undefined,
                           sort: "newest",
                           newer: 123456};
        server.handle = function (request) {
            ok(request.urlParts.path, "http://weave/1.0/test/storage/foobar",
               "Request URL correct");
            same(request.urlParts.queryKey,
                 {full: "", sort: "newest", newer: "123456"},
                 "Options sent as query string");
            ok(request.authenticate("test", "test"), "Authenticated request");
            request.receive(200, '[]');
        };
        Weave.Client.loadCollection("foobar", loadoptions, callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
    });
}());


/*
 * Weave.Client.postCollection()
 */
(function () {
    var options, server, callback, errback;

    function setup () {
        server = new MockHttpServer();
        server.start();

        options = {server: "http://weave",
                   user: "test",
                   password: "test",
                   storageUrl: "http://weave"};
        Weave.Client.connect(options);

        callback = countCalls();
        errback = countCalls();
    }

    function teardown () {
        Weave.Client.disconnect();
        server.stop();
        options = undefined;
        server = undefined;
        callback = undefined;
        errback = undefined;
    }

    module("Weave.Client.postCollection", {setup:setup, teardown: teardown});

    test("missing storageUrl", function () {
        server.handle = notFoundHandler;
        errback = countCalls(function (error) {
            equals(error, "MISSING_STORAGEURL", "Received correct error");
        });
        delete options.storageUrl;
        Weave.Client.postCollection("foobar", [], callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("network error", function () {
        server.handle = networkErrorHandler;
        errback = countCalls(
            expectNetworkError("POST", "/1.0/test/storage/foobar"));
        Weave.Client.postCollection("foobar", [], callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("HTTP status error (404)", function () {
        server.handle = notFoundHandler;
        errback = countCalls(
            expectNotFound("POST", "/1.0/test/storage/foobar"));
        Weave.Client.postCollection("foobar", [], callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("receive invalid JSON payload", function () {
        server.handle = function (request) {
            request.receive(200, "I am bender, please insert girder!");
        };
        errback = countCalls(function (error, exception, data) {
            equals(error, "JSON_ERROR", "Received correct error");
            equals(data, "I am bender, please insert girder!");
        });
        Weave.Client.postCollection("foobar", [], callback, errback);

        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("send and receive valid JSON payload", function () {
        server.handle = function (request) {
            ok(request.urlParts.path, "http://weave/1.0/test/storage/foobar",
               "Request URL correct");
            ok(request.authenticate("test", "test"), "Authenticated request");
            same(JSON.parse(request.requestText),
                 [{id: "bender"}, {id: "rodriguez"}],
                 "Valid JSON is sent");
            request.receive(200, '["bender", "rodriguez"]');
        };
        callback = countCalls(function (data) {
            same(data, ["bender", "rodriguez"]);
        });
        var wbos = [{id: "bender"}, {id: "rodriguez"}];
        Weave.Client.postCollection("foobar", wbos, callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
    });

    test("send only valid WBO fields", function () {
        server.handle = function (request) {
            ok(request.urlParts.path, "http://weave/1.0/test/storage/foobar",
               "Request URL correct");
            ok(request.authenticate("test", "test"), "Authenticated request");
            same(JSON.parse(request.requestText),
                 [{id: "bender", modified: 123},
                  {id: "rodriguez", modified: 456}],
                 "Invalid WBO fields are omitted");
            request.receive(200, '["bender", "rodriguez"]');
        };
        callback = countCalls(function (data) {
            same(data, ["bender", "rodriguez"]);
        });
        var wbos = [{id: "bender",
                     modified: 123,
                     secret: "bite my shiny metal a**"},
                    {id: "rodriguez",
                     modified: 456,
                     cleartext: "hey meatbag!"}];
        Weave.Client.postCollection("foobar", wbos, callback, errback);

        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
    });
}());


/*
 * Weave.Client.ensureKeys(), getBulkKey()
 */
(function () {
    // Key pair generated by the Weave Firefox extension.
    var passphrase = "weaveisawesome";
    var privkey = {
        type: "privkey",
        publicKeyUri: "http://weave/1.0/test/storage/keys/pubkey",
        salt: "90ns++2VhPZS3Mz8U88v3w==",
        iv: "uqi8ptbYyK5To8xu3DvNUw==",
        keyData: "LgVKtTmso0/Lg4yskmRgr39FfRTzv1bPSYl/I21d/QfoRqPrD5MsMqe8mkPVVc1R/9Vlre+vj0fQXk/9MMuMXosyJS9r0N45o9ae1IL4CWfx699EVAc7CcAggCDuUxd90/kBzJCNzHRLXeDq1+huJHCWffB7t2VyWDpfN/Rm/GdScY/noB9hLhz8ssoMvRKzNh10kB9SWmgUoMmPWvYv5nxu+iOh/pq7EKDsg09Qwq13eNhn9955ySw+qf0smX5HKFC+DDoTAK+62WjrXrWJZ9mn80R9xfBUYy3glz/CD0G3ODDN4BAi6JpTxkCCDGQYXagWmm8VLIWQl8XsoHnc/riL5EGV1fW9fh//CjxAI+N5+R11pHhL/zFHT6bFo16wrT/fmtWCeltXocEgT5Npb2LlNXMLVX8WFb6X12X9ImXT1BkEzwgSBL8I3JKTm/Okl185ZiaFFvwg/0twuDfZpLrlpKzJujs8fXPmJ/DJL+JTu42Xl3scsMP23o4KGWZH8nhpqn8OeBRG0BAdJmORT+3jfIYXISs3y2wQqmjOhXn2/H7vhpuCHSPODfqIW5BRDq5/F9P25VIJxOaj/8xQ3cx2QjH+hfsayDpXDvUw6tWd8LgELzTVNPTrzoTbw34JJQtwLlRF0M5ILv5/WA5nnGXmNj4zU1C9TR7Zt7ehXhn3cr3Y926OhfOSIpyGQlm3l31oA8DMdHPhNX2Ho42/h0ZbZE4dI2ZsatX63Tnx1a6JDz3n50L1d5+7/41wRz8T3AangHWjrQclVrNMn5PHL2cO6uMPwX4TLgnCpZWXI8tDx9QNhsuCgBwp7tCvUnIImgLjIZNWp63AP10K072IVnAiVLiRW64oYaPrmnM3sOvAcU5voue/PnZUDJfbAREPi70cUrZ/hEzi6/b2O1/Nprm5QFlaJ7KQa49MjWpIqc6AGWPv8YbKNoTPOHWvKffNHpc2HvUCwRUyOdzBBwJUKleywGmbOUyUnkw9qbTVy8oYUOngx4BGRFnUm3I+a/va5HYMKnUn5zXs6Z0p/qJdUpbihKOskBkQtEUyQWVpRZSOkgesJWDJRvAuST5+c3LGP6EzewxOGH16FAgBnOoxbSZfjW27KCkePn3wh3hZX/WsWk0mpyrJRysLuxPyEy3LSawIJFbqH09zTIMjNcdq9NAzxRm0aD4/IuzwsGpZ1BV6orvkY/XGrVS2dTSXKHN5qVyCaI0RAPyNA3pVqJnmTi1hGUqCeJBb/tZ8tC/yWmvF8oU7gm6OU6rCeKLCHEHmAqHPsCBTtCzb5ZMwRuke9dLPKF7ZR0xh8/Ww97a4Lld2ene/ZC3puZZeEQLqYc2kVqgB6ZO2gskH5OWXDsG73Ts1/QT7fUk6e87F0Ce8oivhTzgEuMrMPxcL/VjRic3yxuyu/zxmsrgPCaoB5KO6pK13AlausXv06Plrb1Q1mswEQxAn3OGCCOzlavpty9WVqDboec1NfkLMqoqy+b79AlP/XEN0jE2/HZaitFY9f5iNkNdCUkv3YQeTTDMKlbgG0zabTOjZKTuVbtmRQuUNNuL9mIMd2pam/DqVt8m4vS5buufEfVDgG/LE8tvlTCShHhrujzKiioYVKkHCFyom58QIoXJYEurYYu4UkFSj2hI="
    };
    var pubkey = {
        type: "pubkey",
        privateKeyUri: "http://weave/1.0/test/storage/keys/privkey",
        keyData: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqTVlqxvCx+klURBxYzcyAxsZtAGw4UJncBQdARngzDwJwyPfgl/kFH7esWeEBlryW6vBNFHiTRCP3Zgk31R9oCoJQDlUq6aRSy+bc6yXwutIa8A9PAbTK+CxsLzZ7ot0DZtxzpAnSVtcn6YRm8zQ6pqaH6lyMPSMr3NPvfM1xGlaKaKwXI3nXaNvh1eSIfXIQpaxZtiwqlT+pgAtA9yO6dsLlptXi5tk9eGs+DcmbjjT/ZUt5+aqf6YLx5aMmLvXUafySYeIj2D5V+MkRvvRXq8Zh94gV39EAalpnZsdAobQttIknD7ma4vBC652I6GSsstykn/ui4SPUC+LYQUOGwIDAQAB"
    };

    // Symmetric bulk key wrapped with the user's public key by the
    // Weave Firefox extension.
    var symkey = "auQ3UfvRPDNib96tzDa09gG9UPGPVVS9ZcTVmmvbKII=";
    var wrappedkey = {
        wrapped: "eAOezhOXvsjluakELfc+yZogPNY7HQZPgvkst1wwMRa/+CBmYtdVskPn4AETwwSrUs8V8J0+h87kpO/viTZkSKwIEY6x4eyAn/sRDPFo+qi4Vsus3Iu4GCRguIJ45yFUcxIVxs+zvaiIfYk/BrcUOEZBb7ukMn7gWO89vKBymOtE9GjWdxVePDhGI7vPjF2KfrOqLLQn0KiL65OdjRAaAq+QzPpw8c+Kpefb5dSlKqHHkZRSmSCD9RsBgkR/IEtp65o20amyWGLTw4X9uiXdDGJw+WBBL/tP/qcWDf0aYyedGafxQ/2pRh3h95Eri/wbs/v0nUgzsKa6cJ6+rIPN1A==",
        hmac: "e957053d18d397ff0e6da96d706bc6037c964fa636b83a03ffeb04d415c5177d"
    };

    var options, server, callback, errback;

    function setup () {
        server = new MockHttpServer();
        server.start();

        options = {server: "http://weave",
                   user: "test",
                   password: "test",
                   storageUrl: "http://weave",
                   passphrase: passphrase,
                   privkey: privkey,
                   pubkey: pubkey};
        Weave.Client.connect(options);

        callback = countCalls();
        errback = countCalls();
    }

    function teardown () {
        Weave.Client.disconnect();
        server.stop();
        options = undefined;
        server = undefined;
        callback = undefined;
        errback = undefined;
    }


    module("Weave.Client.ensureKeys",
           {setup: setup, teardown: teardown});

    test("retreive keys", function () {
        delete options.privkey;
        delete options.pubkey;
        server.handle = function (request) {
            var payload = [{id: "pubkey", payload: JSON.stringify(pubkey)},
                           {id: "privkey", payload: JSON.stringify(privkey)}];
            request.receive(200, JSON.stringify(payload));
        };
        Weave.Client.ensureKeys(callback, errback);
        same(options.privkey, privkey, "Private key present");
        same(options.pubkey, pubkey, "Public key present");
        equals(callback.callCount, 1, "Callback called exactly once");
        equals(errback.callCount, 0, "Errback not called");
    });

    test("keys already present", function () {
        server.handle = countCalls();
        Weave.Client.ensureKeys(callback, errback);
        equals(server.handle.callCount, 0, "Server not contacted");
        equals(callback.callCount, 1, "Callback called exactly once.");
        equals(errback.callCount, 0, "Errback not called");
    });


    module("Weave.Client.unwrapSymmetricKey",
           {setup: setup, teardown: teardown});

    test("unwrap key", function () {
        var bulkkey = Weave.Client.unwrapSymmetricKey(wrappedkey.wrapped);
        equals(Weave.Util.Base64.encode(bulkkey), symkey,
               "Bulk key unwrapped and decrypted correctly.");
    });

    test("invalid passphrase", function () {
        options.passphrase = "weavesux";
        catches("WRONG_PASSPHRASE", function () {
            var bulkkey = Weave.Client.unwrapSymmetricKey(wrappedkey.wrapped);
        });
    });


    module("Weave.Client.getBulkKey",
           {setup: setup, teardown: teardown});

    test("network error", function () {
        server.handle = networkErrorHandler;
        errback = countCalls(
            expectNetworkError("GET", "/1.0/test/storage/crypto/robots"));
        Weave.Client.getBulkKey("http://weave/1.0/test/storage/crypto/robots",
                                callback, errback);
        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once");
    });

    test("HTTP status error (404)", function () {
        server.handle = notFoundHandler;
        errback = countCalls(
            expectNotFound("GET", "/1.0/test/storage/crypto/robots"));
        Weave.Client.getBulkKey("http://weave/1.0/test/storage/crypto/robots",
                                callback, errback);
        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once.");
    });

    test("receive invalid JSON payload", function () {
        server.handle = function (request) {
            request.receive(200, "I am bender, please insert girder!");
        };

        errback = countCalls(function (error, exception, data) {
            equals(error, "JSON_ERROR", "Received correct error");
            equals(data, "I am bender, please insert girder!");
        });

        Weave.Client.getBulkKey("http://weave/1.0/test/storage/crypto/robots",
                                callback, errback);
        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once.");
    });

    //TODO test invalid JSON for wbo.payload

    test("retrieve and unwrap key", function () {
        server.handle = function (request) {
            var keyring = {};
            keyring[privkey.publicKeyUri] = wrappedkey;
            var payload = JSON.stringify({keyring: keyring});
            request.receive(200, JSON.stringify({payload: payload}));
        };

        callback = countCalls(function (key) {
            equals(Weave.Util.Base64.encode(key), symkey,
                   "Bulk key unwrapped and decrypted correctly");
        });

        Weave.Client.getBulkKey("http://weave/1.0/test/storage/crypto/robots",
                                callback, errback);
        equals(callback.callCount, 1, "Callback called exactly once.");
        equals(errback.callCount, 0, "Errback not called");
    });

    test("invalid HMAC", function () {
        server.handle = function (request) {
            var keyring = {};
            keyring[privkey.publicKeyUri] = {
                wrapped: wrappedkey.wrapped,
                hmac: "8642fe151ebc19e77c82ab44fc4813ce34b62dc6ab1cbf9a47d72ec27528dda6"
            };
            var payload = JSON.stringify({keyring: keyring});
            request.receive(200, JSON.stringify({payload: payload}));
        };

        errback = countCalls(function (error, uri, keywrapped) {
            equals(error, "KEY_HMAC_FAILED", "Correct error");
            equals(uri, "http://weave/1.0/test/storage/crypto/robots",
                   "Correct key URI");
        });

        Weave.Client.getBulkKey("http://weave/1.0/test/storage/crypto/robots",
                                callback, errback);
        equals(callback.callCount, 0, "Callback not called");
        equals(errback.callCount, 1, "Errback called exactly once.");
    });

    //TODO test multiple callbacks

}());


//TODO encryptWBO, decryptWBO
//TODO loadCollectionDecrypt, encryptPostCollection
//TODO ensureClientGUI
