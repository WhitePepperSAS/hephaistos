const { promisify } = require('util')
const parser = new (require('xml2js')).Parser({ attrkey: '__' })
const xmlParseString = promisify(parser.parseString)

/**
 * @typedef {Object} TestResult
 * @prop {String} file
 * @prop {Number} line
 * @prop {String} name
 * @prop {Number} time
 * @prop {Object} failure
 * @prop {String} failure.stacktrace
 * @prop {String} failure.message
 */

/**
 * @typedef {Object} TestSuite
 * @prop {Object} stats
 * @prop {Number} stats.errors
 * @prop {Number} stats.failures
 * @prop {Number} stats.skipped
 * @prop {Number} stats.tests
 * @prop {Number} stats.time
 * @prop {String} stats.timestamp
 * @prop {TestResult[]} tests
 */

/**
 * @typedef {Object} APIResult
 * @prop {String} stdout
 * @prop {String} stderr
 * @prop {TestSuite} result
 */

/**
 * simplifies and clarifies the output json from the xml extract
 * @returns { TestSuite }
 */
function normalize (xml) {
  if (!xml.testsuites || !xml.testsuites.testsuite.length) return {}
  const testsuite = xml.testsuites.testsuite[0]
  const stats = testsuite.__

  return {
    stats: {
      errors: parseInt(stats.errors),
      failures: parseInt(stats.failures),
      skipped: parseInt(stats.skipped),
      tests: parseInt(stats.tests),
      time: parseFloat(stats.time),
      timestamp: stats.timestamp
    },
    tests: testsuite.testcase.map(t => {
      let failure
      if (t.failure && t.failure.length) {
        failure = {
          stacktrace: t.failure[0]._,
          message: t.failure[0].__.message
            .replace(/AssertionError: /g, '')
            .replace(/assert.*/, '')
            .replace(/([^\n\r\t ])[\n\r\t ]*$/, '$1')
        }
      }
      return {
        file: t.__.file,
        line: parseInt(t.__.line),
        name: t.__.name,
        time: parseFloat(t.__.time),
        failure: failure
      }
    })
  }
}

/**
 * @param {String} string
 * @returns {Promise<TestSuite>}
 */
async function XMLFileToJson (string) {
  const parsedXml = await xmlParseString(string)
  return normalize(parsedXml)
}

module.exports = XMLFileToJson
