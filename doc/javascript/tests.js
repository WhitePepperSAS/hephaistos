/* global describe, it */
/* eslint-disable no-unused-expressions */
const sinon = require('sinon')
sinon.test = require('sinon-test')(sinon)
const { expect } = require('chai')
const moduletotest = require('./moduletotest.js')

describe('operation', () => {
  it('should return 16 when given 2 and 3', () => {
    expect(moduletotest.operation(2, 3)).toEqual(2 * 2 + 3 * 4)
  })
  it('should return 65 when given 5 and 10', () => {
    expect(moduletotest.operation(5, 10)).toEqual(5 * 5 + 10 * 4)
  })
})
