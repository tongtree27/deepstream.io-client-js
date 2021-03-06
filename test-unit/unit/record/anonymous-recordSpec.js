'use strict'
/* global describe, it, expect, jasmine */

let AnonymousRecord = require('../../../src/record/anonymous-record'),
  RecordHandler = require('../../../src/record/record-handler'),
  ClientMock = require('../../mocks/client-mock'),
  ConnectionMock = require('../../mocks/message/connection-mock'),
  msg = require('../../test-helper/test-helper').msg,
  options = {}

describe('anonymous record allows switching of underlying records', () => {
  let anonymousRecord,
    recordHandler = new RecordHandler(options, new ConnectionMock(), new ClientMock()),
    generalCallback = jasmine.createSpy('general'),
    firstnameCallback = jasmine.createSpy('firstname'),
    readyCallback = jasmine.createSpy('ready')

  it('creates the anonymous record', () => {
    anonymousRecord = new AnonymousRecord(recordHandler)
    expect(anonymousRecord.setName).toBeDefined()
  })

  it('works before setName is called', () => {
    expect(anonymousRecord.get()).toBe(undefined)
    expect(anonymousRecord.set).toThrow()
    expect(anonymousRecord.name).toBe(null)

    anonymousRecord.subscribe('firstname', firstnameCallback)
    anonymousRecord.subscribe(generalCallback)
    anonymousRecord.on('ready', readyCallback)

    expect(firstnameCallback).not.toHaveBeenCalled()
    expect(generalCallback).not.toHaveBeenCalled()

    expect(recordHandler._connection.lastSendMessage).toBe(null)
  })

  it('requests a record when setName is called', () => {
    anonymousRecord.setName('recordA')
    expect(anonymousRecord.name).toBe('recordA')
    expect(recordHandler._connection.lastSendMessage).toBe(msg('R|CR|recordA+'))
  })

  it('does nothing if same name is set again', () => {
    recordHandler._connection.lastSendMessage = null
    anonymousRecord.setName('recordA')
    expect(anonymousRecord.name).toBe('recordA')
    expect(recordHandler._connection.lastSendMessage).toBe(null)
  })

  it('updates subscriptions once the record is ready', () => {
    expect(firstnameCallback).not.toHaveBeenCalled()
    expect(generalCallback).not.toHaveBeenCalled()
    expect(readyCallback).not.toHaveBeenCalled()

    recordHandler._$handle({
      topic: 'R',
      action: 'R',
      data: ['recordA', 1, '{"firstname":"Wolfram"}']
    })

    expect(readyCallback.calls.count()).toBe(1)
    expect(firstnameCallback).toHaveBeenCalledWith('Wolfram')
    expect(generalCallback).toHaveBeenCalledWith({ firstname: 'Wolfram' })
  })

  it('doesn\'t do anything when another record changes', () => {
    recordHandler.getRecord('recordB')

    recordHandler._$handle({
      topic: 'R',
      action: 'R',
      data: ['recordB', 1, '{"firstname":"Egon", "lastname":"Kowalski"}']
    })

    expect(readyCallback.calls.count()).toBe(1)
    expect(firstnameCallback).toHaveBeenCalledWith('Wolfram')
    expect(generalCallback).toHaveBeenCalledWith({ firstname: 'Wolfram' })
  })

  it('updates subscriptions when the record changes to an existing record', () => {
    anonymousRecord.setName('recordB')
    expect(anonymousRecord.name).toBe('recordB')
    expect(readyCallback.calls.count()).toBe(2)
    expect(firstnameCallback).toHaveBeenCalledWith('Egon')
    expect(generalCallback).toHaveBeenCalledWith({ firstname: 'Egon', lastname: 'Kowalski' })
  })

  it('proxies calls through to the underlying record', () => {
    expect(recordHandler.getRecord('recordB').get('lastname')).toBe('Kowalski')
    anonymousRecord.set('lastname', 'Schrader')
    expect(recordHandler.getRecord('recordB').get('lastname')).toBe('Schrader')
  })

  it('doesn\'t throw error if record is reset after being destroyed', () => {
    const errorCallback = jasmine.createSpy('errorCallback')
    anonymousRecord._record.on('error', errorCallback)

    recordHandler._$handle({
      topic: 'R',
      action: 'A',
      data: ['D', 'recordB', 1]
    })

    expect(readyCallback.calls.count()).toBe(2)
    expect(errorCallback).not.toHaveBeenCalled()
  })

  it('emits an nameChanged event when setName is called', () => {
    const readyEventListener = jasmine.createSpy('nameChanged')
    anonymousRecord.on('nameChanged', readyEventListener)

    anonymousRecord.setName('recordC')

    expect(readyEventListener).toHaveBeenCalled()
    expect(readyEventListener).toHaveBeenCalledWith('recordC')
  })

  it('emits an additional ready event once the new record becomes available', () => {
    expect(readyCallback.calls.count()).toBe(2)
    recordHandler._$handle({
      topic: 'R',
      action: 'R',
      data: ['recordC', 1, '{"firstname":"Egon", "lastname":"Kowalski"}']
    })
    expect(readyCallback.calls.count()).toBe(3)
  })

})
