/**
 * @typedef AnalyzeReport
 * @prop {Number} [line]
 * @prop {Number} [col]
 * @prop {String} [content]
 * @prop {String} type
 * @prop {String} category
 * @prop {String} message
 * @prop {Number} cwe
 * @prop {String} source
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
