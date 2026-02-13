import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setLogLevel } from '../src/utils/logger.js';

describe('logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    setLogLevel('info'); // reset
  });

  it('logs error messages at info level', () => {
    setLogLevel('info');
    logger.error('test error');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs warn messages at info level', () => {
    setLogLevel('info');
    logger.warn('test warn');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs info messages at info level', () => {
    setLogLevel('info');
    logger.info('test info');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('suppresses debug at info level', () => {
    setLogLevel('info');
    logger.debug('test debug');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('shows debug at debug level', () => {
    setLogLevel('debug');
    logger.debug('test debug');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('suppresses info at warn level', () => {
    setLogLevel('warn');
    logger.info('test info');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('suppresses warn at error level', () => {
    setLogLevel('error');
    logger.warn('test warn');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('shows error at error level', () => {
    setLogLevel('error');
    logger.error('test error');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('tool() logs at debug level', () => {
    setLogLevel('debug');
    logger.tool('Read', 'reading file');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('tool() suppressed at info level', () => {
    setLogLevel('info');
    logger.tool('Read', 'reading file');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('agent() logs at debug level', () => {
    setLogLevel('debug');
    logger.agent('main', 'turn 1');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('agent() suppressed at info level', () => {
    setLogLevel('info');
    logger.agent('main', 'turn 1');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('handles multiple arguments', () => {
    setLogLevel('info');
    logger.error('msg', 'detail1', 'detail2');
    expect(errorSpy).toHaveBeenCalled();
  });
});
