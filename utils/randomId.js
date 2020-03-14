/**
 * @returns {String}
 */
function randomId () {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () => String.fromCharCode(97 + Math.random() * 26))
}

module.exports = randomId
