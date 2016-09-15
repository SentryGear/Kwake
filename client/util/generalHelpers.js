import browser from 'detect-browser';

export function isTouchDevice() {
  return (('ontouchstart' in window)
  || (navigator.MaxTouchPoints > 0)
  || (navigator.msMaxTouchPoints > 0));
}

export function isAppleDevice() {
  return ((browser.name === 'ios') || (browser.name === 'safari') || (browser.name === undefined));
}
