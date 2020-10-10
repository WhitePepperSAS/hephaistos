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
 * @param {Object} xml
 * @param {Number} nbrOfLines
 * @returns { TestResult[] }
 */
function normalize (xml, nbrOfLines) {
  if (!xml.valgrindoutput ||
    !xml.valgrindoutput.error ||
    !xml.valgrindoutput.error.length) return []
  const out = []
  const errors = xml.valgrindoutput.error
  for (const error of errors) {
    const frame = error.stack[0].frame
      .find(f => f.file && !f.file[0].includes('replacemalloc') && !f.file[0].includes('unity.c'))
    if (!frame) continue
    const f = frame.file[0]
    const l = parseInt(frame.line[0])
    let stacktrace = `${f}:${l}`
    if (nbrOfLines < l) {
      stacktrace = 'malloc() is called in the tests, you need to call free() in your program'
    }
    out.push({
      file: f,
      line: l,
      time: 0,
      failure: {
        stacktrace,
        message: error.xwhat[0].text[0].replace(/in loss record .*/, '')
      }
    })
  }

  /**
   * Group the same errors
   */
  for (let i = 0; i < out.length; i++) {
    const found = out.findIndex((_, j) =>
      j !== i &&
      _.failure.stacktrace === out[i].failure.stacktrace &&
      _.failure.message === out[i].failure.message)
    if (found !== -1) {
      if (!out[i].found) {
        out[i].found = 2
      } else {
        out[i].found++
      }

      out.splice(found, 1)
      i--
    }
  }

  let i = 1
  for (const v of out) {
    if (v.found > 1) {
      v.failure.message = `${v.failure.message} (x${v.found})`
    }
    v.name = 'Memory leak ' + i
    i++
  }

  return out
}

/**
 * @param {String} string
 * @param {Number} nbrOfLines
 * @returns {Promise<TestSuite>}
 */
async function ValgrindXMLFileToJson (string, nbrOfLines) {
  const parsedXml = await xmlParseString(string)
  return normalize(parsedXml, nbrOfLines)
}

module.exports = ValgrindXMLFileToJson
