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
 * simplifies and clarifies the output json from the xml extract
 * @returns { TestResult[] }
 */
function normalize (xml) {
  if (!xml.valgrindoutput) return {}
  const out = []
  const errors = xml.valgrindoutput.error
  let i = 1
  for (const error of errors) {
    const frame = error.stack[0].frame
      .find(f => f.file && !f.file[0].includes('replacemalloc') && !f.file[0].includes('unity.c'))
    if (!frame) continue
    const f = frame.file[0]
    const l = parseInt(frame.line[0])
    out.push({
      file: f,
      line: l,
      name: 'Memory leak ' + i,
      time: 0,
      failure: {
        stacktrace: `${f}:${l}`,
        message: error.xwhat[0].text[0].replace(/in loss record .*/, '')
      }
    })
    i++
  }

  return out
}

/**
 * @param {String} string
 * @returns {Promise<TestSuite>}
 */
async function ValgrindXMLFileToJson (string) {
  const parsedXml = await xmlParseString(string)
  return normalize(parsedXml)
}

module.exports = ValgrindXMLFileToJson
