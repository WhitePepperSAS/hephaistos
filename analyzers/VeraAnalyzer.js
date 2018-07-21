const debug = require('debug')('hephaistos:VeraAnalyzer')
const Analyzer = require('./Analyzer.js')
const { spawn } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const xmlParseString = promisify(require('xml2js').parseString)

class VeraAnalyzer extends Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {
    const child = spawn('/usr/bin/vera++', [
      '-p',
      'platypus.rules',
      '-c-',
      '-'
    ])

    const output = await this.getOutput(child, `${filecontent}\n`)

    if (!output) {
      return []
    }

    return this.parseOutput(output)
  }

  static async parseOutput (output) {
    const reports = []
    const {checkstyle: {file: [{error}]}} = await xmlParseString(output)
    if (error) {
      error.forEach(err => {
        reports.push({
          source: 'vera++',
          line: err.$.line,
          type: this.getPYRule(err.$.source),
          category: this.getPYSeverity(err.$.severity),
          message: err.$.message
        })
      })
    }

    debug('reports', reports)

    return reports
  }

  static getPYRule (rule) {
    switch (rule) {
      case 'L001': // No trailing whitespace
        return rule
      case 'L002': // Don't use tab characters
        return 'PY001'
      case 'L003': // No leading and no trailing empty lines
        return 'PY011'
      case 'L004': // Line cannot be too long
        return 'PY005'
      case 'L005': // There should not be too many consecutive empty lines
        return 'PY011'
      case 'L006': // Source file should not be too long
        return rule
      case 'T001': // One-line comments should not have forced continuation
        return 'PY017'
      case 'T002': // Reserved names should not be used for preprocessor macros
        return rule
      case 'T003': // Some keywords should be followed by a single space
        return 'PY008'
      case 'T004': // Some keywords should be immediately followed by a colon
        return rule
      case 'T005': // Keywords break and continue should be immediately followed by a semicolon
        return 'PY018'
      case 'T006': // Keywords return and throw should be immediately followed by a semicolon or a space
        return 'PY019'
      case 'T007': // Semicolons should not be isolated by spaces or comments from the rest of the code
        return 'PY020'
      case 'T008': // Keywords catch, for, if, switch and while should be followed by a single space
        return 'PY008'
      case 'T009': // Comma should not be preceded by whitespace, but should be followed by one
        return 'PY004'
      case 'T019': // Control structures should have complete curly-braced block of code
        return rule
      default:
        return rule
    }
  }

  static getPYSeverity (severity) {
    switch (severity) {
      case 'info':
        return 'style'
      default:
        return severity
    }
  }
}

module.exports = VeraAnalyzer
