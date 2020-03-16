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
  const testcases = []
  let stats
  let newStats
  for (let i = 0; i < xml.testsuites.testsuite.length; i++) {
    if (xml.testsuites.testsuite[i].__.tests === '0' ||
      !xml.testsuites.testsuite[i].testcase) {
      continue
    }
    newStats = xml.testsuites.testsuite[i].__
    if (!stats) {
      stats = {
        errors: parseInt(newStats.errors),
        failures: parseInt(newStats.failures),
        skipped: parseInt(newStats.skipped),
        tests: parseInt(newStats.tests),
        time: parseFloat(newStats.time),
        timestamp: newStats.timestamp
      }
    } else {
      stats.errors += parseInt(newStats.errors)
      stats.failures += parseInt(newStats.failures)
      stats.skipped += parseInt(newStats.skipped)
      stats.tests += parseInt(newStats.tests)
    }
    xml.testsuites.testsuite[i].testcase.forEach(
      testcase => testcases.push(testcase)
    )
  }

  return {
    stats,
    tests: testcases.map(t => {
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
