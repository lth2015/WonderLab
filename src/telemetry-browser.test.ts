import { describe, expect, it } from 'vitest';
import { browserKind } from './telemetry';

// Where a page runs decides whose storage the world is in (testkit/送鱼实验说明.md).
const UA = {
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
  homeScreen: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.17.0',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Line/14.17.0',
  wechat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};

describe('browserKind', () => {
  it('names chat apps, other in-app views, the home screen and ordinary browsers', () => {
    expect(browserKind(UA.lineIos, false)).toBe('line');
    expect(browserKind(UA.lineAndroid, false)).toBe('line');
    expect(browserKind(UA.wechat, false)).toBe('wechat');
    expect(browserKind(UA.androidWebView, false)).toBe('other-inapp');
    expect(browserKind(UA.homeScreen, true)).toBe('home-screen');
    expect(browserKind(UA.homeScreen, false)).toBe('other-inapp');
    expect(browserKind(UA.safari, false)).toBe('browser');
    expect(browserKind(UA.iosChrome, false)).toBe('browser');
    expect(browserKind(UA.androidChrome, false)).toBe('browser');
    expect(browserKind(UA.desktop, false)).toBe('browser');
  });
});
