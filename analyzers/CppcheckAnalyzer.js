const debug = require('debug')('hephaistos:CppcheckAnalyzer')
const Analyzer = require('./Analyzer.js')
const { spawn } = require('child_process')
const fs = require('fs')
const { promisify } = require('util')
const unlink = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)
const xmlParseString = promisify(require('xml2js').parseString)

class CppcheckAnalyzer extends Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {
    const filepath = `/tmp/${randomObjectId()}`
    await writeFile(filepath, filecontent)

    const child = spawn('/usr/bin/cppcheck', [
      '--enable=all',
      '--xml-version=2',
      '--suppress=missingIncludeSystem',
      '--suppress=unmatchedSuppression',
      filepath
    ])

    const output = await this.getOutput(child, '', 'stderr')

    await unlink(filepath)

    return this.parseOutput(output)
  }

  static async parseOutput (output) {
    const reports = []
    const {results: {errors: [{error}]}} = await xmlParseString(output)
    if (error) {
      error.forEach(err => {
        reports.push({
          source: 'cppcheck',
          line: err.location ? err.location[0].$.line : undefined,
          flag: err.$.id,
          type: '',
          cwe: err.$.cwe,
          category: err.$.severity,
          message: err.$.msg
        })
      })
    }

    debug('reports', reports)

    return reports
  }
}

function randomObjectId () {
  const timestamp = (new Date().getTime() / 1000 | 0).toString(16)
  return timestamp + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16).toLowerCase())
}

module.exports = CppcheckAnalyzer
