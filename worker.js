'use strict';
importScripts(
  'https://unpkg.com/acorn'
);

// simple hook to setup a debugger breakpoint when a module starts evaluating
// todo: sourcemaps
// todo: parse import and translate to `window.import`
const URLMap = new Map();
const mutate = async (specifier, {baseURI}) => {
  const req = await fetch(specifier);
  // break on evaluation start
  let text = `debugger;\n${await req.text()}`;
  const ast = acorn.parse(text, {sourceType: 'module'});
  const importStatements = [];
  // needed for indirection since export * doesn't use default
  let hasDefaultExport = false;
  for (const topLevelStatement of ast.body) {
    if (topLevelStatement.type === 'ImportDeclaration') {
      importStatements.push(topLevelStatement);
    }
    else if (topLevelStatement.type === 'ExportDefaultDeclaration') {
      hasDefaultExport = true;
    }
    else if (topLevelStatement.type === 'ExportNamedDeclaration') {
      if (!hasDefaultExport) {
        for (const {exported: {name}} of topLevelStatement.specifiers) {
          if (name === 'default') {
            hasDefaultExport = true;
          }
        }
      }
    }
  }
  for (const importStatement of importStatements.reverse()) {
    const depURL = await resolve(preprocess({
      specifier: importStatement.source.value,
      referrer: specifier,
      baseURI
    }), {baseURI});
    text = text.slice(0, importStatement.source.start) +
      JSON.stringify(depURL) +
      text.slice(importStatement.source.end);
  }
  const url = URL.createObjectURL(new File([
    text
  ], specifier, {
    type: 'text/javascript'
  }));
  return url;
}
const resolve = async (specifier, {baseURI}) => {
  if (URLMap.has(specifier)) {
    return await URLMap.get(specifier);
  }
  URLMap.set(specifier, mutate(specifier, {baseURI}));
  return await URLMap.get(specifier);
}

const preprocess = ({specifier, referrer, baseURI}) => {
  // for now service workers etc. cannot see the unresolved specifier
  // :( matching for now
  try {
    return new URL(specifier).href;
  }
  catch (e) {
    return new URL(specifier, referrer || baseURI).href;
  }
}

onmessage = async event => {
  const specifier = preprocess(event.data);
  const url = await resolve(specifier, event.data);
  event.ports[0].postMessage(url);
};
