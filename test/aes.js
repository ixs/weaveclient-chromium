module("Weave.Crypto.AES");

var key = Weave.Util.randomBytes(32);
var iv = Weave.Util.randomBytes(16);

function check_roundtrip (data) {
    var ciphertext = Weave.Crypto.AES.encrypt(key, iv, data);
    var cleartext = Weave.Crypto.AES.decrypt(key, iv, ciphertext);
    equals(cleartext, data, "Verify data survives roundtrip");
}

test("Roundtrip multiple of 16", function () {
    var data = "Always late, but worth the wait!";
    equals(data.length, 32, "Verify data length is multiple of 16");
    check_roundtrip(data);
});

test("Roundtrip multiple of 16 minus 1", function () {
    var data = "Always late, but worth the wait";
    equals(data.length, 31, "Verify data length is multiple of 16 minus 1");
    check_roundtrip(data);
});

test("Roundtrip not multiple of 16", function () {
    var data = "Always late but worth the wait";
    equals(data.length, 30, "Verify data length isn't multiple of 16");
    check_roundtrip(data);
});
