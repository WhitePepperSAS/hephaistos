const debug = require('debug')('hephaistos:ClangAnalyzer')
const Analyzer = require('./Analyzer.js')
const { spawn } = require('child_process')

class ClangAnalyzer extends Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {
    const child = spawn('/usr/bin/clang', [
      '-Wall',
      '-x',
      'c',
      '-'
    ])

    const output = await this.getOutput(child, filecontent, 'stderr')
    const reports = []

    const lines = output.split('\n').map(input => input.replace('\r', ''))

    lines.forEach(line => {
      const parsed = line.match(/^<stdin>:([0-9]*):([0-9]*): (warning|error): (.*)(?: [-W([^\])+])?$/)
      if (!parsed) {
        debug('line not parsed:', line)
        return
      }
      reports.push({
        source: 'clang',
        line: parsed[1],
        col: parsed[2],
        type: '',
        flag: parsed[5],
        category: parsed[3],
        message: parsed[4]
      })
    })

    return reports
  }
}

module.exports = ClangAnalyzer
