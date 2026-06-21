export default {
  plugins: {
    tailwindcss: {},
    // GLOBAL UI SCALE (see index.css): convert every stray `px` in the compiled
    // CSS to rem so the 80% root font-size scales the whole design uniformly,
    // with no `zoom`/`transform` (which break Radix popover positioning).
    //   - minPixelValue: 2  → 1px hairlines/borders stay crisp, never scaled.
    //   - mediaQuery: false → responsive breakpoints keep tracking the real viewport.
    //   - exclude node_modules → don't rewrite vendor CSS (e.g. font faces).
    "postcss-pxtorem": {
      rootValue: 16,
      unitPrecision: 5,
      propList: ["*"],
      mediaQuery: false,
      minPixelValue: 2,
      exclude: /node_modules/i,
    },
    autoprefixer: {},
  },
};
