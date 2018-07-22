/**
 * @typedef AnalyzeReport
 * @prop {Number} [line] - line
 * @prop {Number} [col] - column
 * @prop {String} [content] - content of the line
 * @prop {String} type - the rule which is broken
 * @prop {String} category - (style|warning|error)
 * @prop {String} message - info to the user
 * @prop {Number} cwe - Common Weaknesses and Exposures
 * @prop {String} flag - flag de warning
 * @prop {String} source - name of the analyzer
 */

class Analyzer {
  /**
   * @param {String} filecontent file contents (not the paths)
   * @returns {AnalyzeReport[]}
   */
  static async analyze (filecontent) {

  }

  /**
   * Tranforms the streams to exploitable string
   * @param {child_process} child
   * @param {String} content
   * @param {String} [output=stdout]
   */
  static async getOutput (child, content, output = 'stdout') {
    const bufs = []
    child[output].on('data', data => bufs.push(data))

    child.stdin.on('error', err => console.log(err))
    child.stdin.write(content)
    child.stdin.end()

    await new Promise(resolve => child[output].on('end', resolve))

    let data = Buffer.concat(bufs).toString('utf8')

    data = data.replace(/\x04[\n]?/, '') // eslint-disable-line no-control-regex

    return data
  }
}

module.exports = Analyzer
