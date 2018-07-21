const debug = require('debug')('hephaistos:AStyleAnalyzer')
const Analyzer = require('./Analyzer.js')
const { spawn } = require('child_process')
const jsdiff = require('diff')
const path = require('path')

/**
 * The goal of AStyleAnalyzer in our case is to check the code against :
 * - multiple styles of braces to see if it matches any of them
 */
class AStyleAnalyzer extends Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {
    debug('analyze')
    const styles = ['mozilla', 'google', '1tbs', 'linux', 'allman']
    const diffCounters = []
    const possibleOutputs = []
    const diffs = []

    await Promise.all(
      styles.map(async (style, i) => {
        debug('style', style)
        const child = spawn('/usr/bin/astyle', [
          `--style=${style}`,
          `--options=${path.join(__dirname, '../options/baseline.astyle.opt')}`,
          '--dry-run'
        ])

        const output = await this.getOutput(child, filecontent)
        const diff = jsdiff.diffChars(filecontent, output)

        let diffcount = 0
        diff.forEach(part => {
          if (part.added || part.removed) {
            diffcount += part.count
          }
        })
        diffCounters[i] = diffcount
        diffs[i] = diff

        possibleOutputs[i] = output
      })
    )

    debug('diffCounters', diffCounters)

    if (diffCounters.indexOf(0) !== -1) {
      return []
    }

    const lessDifferent = this.indexOfMin(diffCounters)
    debug('lessDifferent', lessDifferent)
    const firstDiff = this.indexOfFirstDiff(diffs[lessDifferent])

    const message = this.getMessage(styles[lessDifferent], possibleOutputs[lessDifferent], filecontent, firstDiff)

    return [{
      source: 'astyle',
      line: firstDiff.line,
      col: firstDiff.column,
      type: 'PY015',
      category: 'style',
      message
    }]
  }

  static indexOfMin (counts) {
    let min = Math.min.apply([], counts)
    return counts.findIndex(c => c === min)
  }

  static indexOfFirstDiff (diffs) {
    let countlines = 0
    let countcolumns = 0
    let firstdiff = null
    let i = 0
    let regex = /(\r\n|\n)/g

    while (!firstdiff && diffs.length > i) {
      const diff = diffs[i]

      if (!diff.added) {
        let result = null
        let lastchar = 0
        while ((result = regex.exec(diff.value))) {
          countlines++
          countcolumns = result.index - lastchar
          lastchar = result.index + result[0].length
        }
      }

      if (diff.removed || diff.added) {
        firstdiff = diff
      }

      i++
    }

    return {
      source: 'astyle',
      line: countlines,
      column: countcolumns,
      value: firstdiff.value
    }
  }

  static getLines (input, line, before, after) {
    debug('getLines', line, before, after)
    const inputlines = input.split('\n').map(input => input.replace('\r', ''))
    let output = ''
    let min = Math.max(0, line - before)
    let max = Math.min(inputlines.length - 1, line + after)

    for (let i = min; i <= max; i++) {
      output += inputlines[i] + (i === max ? '' : '\n')
    }

    return output
  }

  static getMessage (style, output, input, diff) {
    return `The style is inconsistent from the closest norm followed (${style}):\n` +
      `expected:\n"""\n${this.getLines(output, diff.line, 2, 2)}\n"""\n` +
      `received:\n"""\n${this.getLines(input, diff.line, 2, 2)}\n"""`
  }
}

module.exports = AStyleAnalyzer
