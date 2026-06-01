function runUtilTests() {
  testFormatCurrency();
  testEscapeRegex();
  Logger.log('✅ All util tests passed.');
}

function testFormatCurrency() {
  var cases = [
    { input: 1234.5,   expected: '$1,234.50'  },
    { input: 0,        expected: '$0.00'       },
    { input: 99999.99, expected: '$99,999.99'  },
    { input: null,     expected: ''            },
  ];
  cases.forEach(function(c) {
    var result = formatCurrency(c.input);
    if (result !== c.expected) {
      throw new Error('formatCurrency(' + c.input + '): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testFormatCurrency passed');
}

function testEscapeRegex() {
  var cases = [
    // < > are not regex special chars — should pass through unchanged
    { input: '<<pay_terms>>',  expected: '<<pay_terms>>'       },
    // { } ARE special regex chars — should be escaped
    { input: '{{MARKER}}',     expected: '\\{\\{MARKER\\}\\}'  },
    { input: 'plain text',     expected: 'plain text'           },
    // $ and . are special regex chars — should be escaped
    { input: '$100.00',        expected: '\\$100\\.00'          },
  ];
  cases.forEach(function(c) {
    var result = escapeRegex(c.input);
    if (result !== c.expected) {
      throw new Error('escapeRegex("' + c.input + '"): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testEscapeRegex passed');
}
