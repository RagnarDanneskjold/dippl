"use strict";

var util = require("../assets/js/util.js");
var _ = require('../assets/vendor/underscore/underscore.js');
var runWebPPL = require('../assets/js/run-wppl.js');
var compileWebPPLProgram = runWebPPL.compileWebPPLProgram;
var runWebPPLProgram = runWebPPL.runWebPPLProgram;
var topK = runWebPPL.topK;

var testHistsApproxEqual = function(test, hist, expectedHist, tolerance){
  _.each(expectedHist,
         function(expectedValue, key){
           var value = hist[key];
           test.ok(Math.abs(value - expectedValue) <= tolerance);
         });
};

var runSamplingTest = function(test, code, expectedHist, numSamples, tolerance){
  var hist = {};
  topK = function(value){
        hist[value] = hist[value] || 0;
        hist[value] += 1;
  };
  var compiledProgram = compileWebPPLProgram(code);
  for (var i=0; i<numSamples; i++){
    eval(compiledProgram);
  }
  var normHist = util.normalize(hist);
  testHistsApproxEqual(test, normHist, expectedHist, tolerance);
  test.done();
};

var runDistributionTest = function(test, code, expectedHist, tolerance){
  var hist = {};
  topK = function(erp){
    _.each(
      erp.support(),
      function (value){
        hist[value] = Math.exp(erp.score([], value));
      });
  };
  runWebPPLProgram(code, topK);
  var normHist = util.normalize(hist);
  testHistsApproxEqual(test, normHist, expectedHist, tolerance);
  test.done();
};

exports.testDeterministic = {
  testApplication: function (test) {
    var code = "plus(3, 4)";
    var expectedHist = {7: 1};
    var tolerance = 0.0001; // in case of floating point errors
    return runSamplingTest(test, code, expectedHist, 1, tolerance);
  }
};

exports.testForwardSampling = {
  testApplication: function (test) {
    var code = "and(flip(.5), flip(.5))";
    var expectedHist = {
      "true": .25,
      "false": .75
    };
    var tolerance = .05;
    var numSamples = 1000;
    return runSamplingTest(test, code, expectedHist, numSamples, tolerance);
  }
};

exports.testEnumeration = {
  test1: function(test){
    var code = ("var e = cache(function (x){" +
                "    return Enumerate(function() {" +
                "                     var a = and(flip(0.5),flip(0.5));" +
                "                     factor(a? 2 : callPrimitive(Math.log, 0.3));" +
                "                     return and(a,x);" +
                "                     });});" +
                "" +
                "Enumerate(function(){" +
                "          var e1 = sample(e(true));" +
                "          var e2 = sample(e(true));" +
                "            return and(e1,e2);" +
                "          });");
    // TODO: Check that the expected hist is correct
    var expectedHist = {
      "true": 0.8914231018274679,
      "false": 0.10857689817253217
    };
    var tolerance = .0001;
    runDistributionTest(test, code, expectedHist, tolerance);
  }
};

exports.testParticleFilter = {
  test1: function(test){
    var code = ("ParticleFilter(" +
                "  function(){" +
                "    var x = flip(0.5);" +
                "    var y = flip(0.5);" +
                "    factor(or(x, y) ? 0 : minusInfinity);" +
                "    return x;" +
                "  }," +
                "  300) // particles");
    var expectedHist = {
      "true": 2/3,
      "false": 1/3
    };
    var tolerance = .1;
    runDistributionTest(test, code, expectedHist, tolerance);
  }
};
