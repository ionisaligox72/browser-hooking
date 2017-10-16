'use strict';

// simple hook to setup a debugger breakpoint when a module starts evaluating
// todo: sourcemaps
// todo: parse import and translate to `window.import`
let intercept = async (specifier) => {
  const req = await fetch(specifier);
  // break on evaluation start
  const text = `debugger;\n${await req.text()}`;
  const url = URL.createObjectURL(new File([text], specifier, {
    type: 'text/javascript'
  }));
  return url;
}

onmessage = async event => {
  let {
    specifier,
    referrer,
    baseURI
  } = event.data;
  // for now service workers etc. cannot see the unresolved specifier
  // :( matching for now
  try {
    specifier = new URL(specifier).href;
  }
  catch (e) {
    specifier = new URL(specifier, referrer || baseURI).href;
  }
  const url = await intercept(specifier);
  event.ports[0].postMessage(url);
};
