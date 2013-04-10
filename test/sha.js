// Aux functions

function repeated (byte, number) {
    var r = "";
    for (var i=0; i < number; i++) {
        r += String.fromCharCode(byte);
    }
    return r;
}

function make_sha_test (testcase, hmacfunc) {
    return function () {
        equals(testcase.key.length, testcase.key_len, "Verify key length");
        equals(testcase.data.length, testcase.data_len, "Verify data length");
        equals(hmacfunc(testcase.key, testcase.data),
               testcase.digest, "Verify digest");
    }
}


// See RFC 2202, Section 3
module("Weave.Util.SHA.hmac1 (rfc2202)");

var rfc2202 = [
    {test_case:     1,
     key:           Weave.Util.HtS("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
     key_len:       20,
     data:          "Hi There",
     data_len:      8,
     digest:        "b617318655057264e28bc0b6fb378c8ef146be00"},

    {test_case:     2,
     key:           "Jefe",
     key_len:       4,
     data:          "what do ya want for nothing?",
     data_len:      28,
     digest:        "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"},

    {test_case:     3,
     key:           Weave.Util.HtS("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
     key_len:       20,
     data:          repeated(0xdd, 50),
     data_len:      50,
     digest:        "125d7342b9ac11cd91a39af48aa17b4f63f175d3"},

    {test_case:     4,
     key:           Weave.Util.HtS("0102030405060708090a0b0c0d0e0f10111213141516171819"),
     key_len:       25,
     data:          repeated(0xcd, 50),
     data_len:      50,
     digest:        "4c9007f4026250c6bc8414f9bf50c86c2d7235da"},

    {test_case:     5,
     key:           Weave.Util.HtS("0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c"),
     key_len:       20,
     data:          "Test With Truncation",
     data_len:      20,
     digest:        "4c1a03424b55e07fe7f27be1d58bb9324a9a5a04",
     digest_96:     "4c1a03424b55e07fe7f27be1"},

    {test_case:     6,
     key:           repeated(0xaa, 80),
     key_len:       80,
     data:          "Test Using Larger Than Block-Size Key - Hash Key First",
     data_len:      54,
     digest:        "aa4ae5e15272d00e95705637ce8a3b55ed402112"},

     {test_case:     7,
      key:           repeated(0xaa, 80),
      key_len:       80,
      data:          "Test Using Larger Than Block-Size Key and Larger Than One Block-Size Data",
      data_len:      73,
      digest:        "e8e99d0f45237d786d6bbaa7965c7808bbff1a91"},

     {test_case:     7.1,
      key:           repeated(0xaa, 80),
      key_len:       80,
      data:          "Test Using Larger Than Block-Size Key and Larger Than One Block-Size Data".substr(0, 20),
      data_len:      20,
      digest:        "4c1a03424b55e07fe7f27be1d58bb9324a9a5a04",
      digest_96:     "4c1a03424b55e07fe7f27be1"},
];

for (var i=0; i < rfc2202.length; i++) {
    test("test_case = " + rfc2202[i].test_case,
         make_sha_test(rfc2202[i], Weave.Util.SHA.hmac1));
}


// See RFC 4231, Section 4
module("Weave.Util.SHA.hmac256 (rfc4231)");

var rfc4231 = [
    {test_case:     1,
     key:           Weave.Util.HtS("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
     key_len:       20,
     data:          "Hi There",
     data_len:      8,
     digest:        "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"},

    // Test with a key shorter than the length of the HMAC output.
    {test_case:     2,
     key:           "Jefe",
     key_len:       4,
     data:          "what do ya want for nothing?",
     data_len:      28,
     digest:        "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"},

    // Test with a combined length of key and data that is larger than 64
    // bytes (= block-size of SHA-224 and SHA-256).
    {test_case:     3,
     key:           Weave.Util.HtS("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
     key_len:       20,
     data:          repeated(0xdd, 50),
     data_len:      50,
     digest:        "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe"},

    // Test with a combined length of key and data that is larger than 64
    // bytes (= block-size of SHA-224 and SHA-256).
    {test_case:     4,
     key:           Weave.Util.HtS("0102030405060708090a0b0c0d0e0f10111213141516171819"),
     key_len:       25,
     data:          repeated(0xcd, 50),
     data_len:      50,
     digest:        "82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b"},

    // Test with a truncation of output to 128 bits.
    {test_case:     5,
     key:           Weave.Util.HtS("0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c"),
     key_len:       20,
     data:          "Test With Truncation",
     data_len:      20,
     digest:        "a3b6167473100ee06e0c796c2955552bfa6f7c0a6a8aef8b93f860aab0cd20c5",
     digest_128:    "a3b6167473100ee06e0c796c2955552b"},

    // Test with a key larger than 128 bytes (= block-size of SHA-384 and
    // SHA-512).
    {test_case:     6,
     key:           repeated(0xaa, 131),
     key_len:       131,
     data:          "Test Using Larger Than Block-Size Key - Hash Key First",
     data_len:      54,
     digest:        "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"},

    // Test with a key and data that is larger than 128 bytes (= block-size
    // of SHA-384 and SHA-512).
    {test_case:     7,
     key:           repeated(0xaa, 131),
     key_len:       131,
     data:          "This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.",
     data_len:      152,
     digest:        "9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2"}
];

for (var i=0; i < rfc4231.length; i++) {
    test("test_case = " + rfc4231[i].test_case,
         make_sha_test(rfc4231[i], Weave.Util.SHA.hmac256));
}
