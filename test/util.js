module("Weave.Util");

test("XOR", function () {
    var string = "Hi There";
    var array = [72, 105, 32, 84, 104, 101, 114, 101];
    var key = [157, 176, 145, 163, 186, 20, 16, 99];
    var expected = [213, 217, 177, 247, 210, 113, 98, 6];
    same(Weave.Util.XOR(string, Weave.Util.AtS(key)), expected, "As strings");
    same(Weave.Util.XOR(array, key, true), expected, "As arrays");
    equals(Weave.Util.XOR("foobar", "foo"), false, "Different lengths");
});

test("HtS, StH", function () {
    var string = "Hi There";
    var hex = "4869205468657265";
    equals(Weave.Util.StH(string), hex, "String to hex");
    equals(Weave.Util.HtS(hex), string, "Hex to string");
});

test("AtS, StA", function () {
    var string = "Hi There";
    var array = [72, 105, 32, 84, 104, 101, 114, 101];
    same(Weave.Util.StA(string), array, "String to array");
    equals(Weave.Util.AtS(array), string, "Array to string");
});

test("randomBytes", function () {
    var bytes = Weave.Util.randomBytes(1000);
    equals(bytes.length, 1000, "Length");
    bytes = Weave.Util.StA(bytes);
    ok(Math.max.apply(null, bytes) < 256, "All characters are 8bit bytes");
});

test("intify", function () {
    var currencies = "$\u20ac\u00a5\u5143";
    equals(Weave.Util.intify(currencies), "$\u00ac\u00a5\u0043");
});

test("makeGUID", function () {
    var guid = Weave.Util.makeGUID();
    equals(guid.length, 10, "Length");
});

test("makeUUID", function () {
    var uuid = Weave.Util.makeUUID();
    equals(uuid.length, 36, "Length");

    var groups = uuid.split('-');
    equals(groups.length, 5, "Number of groups");

    equals(groups[0].length, 8, "Length of group 1");
    equals(groups[1].length, 4, "Length of group 2");
    equals(groups[2].length, 4, "Length of group 3");
    equals(groups[3].length, 4, "Length of group 4");
    equals(groups[4].length, 12, "Length of group 5");

    for (var i=0; i < 5; i++) {
        equals(('000000000000' + parseInt(groups[i], 16).toString(16))
               .slice(-groups[i].length),
               groups[i], "Group " + (i+1) + " is a valid hexadecimal number.");
    }

    var timehi = groups[2][0];
    equals(timehi, "4", "Version 4 (time_hi_and_version)");

    var clockseqhi = groups[3][0];
    ok((clockseqhi == "8") || (clockseqhi == "9")
       || (clockseqhi == "a") || (clockseqhi == "b"),
       "Version 4 (clock_seq_hi)");
});


// See RFC 4648, Section 10
module("Weave.Util.Base64 (rfc4648)");

var base64_test_vectors = {
    "f": "Zg==",
    "fo": "Zm8=",
    "foo": "Zm9v",
    "foob": "Zm9vYg==",
    "fooba": "Zm9vYmE=",
    "foobar": "Zm9vYmFy"
};

function make_base64_test (raw, base64) {
    return function () {
        equals(Weave.Util.Base64._encode(raw), base64, "Encode");
        equals(Weave.Util.Base64._decode(base64), raw, "Decode");
    };
}

test("Empty string", function () {
    equals(Weave.Util.Base64._encode(""), "", "Encode empty string");
    equals(Weave.Util.Base64._decode(""), "", "Decode empty string");
});

for (var raw in base64_test_vectors) {
    test("String of length " + raw.length,
         make_base64_test(raw, base64_test_vectors[raw]));
}
