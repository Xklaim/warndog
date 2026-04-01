'use strict';

const { describe, it, expect } = require('@jest/globals');
const { parse } = require('../../src/parser');

describe('parser', () => {
  it('parses JSX files without throwing', () => {
    const code = `
      export default function App() {
        return <main><h1>Hello</h1></main>;
      }
    `;

    expect(() => parse(code, 'App.jsx')).not.toThrow();
  });
});
