// Babel plugin to transform import.meta for Jest
module.exports = function() {
  return {
    name: 'transform-import-meta',
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          // Replace import.meta with global.import.meta
          path.replaceWithSourceString('global.import.meta');
        }
      }
    }
  };
};
