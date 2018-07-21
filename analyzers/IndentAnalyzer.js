const debug = require('debug')('hephaistos:IndentAnalyzer')
const Analyzer = require('./Analyzer.js')

class IndentAnalyzer extends Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {
    /** @type {AnalyzeReport[]} **/
    const reports = []

    const lines = filecontent.split('\n').map(input => input.replace('\r', ''))

    lines.forEach((line, i) => {
      let leadingSpaces = line.match(/^([ ]*)([^ ]|$)/)
      let leadingTabs = line.match(/^([\t ]*)([^ ]|$)/)

      if (!leadingSpaces) {
        debug('skipped line: ', line)
        return
      }

      if (leadingTabs && leadingTabs[1].indexOf('\t') !== -1) {
        reports.push({
          source: 'custom',
          line: i,
          col: leadingTabs[1].indexOf('\t'),
          type: 'PY001',
          message: `You must indent with spaces instead of tabs`
        })
        return
      }

      if (leadingSpaces[1].length % 2 !== 0) {
        reports.push({
          source: 'custom',
          line: i,
          col: 0,
          type: 'PY001',
          category: 'style',
          content: line,
          message: `The line has either a missing space or one in excess (${leadingSpaces[1].length} spaces)`
        })
      }
    })

    return reports
  }
}

module.exports = IndentAnalyzer
